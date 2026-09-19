import { db } from "@/lib/db"
import { fromRow, type MarketSnapshot } from "@/lib/market/types"

const PUBLISH_HOUR_IST = 17
const RETRY_MS = 60 * 60 * 1000

export interface MarketMeta {
  date: string | null
  checkedAt: number | null
}

function istParts(now: Date) {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
  return { ist, hour: ist.getUTCHours() }
}

export function expectedMarketDate(now = new Date()) {
  const { ist, hour } = istParts(now)
  const day = new Date(ist)
  if (hour < PUBLISH_HOUR_IST) day.setUTCDate(day.getUTCDate() - 1)
  while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day.setUTCDate(day.getUTCDate() - 1)
  return day.toISOString().slice(0, 10)
}

export async function getMarketMeta(): Promise<MarketMeta> {
  const entry = await db.meta.get("market")
  return (entry?.value as MarketMeta) ?? { date: null, checkedAt: null }
}

export async function syncMarketData({ force = false } = {}) {
  const meta = await getMarketMeta()
  const expected = expectedMarketDate()
  const upToDate = meta.date !== null && meta.date >= expected
  const recentlyChecked = meta.checkedAt !== null && Date.now() - meta.checkedAt < RETRY_MS
  if (!force && (upToDate || (meta.date !== null && recentlyChecked))) return { updated: false, date: meta.date }

  const res = await fetch("/api/market")
  const body = (await res.json()) as MarketSnapshot | { error: string }
  if (!res.ok || "error" in body) throw new Error("error" in body ? body.error : `Request failed (${res.status})`)

  const changed = body.date !== meta.date
  await db.transaction("rw", db.instruments, db.meta, async () => {
    if (changed) {
      await db.instruments.clear()
      await db.instruments.bulkPut(body.instruments.map(fromRow))
    }
    await db.meta.put({ key: "market", value: { date: body.date, checkedAt: Date.now() } satisfies MarketMeta })
  })
  return { updated: changed, date: body.date }
}
