"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi"

import {
  AnalyzeTransactionsResponse,
  authHeaders,
  api,
  AuthMessageResponse,
  formatTransaction,
  loadSession,
  RawTransaction,
  saveSession,
  VerifyAuthResponse,
  WalletTransactionsResponse,
} from "@/lib/codexyn"
import {
  AppAuthSession,
  clearAuthSession,
  loadAuthSession,
  subscribeToAuthChanges,
  signInWithEmail,
  signUpWithEmail,
} from "@/lib/supabase-auth"

type WalletOption = "metaMask"

const walletDetails: Record<
  WalletOption,
  {
    label: string
    buttonLabel: string
    accentClass: string
    iconClass: string
    iconLabel: string
  }
> = {
  metaMask: {
    label: "MetaMask",
    buttonLabel: "Conectar com MetaMask",
    accentClass: "border-purple-500/60 bg-purple-500/10 text-purple-200",
    iconClass: "bg-purple-500 text-white",
    iconLabel: "M",
  },
}

export default function Home() {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnectAsync } = useDisconnect()
  const { signMessageAsync } = useSignMessage()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [checkingSession, setCheckingSession] = useState(true)
  const [selectedWallet, setSelectedWallet] = useState<WalletOption | null>(null)
  const [authSession, setAuthSession] = useState<AppAuthSession | null>(null)
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin")
  const [authNotice, setAuthNotice] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const metaMaskConnector =
    connectors.find((connector) => connector.id === "metaMask") ?? null
  useEffect(() => {
    let ignore = false
    const session = loadSession()
    const subscription = subscribeToAuthChanges((nextSession) => {
      if (!ignore) {
        setAuthSession(nextSession)
      }
    })

    const bootstrapAuth = async () => {
      try {
        const appAuth = await loadAuthSession()

        if (ignore) return

        setAuthSession(appAuth)

        if (session) {
          router.replace("/dashboard")
          return
        }
      } catch (err) {
        console.error(err)

        if (!ignore) {
          setError("Nao foi possivel restaurar sua sessao de conta.")
        }
      } finally {
        if (!ignore) {
          setCheckingSession(false)
        }
      }
    }

    bootstrapAuth()

    return () => {
      ignore = true
      subscription.unsubscribe()
    }
  }, [router])

  const handleAccountAuth = async () => {
    setError("")
    setAuthNotice("")

    if (!email || !password) {
      setError("Preencha email e senha para entrar na sua conta.")
      return
    }

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail.includes("@")) {
      setError("Informe um email valido para continuar.")
      return
    }

    if (password.length < 8) {
      setError("Use uma senha com pelo menos 8 caracteres.")
      return
    }

    if (authMode === "signup" && password !== confirmPassword) {
      setError("A confirmacao de senha nao confere.")
      return
    }

    try {
      setLoading(true)

      if (authMode === "signin") {
        const session = await signInWithEmail(normalizedEmail, password)
        setAuthSession(session)
        setPassword("")
        setConfirmPassword("")
        return
      }

      const signUpResult = await signUpWithEmail(normalizedEmail, password)

      if (signUpResult.session) {
        setAuthSession(signUpResult.session)
        setAuthNotice("Conta criada com sucesso. Agora conecte sua primeira wallet.")
      } else {
        setAuthMode("signin")
        setPassword("")
        setConfirmPassword("")
        setAuthNotice(
          "Conta criada. Confirme seu email no Supabase antes de entrar."
        )
      }
    } catch (err) {
      console.error(err)
      setError(
        authMode === "signin"
          ? "Nao foi possivel entrar com email e senha."
          : "Nao foi possivel criar sua conta agora."
      )
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async (wallet: WalletOption) => {
    setError("")
    setSelectedWallet(wallet)

    if (!connectors.length) {
      setError("Nenhuma wallet compatível foi encontrada no navegador.")
      return
    }

    try {
      const connector = metaMaskConnector

      if (!connector) {
        setError("MetaMask não está disponível neste navegador.")
        return
      }

      const provider = await connector.getProvider()

      if (!provider) {
        setError("Instale ou habilite a MetaMask para continuar.")
        return
      }

      await connect({ connector })
    } catch {
      setError("Não foi possível conectar a MetaMask.")
    }
  }

  const handleLogin = async () => {
    setError("")

    if (!address) {
      setError("Conecte uma wallet antes de entrar.")
      return
    }

    if (!authSession) {
      setError("Entre na sua conta antes de conectar a wallet.")
      return
    }

    try {
      setLoading(true)

      const { data: authMessage } = await api.get<AuthMessageResponse>(
        "/auth/message",
        {
          params: { address },
        }
      )

      const signature = await signMessageAsync({
        message: authMessage.message,
      })

      const authResponse = await api.post<VerifyAuthResponse>(
        "/auth/verify",
        {
          message: authMessage.message,
          address,
          signature,
        },
        {
          headers: authHeaders(authSession.accessToken),
        }
      )

      const { data: walletData } = await api.get<WalletTransactionsResponse>(
        "/wallet/transactions",
        {
          params: { address },
        }
      )

      const transactions: RawTransaction[] = walletData.transactions

      const { data: aiData } = await api.post<AnalyzeTransactionsResponse>(
        "/ai/analyze",
        {
          transactions: transactions.map((tx) => {
            const formatted = formatTransaction(tx, address)

            return {
              type: formatted.type,
              value: formatted.value,
            }
          }),
        }
      )

      saveSession({
        userId: authResponse.data.user_id,
        walletId: authResponse.data.wallet_id,
        appUserId: authSession.user.id,
        appUserEmail: authSession.user.email,
        address,
        token: authResponse.data.token,
        transactions,
        analysis: aiData.analysis,
      })

      router.push("/dashboard")
    } catch (err: unknown) {
      console.error(err)
      setError(
        "Não foi possível concluir o login. Verifique a wallet e o backend."
      )
    } finally {
      setLoading(false)
    }
  }

  const handleSwitchWallet = async () => {
    setError("")

    try {
      if (isConnected) {
        await disconnectAsync()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSelectedWallet(null)
    }
  }

  const handleSignOutAccount = async () => {
    try {
      await clearAuthSession()
    } catch (err) {
      console.error(err)
      setError("Nao foi possivel encerrar a sessao da conta.")
      return
    }

    setAuthSession(null)
    setSelectedWallet(null)
    setEmail("")
    setPassword("")
    setConfirmPassword("")
    setAuthNotice("")
    setError("")

    try {
      if (isConnected) {
        await disconnectAsync()
      }
    } catch (err) {
      console.error(err)
    }
  }

  if (checkingSession) {
    return (
      <main className="bg-black text-white min-h-screen flex items-center justify-center px-6">
        <p className="text-gray-400">Carregando...</p>
      </main>
    )
  }

  const selectedWalletDetails =
    selectedWallet ? walletDetails[selectedWallet] : null

  const walletAddressPreview =
    address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""

  return (
    <main className="bg-black text-white min-h-screen">
      <header className="flex justify-between items-center px-10 py-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="logo" width={60} height={60} />
          <span className="font-bold text-xl">
            Code<span className="text-purple-500">Xyn</span>
          </span>
        </div>

        {!authSession ? (
          <button
            onClick={() =>
              setAuthMode((current) => (current === "signin" ? "signup" : "signin"))
            }
            className="bg-white/10 px-5 py-2 rounded-lg disabled:opacity-60"
            disabled={loading}
          >
            {authMode === "signin" ? "Criar conta" : "Tenho conta"}
          </button>
        ) : !isConnected ? (
          <div className="flex gap-3">
            <button
              onClick={() => handleConnect("metaMask")}
              className="bg-purple-600 px-5 py-2 rounded-lg disabled:opacity-60"
              disabled={loading}
            >
              MetaMask
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={handleSwitchWallet}
              className="bg-white/10 px-5 py-2 rounded-lg disabled:opacity-60"
              disabled={loading}
            >
              Trocar wallet
            </button>
            <button
              onClick={handleLogin}
              className="bg-green-600 px-5 py-2 rounded-lg disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </div>
        )}
      </header>

      <section className="text-center py-32 px-6">
        <div className="flex justify-center mb-6">
          <Image src="/logo.png" alt="logo" width={120} height={120} />
        </div>

        <h1 className="text-5xl font-bold mb-6">
          Sua inteligência na <span className="text-purple-500">Web3</span>
        </h1>

        <p className="text-gray-400 mb-8">
          Gerencie, entenda e tome decisões com IA sobre suas criptomoedas.
        </p>

        <p className="text-sm text-gray-500 mb-6">
          Primeiro entre na sua conta. Depois conecte as wallets que deseja centralizar.
        </p>

        <p className="text-xs text-gray-500 mb-6">
          Conta Binance de exchange agora e conectada no dashboard por API read-only, sem depender de extensao.
        </p>

        {authNotice && <p className="mb-6 text-sm text-emerald-300">{authNotice}</p>}

        {!authSession ? (
          <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-left">
            <div>
              <h2 className="text-2xl font-semibold">
                {authMode === "signin" ? "Entrar na conta" : "Criar conta"}
              </h2>
              <p className="text-sm text-gray-400 mt-2">
                Sua conta organiza wallets, exchanges e historico em um unico lugar.
              </p>
            </div>

            <label className="block space-y-2">
              <span className="text-sm text-gray-300">Email</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
                placeholder="voce@exemplo.com"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-gray-300">Senha</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
                placeholder="Sua senha"
              />
            </label>

            {authMode === "signup" && (
              <label className="block space-y-2">
                <span className="text-sm text-gray-300">Confirmar senha</span>
                <input
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type="password"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
                  placeholder="Repita sua senha"
                />
              </label>
            )}

            <p className="text-xs text-gray-500">
              Use uma senha com pelo menos 8 caracteres. No cadastro, a conta pode exigir confirmacao por email.
            </p>

            <button
              onClick={handleAccountAuth}
              className="w-full bg-white text-black px-8 py-4 rounded-xl disabled:opacity-60"
              disabled={loading}
            >
              {loading
                ? authMode === "signin"
                  ? "Entrando..."
                  : "Criando conta..."
                : authMode === "signin"
                  ? "Entrar com email"
                  : "Criar conta"}
            </button>

            <button
              onClick={() =>
                setAuthMode((current) => (current === "signin" ? "signup" : "signin"))
              }
              className="w-full bg-white/10 px-8 py-4 rounded-xl disabled:opacity-60"
              disabled={loading}
            >
              {authMode === "signin"
                ? "Ainda nao tenho conta"
                : "Ja tenho conta"}
            </button>
          </div>
        ) : !isConnected ? (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/5 p-5 text-left">
              <p className="text-sm uppercase tracking-[0.2em] text-white/60">
                Conta ativa
              </p>
              <p className="text-lg font-semibold mt-2">
                {authSession.user.email || authSession.user.id}
              </p>
              <button
                onClick={handleSignOutAccount}
                className="mt-4 bg-white/10 px-4 py-2 rounded-lg disabled:opacity-60"
                disabled={loading}
              >
                Sair da conta
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-1">
              {(["metaMask"] as WalletOption[]).map((wallet) => {
                const details = walletDetails[wallet]
                const isSelected = selectedWallet === wallet

                return (
                  <button
                    key={wallet}
                    onClick={() => handleConnect(wallet)}
                    className={`rounded-2xl border px-6 py-5 text-left transition disabled:opacity-60 ${
                      isSelected
                        ? details.accentClass
                        : "border-white/10 bg-white/5 hover:bg-white/8"
                    }`}
                    disabled={loading}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold ${details.iconClass}`}
                      >
                        {details.iconLabel}
                      </div>

                      <div>
                        <p className="text-lg font-semibold">{details.label}</p>
                        <p className="text-sm text-gray-400">
                          {isSelected
                            ? "Selecionada para conexão"
                            : "Clique para escolher esta wallet"}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            {selectedWalletDetails && (
              <div
                className={`mx-auto max-w-md rounded-2xl border px-5 py-4 text-left ${selectedWalletDetails.accentClass}`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold ${selectedWalletDetails.iconClass}`}
                  >
                    {selectedWalletDetails.iconLabel}
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-white/70">
                      Wallet escolhida
                    </p>
                    <p className="text-lg font-semibold">
                      {selectedWalletDetails.label}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/5 p-5 text-left">
              <p className="text-sm uppercase tracking-[0.2em] text-white/60">
                Conta ativa
              </p>
              <p className="text-lg font-semibold mt-2">
                {authSession.user.email || authSession.user.id}
              </p>
              <button
                onClick={handleSignOutAccount}
                className="mt-4 bg-white/10 px-4 py-2 rounded-lg disabled:opacity-60"
                disabled={loading}
              >
                Sair da conta
              </button>
            </div>

            {selectedWalletDetails && (
              <div
                className={`mx-auto max-w-md rounded-2xl border px-5 py-4 text-left ${selectedWalletDetails.accentClass}`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold ${selectedWalletDetails.iconClass}`}
                  >
                    {selectedWalletDetails.iconLabel}
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-[0.2em] text-white/70">
                      Wallet conectada
                    </p>
                    <p className="text-lg font-semibold">
                      {selectedWalletDetails.label}
                    </p>
                    <p className="text-sm text-white/70">{walletAddressPreview}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-center gap-3">
              <button
                onClick={handleSwitchWallet}
                className="bg-white/10 px-6 py-3 rounded-xl disabled:opacity-60"
                disabled={loading}
              >
                Trocar wallet
              </button>

              <button
                onClick={handleLogin}
                className="bg-green-600 px-8 py-4 rounded-xl disabled:opacity-60"
                disabled={loading}
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-6 text-sm text-red-400">{error}</p>}
      </section>
    </main>
  )
}
