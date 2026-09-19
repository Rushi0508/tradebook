const INDEX_SYMBOLS: Record<string, string> = {
  NIFTY: "NSE:NIFTY",
  BANKNIFTY: "NSE:BANKNIFTY",
  FINNIFTY: "NSE:CNXFINANCE",
  MIDCPNIFTY: "NSE:NIFTY_MID_SELECT",
  NIFTYNXT50: "NSE:NIFTYJR",
  SENSEX: "BSE:SENSEX",
  BANKEX: "BSE:BANK",
}

export function tradingViewSymbol(symbol: string, underlying?: string | null, exchange?: string | null) {
  const base = underlying || symbol
  return INDEX_SYMBOLS[base] ?? `${exchange === "BSE" ? "BSE" : "NSE"}:${base.replaceAll("-", "_")}`
}

export function tradingViewUrl(symbol: string, underlying?: string | null, exchange?: string | null) {
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tradingViewSymbol(symbol, underlying, exchange))}`
}
