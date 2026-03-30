from __future__ import annotations

from datetime import datetime
from typing import Optional

import jwt
from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.binance import BinanceAPIError, fetch_binance_account_snapshot, mask_api_key
from app.config import settings
from app.db import get_db
from app.models import ExchangeAccount, User, UserWallet, Wallet

router = APIRouter()
security = HTTPBearer()


class CreateUserRequest(BaseModel):
    email: Optional[EmailStr] = None
    display_name: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    email: Optional[str]
    display_name: Optional[str]


class LinkWalletRequest(BaseModel):
    address: str
    chain: str = "ethereum"
    wallet_type: str = "self_custody"
    provider: Optional[str] = None
    label: Optional[str] = None
    nickname: Optional[str] = None
    connected_via: Optional[str] = None
    is_primary: bool = False


class WalletLinkResponse(BaseModel):
    id: str
    address: str
    chain: str
    wallet_type: str
    provider: Optional[str]
    nickname: Optional[str]
    is_primary: bool


class WalletLinkMessageResponse(BaseModel):
    message: str


class VerifyWalletLinkRequest(BaseModel):
    message: str
    address: str
    signature: str
    chain: str = "ethereum"
    wallet_type: str = "self_custody"
    provider: Optional[str] = None
    label: Optional[str] = None
    nickname: Optional[str] = None
    connected_via: Optional[str] = "wallet_signature"
    is_primary: bool = False


class CreateExchangeAccountRequest(BaseModel):
    exchange_name: str
    label: Optional[str] = None
    external_account_id: Optional[str] = None
    api_key_hint: Optional[str] = None
    status: str = "pending"


class ExchangeAccountResponse(BaseModel):
    id: str
    exchange_name: str
    label: Optional[str]
    status: str
    api_key_hint: Optional[str]


class ConnectBinanceExchangeRequest(BaseModel):
    api_key: str
    api_secret: str
    label: Optional[str] = None


class ExchangeBalanceResponse(BaseModel):
    asset: str
    free: str
    locked: str
    total: str


class BinanceExchangeAccountResponse(ExchangeAccountResponse):
    permissions: list[str] = []
    balances_count: int = 0


class BinanceExchangeBalancesResponse(BaseModel):
    account_id: str
    exchange_name: str
    can_trade: bool
    can_withdraw: bool
    can_deposit: bool
    permissions: list[str] = []
    balances: list[ExchangeBalanceResponse] = []


def get_authenticated_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> str:
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=["HS256"],
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid session token") from exc

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Missing user session")

    return user_id


def ensure_user_access(path_user_id: str, authenticated_user_id: str):
    if path_user_id != authenticated_user_id:
        raise HTTPException(status_code=403, detail="Forbidden")


def store_exchange_credentials(
    db: Session, exchange_account_id: str, api_key: str, api_secret: str
):
    db.execute(
        text(
            """
            update exchange_accounts
            set
              api_key_encrypted = pgp_sym_encrypt(:api_key, :secret),
              api_secret_encrypted = pgp_sym_encrypt(:api_secret, :secret)
            where id = :exchange_account_id
            """
        ),
        {
            "exchange_account_id": exchange_account_id,
            "api_key": api_key,
            "api_secret": api_secret,
            "secret": settings.exchange_credentials_secret,
        },
    )


def load_exchange_credentials(db: Session, exchange_account_id: str) -> tuple[str, str]:
    row = (
        db.execute(
            text(
                """
                select
                  pgp_sym_decrypt(api_key_encrypted, :secret) as api_key,
                  pgp_sym_decrypt(api_secret_encrypted, :secret) as api_secret
                from exchange_accounts
                where id = :exchange_account_id
                """
            ),
            {
                "exchange_account_id": exchange_account_id,
                "secret": settings.exchange_credentials_secret,
            },
        )
        .mappings()
        .first()
    )

    if not row or not row["api_key"] or not row["api_secret"]:
        raise HTTPException(status_code=400, detail="Exchange credentials not available")

    return str(row["api_key"]), str(row["api_secret"])


def upsert_wallet_link(user_id: str, data, db: Session) -> WalletLinkResponse:
    wallet = db.scalar(
        select(Wallet).where(
            Wallet.address == data.address.lower(), Wallet.chain == data.chain.lower()
        )
    )

    if not wallet:
        wallet = Wallet(
            address=data.address.lower(),
            chain=data.chain.lower(),
            wallet_type=data.wallet_type,
            provider=data.provider,
            label=data.label,
        )
        db.add(wallet)
        db.flush()

    existing_link = db.scalar(
        select(UserWallet).where(
            UserWallet.user_id == user_id, UserWallet.wallet_id == wallet.id
        )
    )

    if existing_link:
        existing_link.nickname = data.nickname or existing_link.nickname
        existing_link.connected_via = data.connected_via or existing_link.connected_via
        existing_link.is_primary = data.is_primary
        existing_link.last_seen_at = datetime.utcnow()
        db.commit()
        db.refresh(existing_link)
        return WalletLinkResponse(
            id=str(existing_link.id),
            address=wallet.address,
            chain=wallet.chain,
            wallet_type=wallet.wallet_type,
            provider=wallet.provider,
            nickname=existing_link.nickname,
            is_primary=existing_link.is_primary,
        )

    user_wallet = UserWallet(
        user_id=user_id,
        wallet_id=wallet.id,
        nickname=data.nickname,
        connected_via=data.connected_via,
        is_primary=data.is_primary,
        last_seen_at=datetime.utcnow(),
    )
    db.add(user_wallet)
    db.commit()
    db.refresh(user_wallet)

    return WalletLinkResponse(
        id=str(user_wallet.id),
        address=wallet.address,
        chain=wallet.chain,
        wallet_type=wallet.wallet_type,
        provider=wallet.provider,
        nickname=user_wallet.nickname,
        is_primary=user_wallet.is_primary,
    )


@router.post("/users", response_model=UserResponse)
def create_user(data: CreateUserRequest, db: Session = Depends(get_db)):
    user = User(email=data.email, display_name=data.display_name)
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserResponse(
        id=str(user.id), email=user.email, display_name=user.display_name
    )


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    authenticated_user_id: str = Depends(get_authenticated_user_id),
):
    ensure_user_access(user_id, authenticated_user_id)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(
        id=str(user.id), email=user.email, display_name=user.display_name
    )


@router.post("/users/{user_id}/wallets", response_model=WalletLinkResponse)
def link_wallet(
    user_id: str,
    data: LinkWalletRequest,
    db: Session = Depends(get_db),
    authenticated_user_id: str = Depends(get_authenticated_user_id),
):
    ensure_user_access(user_id, authenticated_user_id)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return upsert_wallet_link(user_id, data, db)


@router.get("/users/{user_id}/wallets", response_model=list[WalletLinkResponse])
def list_user_wallets(
    user_id: str,
    db: Session = Depends(get_db),
    authenticated_user_id: str = Depends(get_authenticated_user_id),
):
    ensure_user_access(user_id, authenticated_user_id)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    links = db.scalars(select(UserWallet).where(UserWallet.user_id == user_id)).all()

    return [
        WalletLinkResponse(
            id=str(link.id),
            address=link.wallet.address,
            chain=link.wallet.chain,
            wallet_type=link.wallet.wallet_type,
            provider=link.wallet.provider,
            nickname=link.nickname,
            is_primary=link.is_primary,
        )
        for link in links
    ]


@router.get("/users/{user_id}/wallet-link-message", response_model=WalletLinkMessageResponse)
def get_wallet_link_message(
    user_id: str,
    address: str,
    authenticated_user_id: str = Depends(get_authenticated_user_id),
):
    ensure_user_access(user_id, authenticated_user_id)
    message = (
        "Link CodeXyn Wallet\n"
        f"Timestamp: {int(datetime.utcnow().timestamp())}\n"
        f"User: {user_id}\n"
        f"Wallet: {address.lower()}"
    )
    return {"message": message}


@router.post("/users/{user_id}/wallets/verify-link", response_model=WalletLinkResponse)
def verify_and_link_wallet(
    user_id: str,
    data: VerifyWalletLinkRequest,
    db: Session = Depends(get_db),
    authenticated_user_id: str = Depends(get_authenticated_user_id),
):
    ensure_user_access(user_id, authenticated_user_id)

    msg = encode_defunct(text=data.message)
    recovered = Account.recover_message(msg, signature=data.signature)

    if recovered.lower() != data.address.lower():
        raise HTTPException(status_code=401, detail="Invalid signature")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return upsert_wallet_link(user_id, data, db)


@router.post(
    "/users/{user_id}/exchange-accounts", response_model=ExchangeAccountResponse
)
def create_exchange_account(
    user_id: str,
    data: CreateExchangeAccountRequest,
    db: Session = Depends(get_db),
    authenticated_user_id: str = Depends(get_authenticated_user_id),
):
    ensure_user_access(user_id, authenticated_user_id)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    exchange_account = ExchangeAccount(
        user_id=user_id,
        exchange_name=data.exchange_name.lower(),
        label=data.label,
        external_account_id=data.external_account_id,
        api_key_hint=data.api_key_hint,
        status=data.status,
    )
    db.add(exchange_account)
    db.commit()
    db.refresh(exchange_account)

    return ExchangeAccountResponse(
        id=str(exchange_account.id),
        exchange_name=exchange_account.exchange_name,
        label=exchange_account.label,
        status=exchange_account.status,
        api_key_hint=exchange_account.api_key_hint,
    )


@router.get(
    "/users/{user_id}/exchange-accounts", response_model=list[ExchangeAccountResponse]
)
def list_exchange_accounts(
    user_id: str,
    db: Session = Depends(get_db),
    authenticated_user_id: str = Depends(get_authenticated_user_id),
):
    ensure_user_access(user_id, authenticated_user_id)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    accounts = db.scalars(
        select(ExchangeAccount).where(ExchangeAccount.user_id == user_id)
    ).all()

    return [
        ExchangeAccountResponse(
            id=str(account.id),
            exchange_name=account.exchange_name,
            label=account.label,
            status=account.status,
            api_key_hint=account.api_key_hint,
        )
        for account in accounts
    ]


@router.post(
    "/users/{user_id}/exchange-accounts/binance",
    response_model=BinanceExchangeAccountResponse,
)
def connect_binance_exchange(
    user_id: str,
    data: ConnectBinanceExchangeRequest,
    db: Session = Depends(get_db),
    authenticated_user_id: str = Depends(get_authenticated_user_id),
):
    ensure_user_access(user_id, authenticated_user_id)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        snapshot = fetch_binance_account_snapshot(
            data.api_key.strip(), data.api_secret.strip()
        )
    except BinanceAPIError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    exchange_account = ExchangeAccount(
        user_id=user_id,
        exchange_name="binance",
        label=data.label or "Binance Exchange",
        api_key_hint=mask_api_key(data.api_key),
        status="active",
        last_synced_at=datetime.utcnow(),
    )
    db.add(exchange_account)
    db.flush()

    store_exchange_credentials(
        db,
        str(exchange_account.id),
        data.api_key.strip(),
        data.api_secret.strip(),
    )

    db.commit()
    db.refresh(exchange_account)

    return BinanceExchangeAccountResponse(
        id=str(exchange_account.id),
        exchange_name=exchange_account.exchange_name,
        label=exchange_account.label,
        status=exchange_account.status,
        api_key_hint=exchange_account.api_key_hint,
        permissions=snapshot.get("permissions", []),
        balances_count=snapshot.get("balances_count", 0),
    )


@router.get(
    "/users/{user_id}/exchange-accounts/{exchange_account_id}/balances",
    response_model=BinanceExchangeBalancesResponse,
)
def get_exchange_account_balances(
    user_id: str,
    exchange_account_id: str,
    db: Session = Depends(get_db),
    authenticated_user_id: str = Depends(get_authenticated_user_id),
):
    ensure_user_access(user_id, authenticated_user_id)
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    exchange_account = db.get(ExchangeAccount, exchange_account_id)
    if not exchange_account or str(exchange_account.user_id) != user_id:
        raise HTTPException(status_code=404, detail="Exchange account not found")

    if exchange_account.exchange_name != "binance":
        raise HTTPException(status_code=400, detail="Unsupported exchange account")

    api_key, api_secret = load_exchange_credentials(db, exchange_account_id)

    try:
        snapshot = fetch_binance_account_snapshot(api_key, api_secret)
    except BinanceAPIError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    exchange_account.last_synced_at = datetime.utcnow()
    db.commit()

    return BinanceExchangeBalancesResponse(
        account_id=str(exchange_account.id),
        exchange_name=exchange_account.exchange_name,
        can_trade=bool(snapshot.get("can_trade")),
        can_withdraw=bool(snapshot.get("can_withdraw")),
        can_deposit=bool(snapshot.get("can_deposit")),
        permissions=snapshot.get("permissions", []),
        balances=[
            ExchangeBalanceResponse(**balance)
            for balance in snapshot.get("balances", [])
        ],
    )
