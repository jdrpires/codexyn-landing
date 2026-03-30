import axios from "axios"

export type TransactionType = "Envio" | "Recebido"

export type RawTransaction = {
  from: string
  to: string
  value: string
}

export type FormattedTransaction = {
  type: TransactionType
  value: string
  counterparty: string
}

export type AuthMessageResponse = {
  message: string
}

export type VerifyAuthRequest = {
  message: string
  address: string
  signature: string
}

export type VerifyAuthResponse = {
  token: string
  user_id: string
  wallet_id: string
}

export type AnalyzeTransactionsResponse = {
  analysis: string
}

export type WalletTransactionsResponse = {
  transactions: RawTransaction[]
}

export type UserProfileResponse = {
  id: string
  email: string | null
  display_name: string | null
}

export type LinkedWalletResponse = {
  id: string
  address: string
  chain: string
  wallet_type: string
  provider: string | null
  nickname: string | null
  is_primary: boolean
}

export type ExchangeAccountResponse = {
  id: string
  exchange_name: string
  label: string | null
  status: string
  api_key_hint: string | null
}

export type BinanceExchangeConnectResponse = ExchangeAccountResponse & {
  permissions: string[]
  balances_count: number
}

export type ExchangeBalanceResponse = {
  asset: string
  free: string
  locked: string
  total: string
}

export type ExchangeBalancesResponse = {
  account_id: string
  exchange_name: string
  can_trade: boolean
  can_withdraw: boolean
  can_deposit: boolean
  permissions: string[]
  balances: ExchangeBalanceResponse[]
}

export type LinkWalletMessageResponse = {
  message: string
}

export type PersistedSession = {
  userId: string
  walletId: string
  appUserId: string
  appUserEmail: string | null
  address: string
  token: string
  transactions: RawTransaction[]
  analysis: string
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"

const STORAGE_KEY = "codexyn.session"

export const api = axios.create({
  baseURL: API_BASE_URL,
})

export function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  }
}

export function formatTransaction(
  tx: RawTransaction,
  address: string
): FormattedTransaction {
  const normalizedAddress = address.toLowerCase()
  const isOut = tx.from.toLowerCase() === normalizedAddress

  return {
    type: isOut ? "Envio" : "Recebido",
    value: `${isOut ? "-" : "+"}${(Number(tx.value) / 1e18).toFixed(4)} ETH`,
    counterparty: isOut ? tx.to : tx.from,
  }
}

export function saveSession(session: PersistedSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function loadSession(): PersistedSession | null {
  const raw = localStorage.getItem(STORAGE_KEY)

  if (!raw) return null

  try {
    return JSON.parse(raw) as PersistedSession
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY)
}

export function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
