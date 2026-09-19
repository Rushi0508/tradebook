import Dexie, { type EntityTable, type Transaction } from "dexie"

import type { Instrument } from "@/lib/market/types"
import { LABEL_COLORS, type Label, type StopMove, type Trade, type TradeExit } from "@/lib/types"

export interface MetaEntry {
  key: string
  value: unknown
}

export const db = new Dexie("tradebook") as Dexie & {
  trades: EntityTable<Trade, "id">
  labels: EntityTable<Label, "id">
  instruments: EntityTable<Instrument, "symbol">
  meta: EntityTable<MetaEntry, "key">
}

db.version(1).stores({
  trades: "id, symbol, entryDate, exitDate, *labels",
  labels: "id, &name",
  settings: "id",
})

db.version(2).stores({
  instruments: "symbol, underlying, kind",
  meta: "key",
})

db.version(3).stores({
  settings: null,
})

function upgradeTrades(tx: Transaction) {
  return tx
    .table("trades")
    .toCollection()
    .modify((trade: LegacyTrade, ref: { value: Trade }) => {
      ref.value = normalizeTrade(trade)
    })
}

db.version(4).stores({}).upgrade(upgradeTrades)

db.version(5)
  .stores({ trades: "id, symbol, entryDate, *labels" })
  .upgrade(upgradeTrades)

type LegacyTrade = Omit<Trade, "exits" | "initialStop" | "stopHistory"> &
  Partial<Pick<Trade, "exits" | "initialStop" | "stopHistory">> & {
    exitPrice?: number | null
    exitDate?: string | null
  }

export function normalizeTrade(legacy: LegacyTrade): Trade {
  const { exitPrice, exitDate, ...trade } = legacy
  const hasStops = Array.isArray(trade.stopHistory) && trade.initialStop !== undefined
  return {
    ...trade,
    initialStop: hasStops ? trade.initialStop! : trade.stopLoss,
    stopHistory: hasStops
      ? trade.stopHistory!
      : trade.stopLoss === null
        ? []
        : [{ date: trade.entryDate, price: trade.stopLoss }],
    exits: Array.isArray(trade.exits)
      ? trade.exits
      : exitPrice != null && exitDate
        ? [{ id: crypto.randomUUID(), date: exitDate, price: exitPrice, quantity: trade.quantity, fees: 0 }]
        : [],
  }
}

export async function requestPersistentStorage() {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}

export type TradeInput = Omit<Trade, "id" | "createdAt" | "updatedAt">

export async function saveTrade(input: TradeInput, id?: string) {
  const now = Date.now()
  if (id) {
    await db.trades.update(id, { ...input, updatedAt: now })
    return id
  }
  const newId = crypto.randomUUID()
  await db.trades.add({ ...input, id: newId, createdAt: now, updatedAt: now })
  return newId
}

export async function addExit(id: string, exit: Omit<TradeExit, "id">) {
  await db.transaction("rw", db.trades, async () => {
    const trade = await db.trades.get(id)
    if (!trade) return
    const exits = [...trade.exits, { ...exit, id: crypto.randomUUID() }].sort((a, b) => a.date.localeCompare(b.date))
    await db.trades.update(id, { exits, updatedAt: Date.now() })
  })
}

export async function undoLastExit(id: string) {
  await db.transaction("rw", db.trades, async () => {
    const trade = await db.trades.get(id)
    if (!trade || !trade.exits.length) return
    await db.trades.update(id, { exits: trade.exits.slice(0, -1), updatedAt: Date.now() })
  })
}

export async function trailStop(id: string, move: StopMove) {
  await db.transaction("rw", db.trades, async () => {
    const trade = await db.trades.get(id)
    if (!trade) return
    const stopHistory = [...trade.stopHistory, move].sort((a, b) => a.date.localeCompare(b.date))
    await db.trades.update(id, {
      stopHistory,
      stopLoss: stopHistory[stopHistory.length - 1].price,
      initialStop: trade.initialStop ?? move.price,
      updatedAt: Date.now(),
    })
  })
}

export async function undoStopMove(id: string) {
  await db.transaction("rw", db.trades, async () => {
    const trade = await db.trades.get(id)
    if (!trade || trade.stopHistory.length < 2) return
    const stopHistory = trade.stopHistory.slice(0, -1)
    await db.trades.update(id, {
      stopHistory,
      stopLoss: stopHistory[stopHistory.length - 1].price,
      updatedAt: Date.now(),
    })
  })
}


export function deleteTrade(id: string) {
  return db.trades.delete(id)
}

export async function createLabel(name: string) {
  const trimmed = name.trim()
  const existing = await db.labels.where("name").equalsIgnoreCase(trimmed).first()
  if (existing) return existing
  const count = await db.labels.count()
  const label: Label = {
    id: crypto.randomUUID(),
    name: trimmed,
    color: LABEL_COLORS[count % LABEL_COLORS.length],
  }
  await db.labels.add(label)
  return label
}

export function updateLabel(id: string, changes: Partial<Omit<Label, "id">>) {
  return db.labels.update(id, changes)
}

export async function deleteLabel(id: string) {
  await db.transaction("rw", db.labels, db.trades, async () => {
    await db.trades
      .where("labels")
      .equals(id)
      .modify((trade) => {
        trade.labels = trade.labels.filter((labelId) => labelId !== id)
      })
    await db.labels.delete(id)
  })
}

const BACKUP_VERSION = 1

export interface Backup {
  app: "tradebook"
  version: number
  exportedAt: string
  trades: Trade[]
  labels: Label[]
}

export async function exportBackup(): Promise<Backup> {
  const [trades, labels] = await Promise.all([db.trades.toArray(), db.labels.toArray()])
  return {
    app: "tradebook",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    trades,
    labels,
  }
}

export async function importBackup(data: unknown) {
  const backup = data as Partial<Backup>
  if (backup?.app !== "tradebook" || !Array.isArray(backup.trades) || !Array.isArray(backup.labels)) {
    throw new Error("This file is not a TradeBook backup")
  }
  await db.transaction("rw", db.trades, db.labels, async () => {
    await Promise.all([db.trades.clear(), db.labels.clear()])
    await db.labels.bulkAdd(backup.labels!)
    await db.trades.bulkAdd((backup.trades as LegacyTrade[]).map(normalizeTrade))
  })
  return { trades: backup.trades.length, labels: backup.labels.length }
}
