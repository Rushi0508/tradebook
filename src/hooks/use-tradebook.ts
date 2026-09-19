"use client"

import { useLiveQuery } from "dexie-react-hooks"

import { db } from "@/lib/db"

export function useTradebook() {
  const trades = useLiveQuery(() => db.trades.toArray())
  const labels = useLiveQuery(() => db.labels.orderBy("name").toArray())

  if (!trades || !labels) return null
  return { trades, labels }
}
