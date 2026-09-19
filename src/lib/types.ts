export type Side = "long" | "short"

export const INSTRUMENTS = ["stock", "option", "future", "crypto", "forex", "other"] as const
export type Instrument = (typeof INSTRUMENTS)[number]

export interface Trade {
  id: string
  symbol: string
  instrument: Instrument
  side: Side
  quantity: number
  multiplier: number
  entryPrice: number
  stopLoss: number | null
  target: number | null
  entryDate: string
  exitPrice: number | null
  exitDate: string | null
  fees: number
  labels: string[]
  notes: string
  createdAt: number
  updatedAt: number
}

export interface Label {
  id: string
  name: string
  color: string
}

export interface Settings {
  id: "app"
  capital: number
  currency: string
}

export const DEFAULT_SETTINGS: Settings = { id: "app", capital: 0, currency: "USD" }

export const LABEL_COLORS = [
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
] as const
