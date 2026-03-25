"use client"

import { motion } from "framer-motion"
import { useAccount, useConnect, useSignMessage } from "wagmi"
import axios from "axios"
import { createPublicClient, http, formatEther } from "viem"
import { mainnet } from "viem/chains"
import { useEffect, useState } from "react"

export default function Home() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { signMessageAsync } = useSignMessage()

  const [balance, setBalance] = useState<string | null>(null)

  // cliente blockchain
  const client = createPublicClient({
    chain: mainnet,
    transport: http(),
  })

  // buscar saldo
  useEffect(() => {
    if (!address) return

    const fetchBalance = async () => {
      try {
        const value = await client.getBalance({
          address: address as `0x${string}`,
        })

        setBalance(formatEther(value))
      } catch (err) {
        console.error("Erro ao buscar saldo:", err)
      }
    }

    fetchBalance()
  }, [address])

  // login web3
  const handleLogin = async () => {
    if (!address) return

    try {
      const res = await axios.get(
        `http://127.0.0.1:8000/auth/message?address=${address}`
      )

      const message = res.data.message

      const signature = await signMessageAsync({ message })

      const verify = await axios.post(
        "http://127.0.0.1:8000/auth/verify",
        {
          message,
          signature,
          address,
        }
      )

      console.log("JWT:", verify.data.token)
      alert("Login realizado com sucesso 🚀")
    } catch (err) {
      console.error(err)
      alert("Erro no login")
    }
  }

  return (
    <main className="bg-black text-white min-h-screen font-sans overflow-hidden">

      {/* HERO */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 py-40 overflow-hidden">

        {/* GRID */}
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#ffffff10_1px,transparent_1px),linear-gradient(to_bottom,#ffffff10_1px,transparent_1px)] bg-[size:40px_40px]" />

        {/* GLOW */}
        <div className="absolute w-[900px] h-[900px] bg-purple-600 opacity-30 blur-[200px] rounded-full top-[-200px]" />
        <div className="absolute w-[700px] h-[700px] bg-blue-500 opacity-30 blur-[200px] rounded-full bottom-[-200px]" />

        {/* CONTENT */}
        <div className="relative z-10 flex flex-col items-center">

          {/* LOGO */}
          <motion.img
            src="/logo.png"
            alt="CodeXyn"
            className="w-40 mb-8 drop-shadow-[0_0_30px_rgba(139,92,246,0.7)]"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
          />

          {/* TITLE */}
          <motion.h1
            className="text-7xl font-extrabold mb-6"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span>Code</span>
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 text-transparent bg-clip-text">
              Xyn
            </span>
          </motion.h1>

          {/* SUBTITLE */}
          <p className="text-2xl text-gray-300 mb-6">
            Web3, sem complexidade.
          </p>

          {/* BOTÕES */}
          <div className="flex gap-4">

            {!isConnected && (
              <button
                onClick={async () => {
                  try {
                    await connectors[0].connect()
                  } catch (err) {
                    console.error(err)
                  }
                }}
                className="bg-purple-600 px-8 py-4 rounded-xl shadow-[0_0_30px_rgba(139,92,246,0.6)] hover:scale-105 transition"
              >
                Conectar Wallet
              </button>
            )}

            {isConnected && (
              <button
                onClick={handleLogin}
                className="bg-blue-600 px-8 py-4 rounded-xl hover:scale-105 transition"
              >
                Login Web3
              </button>
            )}

          </div>

          {/* INFO WALLET */}
          {isConnected && (
            <div className="mt-6 text-center">
              <p className="text-gray-400 text-sm">
                Conectado: {address}
              </p>

              {balance && (
                <p className="text-green-400 mt-2 text-lg">
                  💰 {parseFloat(balance).toFixed(4)} ETH
                </p>
              )}
            </div>
          )}

        </div>
      </section>

      {/* FEATURES */}
      <section className="px-6 py-24 max-w-6xl mx-auto grid md:grid-cols-3 gap-8">

        <div className="bg-white/5 p-8 rounded-2xl border border-white/10">
          <h3 className="text-xl text-purple-400 mb-2">
            🔐 Non-custodial
          </h3>
          <p className="text-gray-400">
            Controle total dos seus ativos.
          </p>
        </div>

        <div className="bg-white/5 p-8 rounded-2xl border border-white/10">
          <h3 className="text-xl text-purple-400 mb-2">
            ⚡ Transações rápidas
          </h3>
          <p className="text-gray-400">
            Simples como enviar um Pix.
          </p>
        </div>

        <div className="bg-white/5 p-8 rounded-2xl border border-white/10">
          <h3 className="text-xl text-purple-400 mb-2">
            🧠 Inteligência com IA
          </h3>
          <p className="text-gray-400">
            Insights automáticos da sua wallet.
          </p>
        </div>

      </section>

      {/* FOOTER */}
      <footer className="text-center text-gray-500 py-10">
        CodeXyn © {new Date().getFullYear()} — Code Synergy
      </footer>

    </main>
  )
}