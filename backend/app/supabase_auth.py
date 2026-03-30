import uuid

import httpx
from fastapi import Header, HTTPException

from app.config import settings


async def get_supabase_user(authorization: str = Header(...)) -> dict:
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise HTTPException(status_code=500, detail="Supabase auth is not configured.")

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header.")

    token = authorization.replace("Bearer ", "", 1)

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": settings.supabase_anon_key,
            },
        )

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid Supabase session.")

    payload = response.json()

    try:
        uuid.UUID(payload["id"])
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Invalid Supabase user.") from exc

    return payload
