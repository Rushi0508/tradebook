export type InstrumentKind = "stock" | "option" | "future"

export type InstrumentRow = [
  symbol: string,
  name: string,
  kind: InstrumentKind,
  underlying: string | null,
  close: number | null,
  prevClose: number | null,
  lot: number,
  expiry: string | null,
  strike: number | null,
  optionType: "CE" | "PE" | null,
]

export interface MarketSnapshot {
  date: string
  instruments: InstrumentRow[]
}

export interface Instrument {
  symbol: string
  name: string
  kind: InstrumentKind
  underlying: string | null
  close: number | null
  prevClose: number | null
  lot: number
  expiry: string | null
  strike: number | null
  optionType: "CE" | "PE" | null
}

export function fromRow(row: InstrumentRow): Instrument {
  const [symbol, name, kind, underlying, close, prevClose, lot, expiry, strike, optionType] = row
  return { symbol, name, kind, underlying, close, prevClose, lot, expiry, strike, optionType }
}
