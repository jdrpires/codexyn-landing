"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSignMessage,
} from "wagmi"

import {
  authHeaders,
  BinanceExchangeConnectResponse,
  clearSession,
  api,
  ExchangeAccountResponse,
  ExchangeBalancesResponse,
  formatTransaction,
  LinkedWalletResponse,
  LinkWalletMessageResponse,
  loadSession,
  PersistedSession,
  shortenAddress,
  UserProfileResponse,
} from "@/lib/codexyn"
import { clearAuthSession } from "@/lib/supabase-auth"

type WalletOption = "metaMask"

export default function Dashboard() {
  const { address: connectedAddress } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnectAsync } = useDisconnect()
  const { signMessageAsync } = useSignMessage()

  const [session, setSession] = useState<PersistedSession | null>(null)
  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState<UserProfileResponse | null>(null)
  const [wallets, setWallets] = useState<LinkedWalletResponse[]>([])
  const [exchangeAccounts, setExchangeAccounts] = useState<ExchangeAccountResponse[]>([])
  const [exchangeBalances, setExchangeBalances] = useState<
    Record<string, ExchangeBalancesResponse>
  >({})
  const [accountLoading, setAccountLoading] = useState(false)
  const [accountError, setAccountError] = useState("")
  const [linkWalletType, setLinkWalletType] = useState<WalletOption | null>(null)
  const [linkingWallet, setLinkingWallet] = useState(false)
  const [linkWalletError, setLinkWalletError] = useState("")
  const [linkWalletSuccess, setLinkWalletSuccess] = useState("")
  const [binanceApiKey, setBinanceApiKey] = useState("")
  const [binanceApiSecret, setBinanceApiSecret] = useState("")
  const [binanceLabel, setBinanceLabel] = useState("Binance Exchange")
  const [binanceLoading, setBinanceLoading] = useState(false)
  const [binanceError, setBinanceError] = useState("")
  const [binanceSuccess, setBinanceSuccess] = useState("")

  const metaMaskConnector =
    connectors.find((connector) => connector.id === "metaMask") ?? null
  const loadAccount = async (currentSession: PersistedSession) => {
    setAccountLoading(true)
    setAccountError("")

    try {
      const [userResponse, walletResponse, exchangeResponse] = await Promise.all([
        api.get<UserProfileResponse>(`/accounts/users/${currentSession.userId}`, {
          headers: authHeaders(currentSession.token),
        }),
        api.get<LinkedWalletResponse[]>(
          `/accounts/users/${currentSession.userId}/wallets`,
          {
            headers: authHeaders(currentSession.token),
          }
        ),
        api.get<ExchangeAccountResponse[]>(
          `/accounts/users/${currentSession.userId}/exchange-accounts`,
          {
            headers: authHeaders(currentSession.token),
          }
        ),
      ])

      setProfile(userResponse.data)
      setWallets(walletResponse.data)
      setExchangeAccounts(exchangeResponse.data)
    } catch (err) {
      console.error(err)
      setAccountError(
        "Nao foi possivel carregar os dados da conta vinculada no backend."
      )
    } finally {
      setAccountLoading(false)
    }
  }

  useEffect(() => {
    setSession(loadSession())
    setReady(true)
  }, [])

  useEffect(() => {
    if (!session?.userId) return

    let ignore = false

    const loadAccountForSession = async () => {
      try {
        await loadAccount(session)

        if (ignore) return
      } catch (err) {
        console.error(err)

        if (ignore) return
      }
    }

    loadAccountForSession()

    return () => {
      ignore = true
    }
  }, [session])

  useEffect(() => {
    if (!session || exchangeAccounts.length === 0) {
      return
    }

    let ignore = false

    const loadBalances = async () => {
      try {
        const responses = await Promise.all(
          exchangeAccounts.map((account) =>
            api.get<ExchangeBalancesResponse>(
              `/accounts/users/${session.userId}/exchange-accounts/${account.id}/balances`,
              {
                headers: authHeaders(session.token),
              }
            )
          )
        )

        if (ignore) return

        const nextBalances = responses.reduce<Record<string, ExchangeBalancesResponse>>(
          (accumulator, response) => {
            accumulator[response.data.account_id] = response.data
            return accumulator
          },
          {}
        )

        setExchangeBalances(nextBalances)
      } catch (err) {
        console.error(err)
      }
    }

    loadBalances()

    return () => {
      ignore = true
    }
  }, [exchangeAccounts, session])

  const handleLogout = async () => {
    clearSession()

    try {
      await clearAuthSession()
    } catch (err) {
      console.error(err)
    }

    setSession(null)
  }

  const handleConnectWalletForLink = async (wallet: WalletOption) => {
    setLinkWalletError("")
    setLinkWalletSuccess("")
    setLinkWalletType(wallet)

    const connector = metaMaskConnector

    if (!connector) {
      setLinkWalletError("MetaMask nao esta disponivel neste navegador.")
      return
    }

    try {
      const provider = await connector.getProvider()

      if (!provider) {
        setLinkWalletError("Instale ou habilite a MetaMask para continuar.")
        return
      }

      await connect({ connector })
    } catch (err) {
      console.error(err)
      setLinkWalletError("Nao foi possivel conectar a MetaMask.")
    }
  }

  const handleLinkCurrentWallet = async () => {
    if (!session || !connectedAddress || !linkWalletType) {
      setLinkWalletError("Conecte a carteira que voce deseja vincular primeiro.")
      return
    }

    try {
      setLinkingWallet(true)
      setLinkWalletError("")
      setLinkWalletSuccess("")

      const { data: linkMessage } = await api.get<LinkWalletMessageResponse>(
        `/accounts/users/${session.userId}/wallet-link-message`,
        {
          params: { address: connectedAddress },
          headers: authHeaders(session.token),
        }
      )

      const signature = await signMessageAsync({
        message: linkMessage.message,
      })

      await api.post(
        `/accounts/users/${session.userId}/wallets/verify-link`,
        {
          message: linkMessage.message,
          address: connectedAddress,
          signature,
          provider: linkWalletType,
          nickname: "MetaMask wallet",
          connected_via: linkWalletType,
        },
        {
          headers: authHeaders(session.token),
        }
      )

      await loadAccount(session)
      setLinkWalletSuccess("Carteira vinculada com sucesso.")
      await disconnectAsync()
      setLinkWalletType(null)
    } catch (err) {
      console.error(err)
      setLinkWalletError(
        "Nao foi possivel vincular a nova carteira. Verifique a assinatura e tente novamente."
      )
    } finally {
      setLinkingWallet(false)
    }
  }

  const handleConnectBinanceExchange = async () => {
    if (!session) return

    setBinanceError("")
    setBinanceSuccess("")

    if (!binanceApiKey.trim() || !binanceApiSecret.trim()) {
      setBinanceError("Informe a API key e a API secret da Binance.")
      return
    }

    try {
      setBinanceLoading(true)

      await api.post<BinanceExchangeConnectResponse>(
        `/accounts/users/${session.userId}/exchange-accounts/binance`,
        {
          api_key: binanceApiKey.trim(),
          api_secret: binanceApiSecret.trim(),
          label: binanceLabel.trim() || "Binance Exchange",
        },
        {
          headers: authHeaders(session.token),
        }
      )

      setBinanceSuccess("Conta Binance conectada com sucesso.")
      setBinanceApiKey("")
      setBinanceApiSecret("")
      await loadAccount(session)
    } catch (err: unknown) {
      console.error(err)
      setBinanceError("Nao foi possivel validar sua conta Binance. Confira a API key, a API secret e as permissoes read-only.")
    } finally {
      setBinanceLoading(false)
    }
  }

  if (!ready) {
    return (
      <main className="bg-black text-white min-h-screen flex items-center justify-center px-6">
        <p className="text-gray-400">Carregando dashboard...</p>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="bg-black text-white min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-3xl font-bold">Sessão não encontrada</h1>
          <p className="text-gray-400">
            Conecte sua wallet e faça login novamente para carregar o dashboard.
          </p>
          <Link
            href="/"
            className="inline-block bg-purple-600 px-6 py-3 rounded-xl"
          >
            Voltar para a landing
          </Link>
        </div>
      </main>
    )
  }

  const displayName = profile?.display_name || "Usuario CodeXyn"

  return (
    <main className="bg-black text-white min-h-screen p-10">
      <div className="flex flex-col gap-4 mb-8 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl mb-2">Dashboard 🚀</h1>
          <p className="text-gray-200">{displayName}</p>
          <p className="text-gray-400">Wallet ativa: {shortenAddress(session.address)}</p>
          <p className="text-gray-400">
            Conta: {session.appUserEmail || session.appUserId}
          </p>
          <p className="text-gray-500 text-sm">Usuario: {session.userId}</p>
        </div>

        <div className="flex gap-3">
          <Link href="/" className="bg-white/10 px-5 py-2 rounded-lg">
            Landing
          </Link>
          <button
            onClick={handleLogout}
            className="bg-red-600 px-5 py-2 rounded-lg"
          >
            Sair
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="bg-white/5 p-5 rounded-2xl">
            <h2 className="text-xl mb-4">Minha Conta</h2>

            <div className="space-y-2 text-sm">
              <p className="text-gray-300">
                Nome: <span className="text-white">{displayName}</span>
              </p>
              <p className="text-gray-300">
                Email: <span className="text-white">{profile?.email || "Nao informado"}</span>
              </p>
              <p className="text-gray-300">
                User ID: <span className="text-white">{session.userId}</span>
              </p>
              <p className="text-gray-300">
                Wallet ID ativa: <span className="text-white">{session.walletId}</span>
              </p>
            </div>
          </div>

          <div className="bg-white/5 p-5 rounded-2xl">
            <h2 className="text-xl mb-4">Minhas Carteiras</h2>

            {accountLoading ? (
              <p className="text-gray-400 text-sm">Carregando carteiras vinculadas...</p>
            ) : accountError ? (
              <p className="text-red-400 text-sm">{accountError}</p>
            ) : wallets.length === 0 ? (
              <p className="text-gray-400 text-sm">Nenhuma carteira vinculada ainda.</p>
            ) : (
              <div className="space-y-3">
                {wallets.map((wallet) => (
                  <div
                    key={wallet.id}
                    className={`rounded-xl border p-4 ${
                      wallet.address === session.address.toLowerCase()
                        ? "border-purple-500/60 bg-purple-500/10"
                        : "border-white/10 bg-black/20"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">
                          {wallet.nickname || shortenAddress(wallet.address)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {shortenAddress(wallet.address)} • {wallet.chain}
                        </p>
                      </div>

                      <div className="text-right text-xs">
                        {wallet.is_primary && (
                          <p className="text-purple-300">Principal</p>
                        )}
                        <p className="text-gray-400">
                          {wallet.provider || wallet.wallet_type}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="bg-white/5 p-5 rounded-2xl space-y-4">
          <div>
            <h2 className="text-xl">Conectar Binance Exchange</h2>
            <p className="text-sm text-gray-400">
              Use uma API key read-only da sua conta Binance. Esse fluxo nao depende de extensao no navegador.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm text-gray-300">Label</span>
              <input
                value={binanceLabel}
                onChange={(event) => setBinanceLabel(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
                placeholder="Minha Binance"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-gray-300">API Key</span>
              <input
                value={binanceApiKey}
                onChange={(event) => setBinanceApiKey(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
                placeholder="Cole sua API key"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-gray-300">API Secret</span>
              <input
                value={binanceApiSecret}
                onChange={(event) => setBinanceApiSecret(event.target.value)}
                type="password"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
                placeholder="Cole sua API secret"
              />
            </label>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-gray-500">
              Recomendado: crie uma key somente leitura na Binance, sem saque e sem permissao de trade.
            </p>

            <button
              onClick={handleConnectBinanceExchange}
              className="bg-yellow-500 text-black px-5 py-3 rounded-lg disabled:opacity-60"
              disabled={binanceLoading}
            >
              {binanceLoading ? "Validando Binance..." : "Conectar Binance"}
            </button>
          </div>

          {binanceError && <p className="text-sm text-red-400">{binanceError}</p>}
          {binanceSuccess && (
            <p className="text-sm text-emerald-300">{binanceSuccess}</p>
          )}

          {exchangeAccounts.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg">Exchanges conectadas</h3>

              {exchangeAccounts.map((account) => {
                const balances = exchangeBalances[account.id]

                return (
                  <div
                    key={account.id}
                    className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium text-white">
                          {account.label || "Exchange"}
                        </p>
                        <p className="text-xs text-gray-400">
                          {account.exchange_name} • {account.api_key_hint || "Key protegida"}
                        </p>
                      </div>

                      <p className="text-xs text-emerald-300">
                        {account.status}
                      </p>
                    </div>

                    {balances ? (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-400">
                          Permissoes: {balances.permissions.join(", ") || "read-only"}
                        </p>
                        {balances.balances.length === 0 ? (
                          <p className="text-sm text-gray-400">
                            Nenhum saldo disponivel encontrado nesta conta.
                          </p>
                        ) : (
                          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {balances.balances.map((balance) => (
                              <div
                                key={`${account.id}-${balance.asset}`}
                                className="rounded-lg border border-white/10 bg-white/5 p-3"
                              >
                                <p className="font-medium">{balance.asset}</p>
                                <p className="text-sm text-gray-300">
                                  Total: {balance.total}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Livre: {balance.free} • Bloqueado: {balance.locked}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">
                        Carregando saldos da exchange...
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="bg-white/5 p-5 rounded-2xl space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl">Adicionar Nova Carteira</h2>
              <p className="text-sm text-gray-400">
                Conecte outra wallet self-custody e assine a solicitacao para vincular ela a esta conta.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleConnectWalletForLink("metaMask")}
                className="bg-purple-600 px-5 py-2 rounded-lg disabled:opacity-60"
                disabled={linkingWallet}
              >
                MetaMask
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Para conta da corretora Binance, use a secao Conectar Binance Exchange acima. WalletConnect entra na proxima rodada para outras wallets.
          </p>

          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm text-gray-300">
              Wallet selecionada para vinculo:{" "}
              <span className="text-white">
                {linkWalletType === "metaMask" ? "MetaMask" : "Nenhuma"}
              </span>
            </p>
            <p className="text-sm text-gray-300">
              Endereco conectado para vinculo:{" "}
              <span className="text-white">
                {connectedAddress ? shortenAddress(connectedAddress) : "Nenhum"}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleLinkCurrentWallet}
              className="bg-green-600 px-6 py-3 rounded-xl disabled:opacity-60"
              disabled={!connectedAddress || !linkWalletType || linkingWallet}
            >
              {linkingWallet ? "Vinculando..." : "Vincular carteira atual"}
            </button>
            <button
              onClick={async () => {
                setLinkWalletType(null)
                setLinkWalletError("")
                setLinkWalletSuccess("")
                try {
                  await disconnectAsync()
                } catch (err) {
                  console.error(err)
                }
              }}
              className="bg-white/10 px-6 py-3 rounded-xl disabled:opacity-60"
              disabled={linkingWallet}
            >
              Cancelar
            </button>
          </div>

          {linkWalletError && (
            <p className="text-sm text-red-400">{linkWalletError}</p>
          )}
          {linkWalletSuccess && (
            <p className="text-sm text-green-400">{linkWalletSuccess}</p>
          )}
        </section>

        <section>
          <h2 className="text-xl mb-4">Transações</h2>

          {session.transactions.length === 0 ? (
            <p className="text-gray-500">Nenhuma transação carregada.</p>
          ) : (
            <div className="space-y-3">
              {session.transactions.map((tx, index) => {
                const formatted = formatTransaction(tx, session.address)

                return (
                  <div
                    key={`${tx.from}-${tx.to}-${index}`}
                    className="flex justify-between bg-white/5 p-4 rounded-xl"
                  >
                    <div>
                      <p>{formatted.type}</p>
                      <p className="text-xs text-gray-400">
                        {shortenAddress(formatted.counterparty)}
                      </p>
                    </div>

                    <p
                      className={
                        formatted.value.startsWith("-")
                          ? "text-red-400"
                          : "text-green-400"
                      }
                    >
                      {formatted.value}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="bg-white/5 p-4 rounded-xl">
          <h2 className="text-xl mb-2 text-purple-400">Insights da IA</h2>
          <p className="text-sm text-gray-300 whitespace-pre-line">
            {session.analysis || "A análise ainda não foi carregada."}
          </p>
        </section>
      </div>
    </main>
  )
}
