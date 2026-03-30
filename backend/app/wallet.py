import os
from typing import List

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.config import settings

load_dotenv()

router = APIRouter()

ETHERSCAN_API_URL = settings.etherscan_api_url
ETHERSCAN_API_KEY = settings.etherscan_api_key
ETHERSCAN_CHAIN_ID = settings.etherscan_chain_id


class RawTransaction(BaseModel):
    from_: str
    to: str
    value: str

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "from": "0xabc",
                "to": "0xdef",
                "value": "10000000000000000",
            }
        },
    }


class WalletTransactionsResponse(BaseModel):
    transactions: List[dict[str, str]]


@router.get("/transactions", response_model=WalletTransactionsResponse)
async def get_wallet_transactions(
    address: str = Query(..., min_length=42, max_length=42),
    limit: int = Query(10, ge=1, le=50),
):
    if not ETHERSCAN_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="ETHERSCAN_API_KEY is not configured on the backend.",
        )

    params = {
        "chainid": ETHERSCAN_CHAIN_ID,
        "module": "account",
        "action": "txlist",
        "address": address,
        "startblock": 0,
        "endblock": 9999999999,
        "page": 1,
        "offset": limit,
        "sort": "desc",
        "apikey": ETHERSCAN_API_KEY,
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(ETHERSCAN_API_URL, params=params)

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail="Failed to fetch transactions from upstream explorer.",
        )

    payload = response.json()
    result = payload.get("result", [])
    message = payload.get("message", "")

    if not isinstance(result, list):
        raise HTTPException(
            status_code=502,
            detail="Unexpected transaction payload received from explorer.",
        )

    if payload.get("status") == "0" and message != "No transactions found":
        raise HTTPException(
            status_code=502,
            detail=payload.get("result", "Explorer request failed."),
        )

    transactions = [
        {
            "from": tx.get("from", ""),
            "to": tx.get("to", ""),
            "value": tx.get("value", "0"),
        }
        for tx in result
        if tx.get("from") and tx.get("to")
    ]

    return {"transactions": transactions}
