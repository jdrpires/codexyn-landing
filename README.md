# CodeXyn

> Full-stack platform for consolidating digital-asset wallets and exchange information through read-only integrations.

**Next.js · FastAPI · Supabase · PostgreSQL · Docker · Caddy**

| | |
|---|---|
| **Type** | Full-stack financial data platform |
| **Domain** | Digital assets / Portfolio aggregation |
| **Focus** | Account identity, wallet linking and read-only exchange integration |
| **Status** | Public technical project |

## Overview

CodeXyn explores a full-stack architecture for consolidating wallet and exchange information behind an authenticated application.

The repository combines a Next.js frontend, FastAPI backend and external managed services while keeping exchange credentials isolated from the browser.

## Architecture

```text
       Browser
          │
          ▼
       Next.js
          │
          ▼
       FastAPI
      ┌───┴────┐
      │        │
  Supabase   Exchange API
 Auth / DB   read-only
      │        │
      └───┬────┘
          ▼
   Portfolio Data
```

## Repository structure

- `src/` — Next.js frontend.
- `backend/` — FastAPI API.
- `backend/supabase/` — database/schema assets.
- `deploy/` — reverse-proxy configuration.
- `docker-compose.yml` — container orchestration for VPS deployment.

## Local development

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

## Deployment model

```text
Internet
   │
   ▼
 Caddy / TLS
 ┌─────┴─────┐
 │           │
Next.js   FastAPI
             │
        Supabase / APIs
```

The repository includes:

- [docker-compose.yml](docker-compose.yml)
- [Dockerfile.frontend](Dockerfile.frontend)
- [backend/Dockerfile](backend/Dockerfile)
- [deploy/Caddyfile](deploy/Caddyfile)
- [.env.production.example](.env.production.example)
- [backend/.env.production.example](backend/.env.production.example)
- [backend/supabase/schema.sql](backend/supabase/schema.sql)

## Security model

Exchange access is intended to be **read-only**. Credentials must remain server-side and should use the minimum provider permissions required.

Production deployments should also apply:

- secret management outside source control;
- credential rotation;
- strict CORS and trusted-host configuration;
- encryption for stored provider credentials;
- network and application-level observability.

## Why this project is public

CodeXyn demonstrates full-stack architecture, deployment composition and safe integration boundaries for financial-data systems.

---

**Jean Pires** · [GitHub](https://github.com/jdrpires) · [Portfolio](https://github.com/jdrpires/jdrpires)
