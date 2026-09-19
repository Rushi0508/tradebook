import Dexie, { type EntityTable } from "dexie"

import type { Instrument } from "@/lib/market/types"
import { DEFAULT_SETTINGS, LABEL_COLORS, type Label, type Settings, type Trade } from "@/lib/types"

export interface MetaEntry {
  key: string
  value: unknown
}

export const db = new Dexie("tradebook") as Dexie & {
  trades: EntityTable<Trade, "id">
  labels: EntityTable<Label, "id">
  settings: EntityTable<Settings, "id">
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

export function closeTrade(id: string, exitPrice: number, exitDate: string, fees: number) {
  return db.trades.update(id, { exitPrice, exitDate, fees, updatedAt: Date.now() })
}

export function reopenTrade(id: string) {
  return db.trades.update(id, { exitPrice: null, exitDate: null, updatedAt: Date.now() })
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

export async function getSettings() {
  return (await db.settings.get("app")) ?? DEFAULT_SETTINGS
}

export function saveSettings(changes: Partial<Omit<Settings, "id">>) {
  return db.settings.put({ ...DEFAULT_SETTINGS, ...changes, id: "app" })
}

const BACKUP_VERSION = 1

export interface Backup {
  app: "tradebook"
  version: number
  exportedAt: string
  trades: Trade[]
  labels: Label[]
  settings: Settings[]
}

export async function exportBackup(): Promise<Backup> {
  const [trades, labels, settings] = await Promise.all([
    db.trades.toArray(),
    db.labels.toArray(),
    db.settings.toArray(),
  ])
  return {
    app: "tradebook",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    trades,
    labels,
    settings,
  }
}

export async function importBackup(data: unknown) {
  const backup = data as Partial<Backup>
  if (backup?.app !== "tradebook" || !Array.isArray(backup.trades) || !Array.isArray(backup.labels)) {
    throw new Error("This file is not a TradeBook backup")
  }
  await db.transaction("rw", db.trades, db.labels, db.settings, async () => {
    await Promise.all([db.trades.clear(), db.labels.clear(), db.settings.clear()])
    await db.labels.bulkAdd(backup.labels!)
    await db.trades.bulkAdd(backup.trades!)
    if (Array.isArray(backup.settings)) await db.settings.bulkAdd(backup.settings)
  })
  return { trades: backup.trades.length, labels: backup.labels.length }
}
