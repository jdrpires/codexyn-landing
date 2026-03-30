import os
from typing import List

from dotenv import load_dotenv
from fastapi import APIRouter
from openai import OpenAI
from pydantic import BaseModel

from app.config import settings

load_dotenv()

router = APIRouter()

client = OpenAI(api_key=settings.openai_api_key)
AI_MODEL = settings.openai_model


class Transaction(BaseModel):
    type: str
    value: str


class TxRequest(BaseModel):
    transactions: List[Transaction]


@router.post("/analyze")
async def analyze_transactions(data: TxRequest):
    tx_list = "\n".join(f"{tx.type}: {tx.value}" for tx in data.transactions)

    prompt = f"""
Você é um assistente financeiro inteligente de criptomoedas.

Analise essas transações e explique de forma simples:

{tx_list}

Dê:
- resumo
- insights
- possíveis alertas
"""

    try:
        response = client.chat.completions.create(
            model=AI_MODEL,
            messages=[{"role": "user", "content": prompt}],
        )

        return {"analysis": response.choices[0].message.content}
    except Exception:
        return {"analysis": "Erro ao gerar análise"}
