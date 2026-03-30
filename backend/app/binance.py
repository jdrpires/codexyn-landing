from __future__ import annotations

import hashlib
import hmac
import time
from decimal import Decimal, InvalidOperation
from typing import Any
from urllib.parse import urlencode

import httpx

from app.config import settings


class BinanceAPIError(Exception):
    pass


def mask_api_key(api_key: str) -> str:
    cleaned = api_key.strip()

    if len(cleaned) <= 8:
        return cleaned

    return f"{cleaned[:4]}...{cleaned[-4:]}"


def _parse_decimal(value: str) -> Decimal:
    try:
        return Decimal(value)
    except (InvalidOperation, TypeError):
        return Decimal("0")


def fetch_binance_account_snapshot(api_key: str, api_secret: str) -> dict[str, Any]:
    timestamp = int(time.time() * 1000)
    params = {"timestamp": timestamp, "recvWindow": 10000}
    query_string = urlencode(params)
    signature = hmac.new(
        api_secret.encode("utf-8"),
        query_string.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    request_params = {**params, "signature": signature}

    try:
        with httpx.Client(base_url=settings.binance_api_url, timeout=20.0) as client:
            response = client.get(
                "/api/v3/account",
                params=request_params,
                headers={"X-MBX-APIKEY": api_key},
            )
    except httpx.HTTPError as exc:
        raise BinanceAPIError(
            "Nao foi possivel conectar com a API da Binance."
        ) from exc

    if response.status_code != 200:
        error_payload = response.json() if response.content else {}
        message = error_payload.get("msg") or "Falha ao validar credenciais da Binance."
        raise BinanceAPIError(message)

    payload = response.json()
    balances = []

    for balance in payload.get("balances", []):
        free = _parse_decimal(balance.get("free", "0"))
        locked = _parse_decimal(balance.get("locked", "0"))
        total = free + locked

        if total <= 0:
            continue

        balances.append(
            {
                "asset": balance.get("asset", ""),
                "free": format(free, "f"),
                "locked": format(locked, "f"),
                "total": format(total, "f"),
            }
        )

    balances.sort(key=lambda item: Decimal(item["total"]), reverse=True)

    return {
        "account_type": payload.get("accountType"),
        "can_trade": payload.get("canTrade"),
        "can_withdraw": payload.get("canWithdraw"),
        "can_deposit": payload.get("canDeposit"),
        "permissions": payload.get("permissions", []),
        "balances": balances,
        "balances_count": len(balances),
    }
