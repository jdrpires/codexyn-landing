import os
import time
import uuid
from datetime import datetime

import jwt
from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.models import User, UserWallet, Wallet
from app.supabase_auth import get_supabase_user

router = APIRouter()

JWT_SECRET = settings.jwt_secret
TOKEN_TTL_SECONDS = settings.token_ttl_seconds


class VerifyRequest(BaseModel):
    message: str
    address: str
    signature: str


class VerifyResponse(BaseModel):
    token: str
    user_id: str
    wallet_id: str


@router.get("/message")
def get_message(address: str):
    message = f"Login CodeXyn\nTimestamp: {int(time.time())}\nWallet: {address}"
    return {"message": message}


@router.post("/verify", response_model=VerifyResponse)
def verify(
    data: VerifyRequest,
    db: Session = Depends(get_db),
    auth_user: dict = Depends(get_supabase_user),
):
    msg = encode_defunct(text=data.message)
    recovered = Account.recover_message(msg, signature=data.signature)

    if recovered.lower() != data.address.lower():
        raise HTTPException(status_code=401, detail="Invalid signature")

    normalized_address = data.address.lower()

    wallet = db.scalar(
        select(Wallet).where(
            Wallet.address == normalized_address, Wallet.chain == "ethereum"
        )
    )

    app_user_id = uuid.UUID(auth_user["id"])
    user_wallet = None
    user = db.get(User, app_user_id)

    if wallet:
        user_wallet = db.scalar(
            select(UserWallet).where(
                UserWallet.wallet_id == wallet.id, UserWallet.user_id == app_user_id
            )
        )

    if not user:
        user = User(
            id=app_user_id,
            email=auth_user.get("email"),
            display_name=auth_user.get("email") or f"Wallet {normalized_address[:6]}",
        )
        db.add(user)
        db.flush()
    elif auth_user.get("email") and user.email != auth_user.get("email"):
        user.email = auth_user.get("email")

    if not wallet:
        wallet = Wallet(
            address=normalized_address,
            chain="ethereum",
            wallet_type="self_custody",
            provider="wallet_signature",
            label="Primary wallet",
        )
        db.add(wallet)
        db.flush()

    if not user_wallet:
        user_wallet = UserWallet(
            user_id=user.id,
            wallet_id=wallet.id,
            nickname="Primary wallet",
            connected_via="wallet_signature",
            is_primary=True,
            last_seen_at=datetime.utcnow(),
        )
        db.add(user_wallet)
    else:
        user_wallet.last_seen_at = datetime.utcnow()

    db.commit()

    token = jwt.encode(
        {
            "address": data.address,
            "user_id": str(user.id),
            "wallet_id": str(wallet.id),
            "exp": int(time.time()) + TOKEN_TTL_SECONDS,
        },
        JWT_SECRET,
        algorithm="HS256",
    )

    return {"token": token, "user_id": str(user.id), "wallet_id": str(wallet.id)}
