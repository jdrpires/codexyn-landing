# CodeXyn Product Architecture

## Objetivo

Centralizar carteiras e contas de exchange em um único produto, com leitura consolidada de saldo, transações, portfólio e insights de IA.

## Princípios

- banco separado da aplicação
- backend como orquestrador de integrações
- frontend sem lógica financeira pesada
- suporte a múltiplas wallets por usuário
- suporte a exchanges por API read-only

## Stack

- Frontend: Next.js
- Backend: FastAPI
- Banco: Supabase Postgres
- Wallet connectivity: injected wallets + WalletConnect
- Exchanges: integrações read-only por API

## Modelo inicial

- `users`
- `wallets`
- `user_wallets`
- `exchange_accounts`
- `portfolio_snapshots`
- `ai_reports`

## Fases

### Fase 1

- criar usuário
- vincular múltiplas wallets
- consultar transações
- gerar análise de IA

### Fase 2

- conectar exchanges
- consolidar portfólio
- snapshots históricos

### Fase 3

- alertas
- relatórios automáticos
- score e classificação de risco
