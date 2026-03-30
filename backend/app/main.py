from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.accounts import router as accounts_router
from app.ai import router as ai_router
from app.auth import router as auth_router
from app.config import settings
from app.wallet import router as wallet_router

app = FastAPI(title="CodeXyn Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(accounts_router, prefix="/accounts", tags=["accounts"])
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(ai_router, prefix="/ai", tags=["ai"])
app.include_router(wallet_router, prefix="/wallet", tags=["wallet"])


@app.get("/")
def root():
    return {"status": "CodeXyn backend rodando"}
