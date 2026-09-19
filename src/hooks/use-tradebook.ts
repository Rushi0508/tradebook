"use client"

import { useLiveQuery } from "dexie-react-hooks"

import { db } from "@/lib/db"
import { DEFAULT_SETTINGS } from "@/lib/types"

export function useTradebook() {
  const trades = useLiveQuery(() => db.trades.toArray())
  const labels = useLiveQuery(() => db.labels.orderBy("name").toArray())
  const settings = useLiveQuery(async () => (await db.settings.get("app")) ?? DEFAULT_SETTINGS)

  if (!trades || !labels || !settings) return null
  return { trades, labels, settings }
}
