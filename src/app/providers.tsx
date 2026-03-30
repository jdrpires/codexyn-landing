"use client"

import { createConfig, WagmiProvider } from "wagmi"
import { mainnet } from "wagmi/chains"
import { EIP1193Provider, http } from "viem"
import { injected } from "@wagmi/core"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

type InjectedProvider = EIP1193Provider & {
  isBinance?: boolean
  isBinanceChain?: boolean
  isBinanceWallet?: boolean
}

type WalletWindow = globalThis.Window & {
  BinanceChain?: InjectedProvider
  binanceChain?: InjectedProvider
  ethereum?: {
    providers?: InjectedProvider[]
  }
}

const config = createConfig({
  chains: [mainnet],
  multiInjectedProviderDiscovery: true,
  connectors: [
    injected({
      target: "metaMask",
    }),
    injected({
      target: {
        id: "binance",
        name: "Binance Wallet",
        provider(window) {
          const walletWindow = window as WalletWindow | undefined

          return (
            walletWindow?.BinanceChain ??
            walletWindow?.binanceChain ??
            walletWindow?.ethereum?.providers?.find(
              (provider) =>
                provider.isBinance ||
                provider.isBinanceChain ||
                provider.isBinanceWallet
            )
          )
        },
      },
      unstable_shimAsyncInject: 1_000,
    }),
  ],
  transports: {
    [mainnet.id]: http(),
  },
})

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}
