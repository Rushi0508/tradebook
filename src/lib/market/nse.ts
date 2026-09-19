import "server-only"

import { unzipSync, strFromU8 } from "fflate"

import type { InstrumentRow, MarketSnapshot } from "@/lib/market/types"

const ARCHIVE = "https://nsearchives.nseindia.com/content"
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"
const EQUITY_SERIES = new Set(["EQ", "BE", "BZ", "SM", "ST"])
const LOOKBACK_DAYS = 10

function compact(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "")
}

function istToday() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000)
}

async function download(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, cache: "no-store" })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`NSE responded with ${res.status}`)
  const files = unzipSync(new Uint8Array(await res.arrayBuffer()))
  const csv = Object.values(files)[0]
  return csv ? strFromU8(csv) : null
}

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/)
  const header = lines[0].split(",")
  const index = Object.fromEntries(header.map((name, i) => [name, i]))
  return { rows: lines.slice(1).map((line) => line.split(",")), index }
}

function toNumber(value: string | undefined) {
  const parsed = Number(value)
  return value && Number.isFinite(parsed) ? parsed : null
}

function parseEquities(text: string): InstrumentRow[] {
  const { rows, index } = parseCsv(text)
  const bySymbol = new Map<string, InstrumentRow>()
  for (const row of rows) {
    const series = row[index.SctySrs]
    if (!EQUITY_SERIES.has(series)) continue
    const symbol = row[index.TckrSymb]
    if (bySymbol.has(symbol) && series !== "EQ") continue
    bySymbol.set(symbol, [
      symbol,
      row[index.FinInstrmNm],
      "stock",
      null,
      toNumber(row[index.ClsPric]),
      toNumber(row[index.PrvsClsgPric]),
      toNumber(row[index.NewBrdLotQty]) ?? 1,
      null,
      null,
      null,
    ])
  }
  return [...bySymbol.values()]
}

function parseDerivatives(text: string): InstrumentRow[] {
  const { rows, index } = parseCsv(text)
  const result: InstrumentRow[] = []
  for (const row of rows) {
    const type = row[index.FinInstrmTp]
    const isOption = type === "IDO" || type === "STO"
    const isFuture = type === "IDF" || type === "STF"
    if (!isOption && !isFuture) continue
    const underlying = row[index.TckrSymb]
    result.push([
      row[index.FinInstrmNm],
      underlying,
      isOption ? "option" : "future",
      underlying,
      toNumber(row[index.ClsPric]),
      toNumber(row[index.PrvsClsgPric]),
      toNumber(row[index.NewBrdLotQty]) ?? 1,
      row[index.XpryDt] || null,
      isOption ? toNumber(row[index.StrkPric]) : null,
      isOption ? (row[index.OptnTp] as "CE" | "PE") : null,
    ])
  }
  return result
}

let cached: { snapshot: MarketSnapshot; fetchedAt: number } | null = null
const CACHE_MS = 30 * 60 * 1000

export async function getLatestSnapshot(): Promise<MarketSnapshot> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached.snapshot

  const day = istToday()
  for (let i = 0; i < LOOKBACK_DAYS; i++) {
    const date = new Date(day.getTime() - i * 24 * 60 * 60 * 1000)
    const weekday = date.getUTCDay()
    if (weekday === 0 || weekday === 6) continue

    const stamp = compact(date)
    const equities = await download(`${ARCHIVE}/cm/BhavCopy_NSE_CM_0_0_0_${stamp}_F_0000.csv.zip`)
    if (!equities) continue
    const derivatives = await download(`${ARCHIVE}/fo/BhavCopy_NSE_FO_0_0_0_${stamp}_F_0000.csv.zip`)

    const snapshot: MarketSnapshot = {
      date: date.toISOString().slice(0, 10),
      instruments: [...parseEquities(equities), ...(derivatives ? parseDerivatives(derivatives) : [])],
    }
    cached = { snapshot, fetchedAt: Date.now() }
    return snapshot
  }
  throw new Error("No NSE bhav copy found in the last 10 days")
}
