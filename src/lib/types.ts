export type Side = "long" | "short"

export const INSTRUMENTS = ["stock", "option", "future", "crypto", "forex", "other"] as const
export type Instrument = (typeof INSTRUMENTS)[number]

export interface StopMove {
  date: string
  price: number
}

export interface TradeExit {
  id: string
  date: string
  price: number
  quantity: number
  fees: number
}

export interface Trade {
  id: string
  symbol: string
  instrument: Instrument
  side: Side
  quantity: number
  multiplier: number
  entryPrice: number
  stopLoss: number | null
  initialStop: number | null
  stopHistory: StopMove[]
  target: number | null
  entryDate: string
  exits: TradeExit[]
  fees: number
  labels: string[]
  notes: string
  underlying?: string | null
  exchange?: string | null
  createdAt: number
  updatedAt: number
}

export interface Label {
  id: string
  name: string
  color: string
}

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
