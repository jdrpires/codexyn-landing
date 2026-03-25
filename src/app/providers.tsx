"use client"

import { createConfig, WagmiProvider } from "wagmi"
import { mainnet } from "wagmi/chains"
import { http } from "viem"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { injected } from "wagmi/connectors"

const config = createConfig({
  chains: [mainnet],
  connectors: [
    injected({
      target: "metaMask", // 🔥 IMPORTANTE
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