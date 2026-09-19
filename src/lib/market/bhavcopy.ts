import "server-only"

import { unzipSync, strFromU8 } from "fflate"

import type { Exchange, InstrumentRow, MarketSnapshot } from "@/lib/market/types"

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"
const NSE_EQUITY_SERIES = new Set(["EQ", "BE", "BZ", "SM", "ST"])
const BSE_EXCLUDED_GROUPS = new Set(["G"])
const LOOKBACK_DAYS = 10

const SOURCES = {
  nseEquity: (stamp: string) =>
    `https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_${stamp}_F_0000.csv.zip`,
  nseDerivatives: (stamp: string) =>
    `https://nsearchives.nseindia.com/content/fo/BhavCopy_NSE_FO_0_0_0_${stamp}_F_0000.csv.zip`,
  bseEquity: (stamp: string) =>
    `https://www.bseindia.com/download/BhavCopy/Equity/BhavCopy_BSE_CM_0_0_0_${stamp}_F_0000.CSV`,
  bseDerivatives: (stamp: string) =>
    `https://www.bseindia.com/download/Bhavcopy/Derivative/BhavCopy_BSE_FO_0_0_0_${stamp}_F_0000.CSV`,
}

function compact(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "")
}

function istToday() {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000)
}

async function download(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, cache: "no-store" })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`${new URL(url).hostname} responded with ${res.status}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  const text = url.endsWith(".zip") ? strFromU8(Object.values(unzipSync(bytes))[0] ?? new Uint8Array()) : strFromU8(bytes)
  return text.startsWith("TradDt,") ? text : null
}

async function tryDownload(url: string) {
  try {
    return await download(url)
  } catch {
    return null
  }
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

interface Equity {
  isin: string
  row: InstrumentRow
}

function parseEquities(text: string, exchange: Exchange): Equity[] {
  const { rows, index } = parseCsv(text)
  const bySymbol = new Map<string, Equity>()
  for (const row of rows) {
    if (row[index.FinInstrmTp] !== "STK") continue
    const series = row[index.SctySrs]
    if (exchange === "NSE" ? !NSE_EQUITY_SERIES.has(series) : BSE_EXCLUDED_GROUPS.has(series)) continue
    const symbol = row[index.TckrSymb]
    if (bySymbol.has(symbol) && series !== "EQ") continue
    bySymbol.set(symbol, {
      isin: row[index.ISIN],
      row: [
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
        exchange,
      ],
    })
  }
  return [...bySymbol.values()]
}

function parseDerivatives(text: string, exchange: Exchange): InstrumentRow[] {
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
      exchange,
    ])
  }
  return result
}

function merge(nseEquities: Equity[], nseDerivatives: InstrumentRow[], bseEquities: Equity[], bseDerivatives: InstrumentRow[]) {
  const listedOnNse = new Set(nseEquities.map((equity) => equity.isin))
  const instruments = [...nseEquities.map((equity) => equity.row), ...nseDerivatives]
  const symbols = new Set(instruments.map((row) => row[0]))
  const bseOnly = [
    ...bseEquities.filter((equity) => !listedOnNse.has(equity.isin)).map((equity) => equity.row),
    ...bseDerivatives,
  ]
  for (const row of bseOnly) {
    if (symbols.has(row[0])) continue
    symbols.add(row[0])
    instruments.push(row)
  }
  return instruments
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
    const nseEquity = await download(SOURCES.nseEquity(stamp))
    if (!nseEquity) continue

    const [nseDerivatives, bseEquity, bseDerivatives] = await Promise.all([
      tryDownload(SOURCES.nseDerivatives(stamp)),
      tryDownload(SOURCES.bseEquity(stamp)),
      tryDownload(SOURCES.bseDerivatives(stamp)),
    ])

    const snapshot: MarketSnapshot = {
      date: date.toISOString().slice(0, 10),
      instruments: merge(
        parseEquities(nseEquity, "NSE"),
        nseDerivatives ? parseDerivatives(nseDerivatives, "NSE") : [],
        bseEquity ? parseEquities(bseEquity, "BSE") : [],
        bseDerivatives ? parseDerivatives(bseDerivatives, "BSE") : []
      ),
    }
    cached = { snapshot, fetchedAt: Date.now() }
    return snapshot
  }
  throw new Error("No bhav copy found in the last 10 days")
}
