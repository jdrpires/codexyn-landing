# CodeXyn

Frontend Next.js + backend FastAPI para uma plataforma que centraliza wallets e exchanges com autenticação por conta, vínculo de carteira e integração com Binance Exchange por API read-only.

## Estrutura

- `src/`: frontend Next.js
- `backend/`: API FastAPI
- `deploy/`: arquivos de proxy reverso para produção
- `docker-compose.yml`: stack pronta para VPS com Caddy

## Desenvolvimento local

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

## Produção em VPS

O repositório já está preparado para rodar inteiro na mesma máquina, sem separar frontend e backend em projetos diferentes.

Stack recomendada:

- `frontend`: container Next.js
- `backend`: container FastAPI
- `caddy`: TLS automático + reverse proxy
- `supabase`: banco e auth fora da VPS

### Arquivos de produção

- [docker-compose.yml](/Users/jeandrpires/Projetos/codexyn-landing/docker-compose.yml)
- [Dockerfile.frontend](/Users/jeandrpires/Projetos/codexyn-landing/Dockerfile.frontend)
- [backend/Dockerfile](/Users/jeandrpires/Projetos/codexyn-landing/backend/Dockerfile)
- [deploy/Caddyfile](/Users/jeandrpires/Projetos/codexyn-landing/deploy/Caddyfile)
- [.env.production.example](/Users/jeandrpires/Projetos/codexyn-landing/.env.production.example)
- [backend/.env.production.example](/Users/jeandrpires/Projetos/codexyn-landing/backend/.env.production.example)

### Variáveis

Na raiz, crie `.env.production` com:

```env
APP_DOMAIN=app.seudominio.com
API_DOMAIN=api.seudominio.com
NEXT_PUBLIC_API_URL=https://api.seudominio.com
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
```

No backend, crie `backend/.env` com base em `backend/.env.production.example`.

### Deploy

```bash
docker compose --env-file .env.production up -d --build
```

### DNS

Crie dois apontamentos para o IP da sua VPS:

- `app.seudominio.com`
- `api.seudominio.com`

### Observações

- O frontend usa `Next.js standalone` para ficar mais leve em container.
- O backend continua usando Supabase externo.
- As credenciais da Binance ficam criptografadas no Postgres com `pgcrypto`.
- Rode novamente o SQL de [backend/supabase/schema.sql](/Users/jeandrpires/Projetos/codexyn-landing/backend/supabase/schema.sql) se ainda não adicionou as colunas novas da Binance.
