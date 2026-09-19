"use client"

import { useState } from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"

const TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_KEY
const missing = new Set<string>()

export function logoTicker(symbol: string, underlying?: string | null, exchange?: string | null) {
  const base = underlying || symbol
  return exchange === "NSE" ? `${base}.NS` : base
}

interface SymbolLogoProps {
  ticker: string
  size?: number
  className?: string
}

export function SymbolLogo(props: SymbolLogoProps) {
  return <LogoImage key={props.ticker} {...props} />
}

function LogoImage({ ticker, size = 20, className }: SymbolLogoProps) {
  const [failed, setFailed] = useState(() => !TOKEN || missing.has(ticker))
  const initials = ticker.replace(/\.NS$/, "").slice(0, 2)

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-[0.5625rem] font-semibold text-muted-foreground uppercase ring-1 ring-foreground/10",
        className
      )}
      style={{ width: size, height: size }}
    >
      {failed ? (
        initials
      ) : (
        <Image
          unoptimized
          src={`https://img.logo.dev/ticker/${encodeURIComponent(ticker)}?token=${TOKEN}&size=${size * 2}&format=png&fallback=404`}
          alt=""
          width={size}
          height={size}
          className="size-full bg-white object-contain"
          onError={() => {
            missing.add(ticker)
            setFailed(true)
          }}
        />
      )}
    </span>
  )
}
