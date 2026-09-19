"use client"

import { useCallback, useEffect, useState } from "react"
import { useLiveQuery } from "dexie-react-hooks"

import { db } from "@/lib/db"
import { getMarketMeta, syncMarketData } from "@/lib/market/sync"
import type { Instrument } from "@/lib/market/types"

const CHECK_INTERVAL_MS = 15 * 60 * 1000

export function useMarketSync() {
  const meta = useLiveQuery(getMarketMeta)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sync = useCallback(async (force = false) => {
    setSyncing(true)
    try {
      await syncMarketData({ force })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh prices")
    } finally {
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    const run = () => void sync()
    const initial = setTimeout(run, 0)
    const interval = setInterval(run, CHECK_INTERVAL_MS)
    return () => {
      clearTimeout(initial)
      clearInterval(interval)
    }
  }, [sync])

  return { date: meta?.date ?? null, syncing, error, refresh: () => sync(true) }
}

export function useQuotes(symbols: string[]) {
  const key = [...new Set(symbols)].sort().join("|")
  return useLiveQuery(
    async () => {
      const list = key ? key.split("|") : []
      const rows = await db.instruments.bulkGet(list)
      return new Map(rows.filter((row): row is Instrument => !!row).map((row) => [row.symbol, row]))
    },
    [key],
    new Map<string, Instrument>()
  )
}
