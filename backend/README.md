# CodeXyn Backend

Backend FastAPI usado pelo frontend deste repositório.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

## Supabase

1. Crie um projeto no Supabase.
2. Configure `DATABASE_URL` com a connection string Postgres do projeto.
3. Rode o SQL de `backend/supabase/schema.sql` no SQL Editor do Supabase.
4. Preencha `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`.

## Endpoints

- `POST /accounts/users`
- `GET /accounts/users/{user_id}`
- `POST /accounts/users/{user_id}/wallets`
- `GET /accounts/users/{user_id}/wallets`
- `POST /accounts/users/{user_id}/exchange-accounts`
- `GET /accounts/users/{user_id}/exchange-accounts`
- `POST /accounts/users/{user_id}/exchange-accounts/binance`
- `GET /accounts/users/{user_id}/exchange-accounts/{exchange_account_id}/balances`
- `GET /auth/message?address=0x...`
- `POST /auth/verify`
- `POST /ai/analyze`
- `GET /wallet/transactions?address=0x...&limit=10`

## Configuração

Preencha no `.env`:

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `ETHERSCAN_API_KEY`
- `JWT_SECRET`
- `EXCHANGE_CREDENTIALS_SECRET`

## Binance Exchange

Para conectar uma conta Binance no dashboard:

1. Crie uma API key read-only na Binance.
2. Desabilite saque.
3. Não habilite permissão de trade para esse primeiro teste.
4. Rode novamente o SQL de `backend/supabase/schema.sql` para adicionar as colunas novas de credenciais criptografadas.

As credenciais são armazenadas criptografadas no Postgres usando `pgcrypto`.

## Produto

Essa base já suporta a modelagem inicial para:

- um usuário com múltiplas wallets
- múltiplas contas de exchange
- snapshots de portfólio
- relatórios de IA
