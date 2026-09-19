"use client"

import { useState } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons"

import { LabelPicker } from "@/components/tradebook/label-picker"
import { SymbolPicker } from "@/components/tradebook/symbol-picker"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { StopHistory } from "@/components/tradebook/stop-history"
import { db, saveTrade, type TradeInput } from "@/lib/db"
import { formatMoney, formatNumber, formatRatio, pnlTone, todayIso } from "@/lib/format"
import type { Instrument as MarketInstrument } from "@/lib/market/types"
import {
  INSTRUMENTS,
  type Instrument,
  type Label,
  type Side,
  type StopMove,
  type Trade,
  type TradeExit,
} from "@/lib/types"
import { cn } from "@/lib/utils"

const INSTRUMENT_ITEMS = INSTRUMENTS.map((value) => ({
  value,
  label: value[0].toUpperCase() + value.slice(1),
}))

interface FormState {
  symbol: string
  instrument: Instrument
  side: Side
  quantity: string
  multiplier: string
  entryPrice: string
  stopLoss: string
  target: string
  entryDate: string
  exits: ExitDraft[]
  fees: string
  labels: string[]
  notes: string
}

interface ExitDraft {
  id: string
  date: string
  price: string
  quantity: string
  fees: string
}

function toText(value: number | null) {
  return value === null ? "" : String(value)
}

function initialState(trade?: Trade): FormState {
  if (!trade) {
    return {
      symbol: "",
      instrument: "stock",
      side: "long",
      quantity: "",
      multiplier: "1",
      entryPrice: "",
      stopLoss: "",
      target: "",
      entryDate: todayIso(),
      exits: [],
      fees: "",
      labels: [],
      notes: "",
    }
  }
  return {
    symbol: trade.symbol,
    instrument: trade.instrument,
    side: trade.side,
    quantity: String(trade.quantity),
    multiplier: String(trade.multiplier),
    entryPrice: String(trade.entryPrice),
    stopLoss: toText(trade.initialStop),
    target: toText(trade.target),
    entryDate: trade.entryDate,
    exits: trade.exits.map((exit) => ({
      id: exit.id,
      date: exit.date,
      price: String(exit.price),
      quantity: String(exit.quantity),
      fees: exit.fees ? String(exit.fees) : "",
    })),
    fees: trade.fees ? String(trade.fees) : "",
    labels: trade.labels,
    notes: trade.notes,
  }
}

function parseNumber(value: string) {
  if (value.trim() === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : NaN
}

type Errors = Partial<Record<keyof FormState, string>>

function parseExits(form: FormState, quantity: number | null): { exits?: TradeExit[]; error?: string } {
  const exits: TradeExit[] = []
  for (const draft of form.exits) {
    const price = parseNumber(draft.price)
    const qty = parseNumber(draft.quantity)
    const fees = parseNumber(draft.fees)
    if (price === null || !(price > 0)) return { error: "Every exit needs a price above 0" }
    if (qty === null || !(qty > 0)) return { error: "Every exit needs a quantity above 0" }
    if (Number.isNaN(fees) || (fees !== null && fees < 0)) return { error: "Exit charges must be 0 or more" }
    if (!draft.date) return { error: "Every exit needs a date" }
    if (form.entryDate && draft.date < form.entryDate) return { error: "An exit is dated before the entry" }
    exits.push({ id: draft.id, date: draft.date, price, quantity: qty, fees: fees ?? 0 })
  }
  const exited = exits.reduce((sum, exit) => sum + exit.quantity, 0)
  if (quantity !== null && quantity > 0 && exited > quantity) {
    return { error: `Exits add up to ${exited}, more than the ${quantity} you bought` }
  }
  return { exits: exits.sort((a, b) => a.date.localeCompare(b.date)) }
}

function stopFields(history: StopMove[], initial: number | null, entryDate: string) {
  if (initial === null) return { initialStop: null, stopLoss: null, stopHistory: [] }
  const stopHistory = [{ date: entryDate, price: initial }, ...history.slice(1)]
  return { initialStop: initial, stopLoss: stopHistory[stopHistory.length - 1].price, stopHistory }
}

type FormInput = Omit<TradeInput, "initialStop" | "stopHistory">

function validate(form: FormState): { errors: Errors; input?: FormInput } {
  const errors: Errors = {}
  const quantity = parseNumber(form.quantity)
  const multiplier = parseNumber(form.multiplier)
  const entryPrice = parseNumber(form.entryPrice)
  const stopLoss = parseNumber(form.stopLoss)
  const target = parseNumber(form.target)
  const fees = parseNumber(form.fees)

  if (!form.symbol.trim()) errors.symbol = "Symbol is required"
  if (quantity === null || !(quantity > 0)) errors.quantity = "Enter a quantity above 0"
  if (multiplier === null || !(multiplier > 0)) errors.multiplier = "Must be above 0"
  if (entryPrice === null || !(entryPrice > 0)) errors.entryPrice = "Enter an entry price"
  if (!form.entryDate) errors.entryDate = "Pick an entry date"
  if (Number.isNaN(stopLoss) || (stopLoss !== null && stopLoss < 0)) errors.stopLoss = "Invalid stop"
  if (Number.isNaN(target) || (target !== null && target < 0)) errors.target = "Invalid target"
  if (Number.isNaN(fees) || (fees !== null && fees < 0)) errors.fees = "Invalid charges"
  const parsedExits = parseExits(form, quantity)
  if (parsedExits.error) errors.exits = parsedExits.error

  if (Object.keys(errors).length) return { errors }

  return {
    errors,
    input: {
      symbol: form.symbol.trim().toUpperCase(),
      instrument: form.instrument,
      side: form.side,
      quantity: quantity!,
      multiplier: multiplier!,
      entryPrice: entryPrice!,
      stopLoss,
      target,
      entryDate: form.entryDate,
      exits: parsedExits.exits!,
      fees: fees ?? 0,
      labels: form.labels,
      notes: form.notes.trim(),
    },
  }
}

interface TradeFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trade?: Trade
  labels: Label[]
}

export function TradeFormSheet({ open, onOpenChange, trade, labels }: TradeFormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        {open && (
          <TradeForm
            key={trade?.id ?? "new"}
            trade={trade}
            labels={labels}
            onDone={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function TradeForm({
  trade,
  labels,
  onDone,
}: {
  trade?: Trade
  labels: Label[]
  onDone: () => void
}) {
  const [form, setForm] = useState(() => initialState(trade))
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function applyInstrument(instrument: MarketInstrument) {
    setForm((prev) => ({
      ...prev,
      symbol: instrument.symbol,
      instrument: instrument.kind,
      multiplier: String(instrument.lot),
      entryPrice: prev.entryPrice || (instrument.close !== null ? String(instrument.close) : ""),
    }))
    setErrors((prev) => ({ ...prev, symbol: undefined, multiplier: undefined, entryPrice: undefined }))
  }

  const entry = parseNumber(form.entryPrice)
  const stop = parseNumber(form.stopLoss)
  const target = parseNumber(form.target)
  const units = (parseNumber(form.quantity) ?? 0) * (parseNumber(form.multiplier) ?? 1)
  const riskPerUnit = entry && stop !== null && !Number.isNaN(stop) ? Math.abs(entry - stop) : null
  const riskAmount = riskPerUnit !== null && units > 0 ? riskPerUnit * units : null
  const rewardRatio =
    riskPerUnit && entry && target !== null && !Number.isNaN(target)
      ? Math.abs(target - entry) / riskPerUnit
      : null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const result = validate(form)
    if (!result.input) {
      setErrors(result.errors)
      return
    }
    setSaving(true)
    try {
      const listed = await db.instruments.get(result.input.symbol)
      const unchanged = trade?.symbol === result.input.symbol
      const current = trade ? await db.trades.get(trade.id) : undefined
      await saveTrade(
        {
          ...result.input,
          ...stopFields(current?.stopHistory ?? [], result.input.stopLoss, result.input.entryDate),
          exchange: listed ? listed.exchange : unchanged ? (trade.exchange ?? null) : null,
          underlying: listed ? listed.underlying : unchanged ? (trade.underlying ?? null) : null,
        },
        trade?.id
      )
      toast.success(trade ? "Trade updated" : `${result.input.symbol} logged`)
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the trade")
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
      <SheetHeader className="border-b">
        <SheetTitle>{trade ? `Edit ${trade.symbol}` : "Log a trade"}</SheetTitle>
        <SheetDescription>Add exits as you book profits. The trade stays open until the full quantity is exited.</SheetDescription>
      </SheetHeader>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <FieldGroup className="gap-4">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field data-invalid={!!errors.symbol}>
              <FieldLabel htmlFor="symbol">Symbol</FieldLabel>
              <SymbolPicker
                id="symbol"
                value={form.symbol}
                onValueChange={(v) => set("symbol", v)}
                onSelect={applyInstrument}
                invalid={!!errors.symbol}
              />
              <FieldError>{errors.symbol}</FieldError>
            </Field>
            <Field>
              <FieldLabel>Side</FieldLabel>
              <ToggleGroup
                variant="outline"
                value={[form.side]}
                onValueChange={(value: string[]) => value[0] && set("side", value[0] as Side)}
              >
                <ToggleGroupItem value="long" className="data-pressed:text-profit">
                  Long
                </ToggleGroupItem>
                <ToggleGroupItem value="short" className="data-pressed:text-loss">
                  Short
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field>
              <FieldLabel>Instrument</FieldLabel>
              <Select
                items={INSTRUMENT_ITEMS}
                value={form.instrument}
                onValueChange={(value) => value && set("instrument", value as Instrument)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INSTRUMENT_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <NumberField
              id="quantity"
              label="Quantity"
              value={form.quantity}
              onChange={(v) => set("quantity", v)}
              error={errors.quantity}
            />
            <NumberField
              id="multiplier"
              label="Lot size"
              value={form.multiplier}
              onChange={(v) => set("multiplier", v)}
              error={errors.multiplier}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              id="entryPrice"
              label="Entry price"
              value={form.entryPrice}
              onChange={(v) => set("entryPrice", v)}
              error={errors.entryPrice}
            />
            <DateField
              id="entryDate"
              label="Entry date"
              value={form.entryDate}
              onChange={(v) => set("entryDate", v)}
              error={errors.entryDate}
            />
            <NumberField
              id="stopLoss"
              label={trade ? "Initial stop" : "Stop loss"}
              value={form.stopLoss}
              onChange={(v) => set("stopLoss", v)}
              error={errors.stopLoss}
            />
            <NumberField
              id="target"
              label="Target"
              value={form.target}
              onChange={(v) => set("target", v)}
              error={errors.target}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/50 px-3 py-2 font-mono text-[0.6875rem] tabular-nums">
            <div>
              <div className="text-muted-foreground">Risk</div>
              <div>{riskAmount !== null ? formatMoney(riskAmount) : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Reward : risk</div>
              <div>{formatRatio(rewardRatio, "R")}</div>
            </div>
          </div>

          {trade && <StopHistory tradeId={trade.id} />}

          <Field>
            <FieldLabel htmlFor="labels">Labels</FieldLabel>
            <LabelPicker id="labels" labels={labels} value={form.labels} onChange={(v) => set("labels", v)} />
          </Field>

          <FieldSeparator>Exits</FieldSeparator>

          <ExitsEditor
            exits={form.exits}
            onChange={(exits) => set("exits", exits)}
            quantity={parseNumber(form.quantity)}
            multiplier={parseNumber(form.multiplier) ?? 1}
            entryPrice={parseNumber(form.entryPrice)}
            entryDate={form.entryDate}
            side={form.side}
            error={errors.exits}
          />

          <div className="grid grid-cols-3 gap-3">
            <NumberField
              id="fees"
              label="Other charges"
              value={form.fees}
              onChange={(v) => set("fees", v)}
              error={errors.fees}
            />
          </div>

          <Field>
            <FieldLabel htmlFor="notes">Notes</FieldLabel>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Setup, reasoning, mistakes…"
              rows={3}
            />
          </Field>
        </FieldGroup>
      </div>

      <SheetFooter className="flex-row justify-end border-t">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {trade ? "Save changes" : "Log trade"}
        </Button>
      </SheetFooter>
    </form>
  )
}

interface ExitsEditorProps {
  exits: ExitDraft[]
  onChange: (exits: ExitDraft[]) => void
  quantity: number | null
  multiplier: number
  entryPrice: number | null
  entryDate: string
  side: Side
  error?: string
}

function ExitsEditor({ exits, onChange, quantity, multiplier, entryPrice, entryDate, side, error }: ExitsEditorProps) {
  const exited = exits.reduce((sum, exit) => sum + (Number(exit.quantity) || 0), 0)
  const remaining = quantity !== null && !Number.isNaN(quantity) ? quantity - exited : null

  function update(id: string, key: keyof Omit<ExitDraft, "id">, value: string) {
    onChange(exits.map((exit) => (exit.id === id ? { ...exit, [key]: value } : exit)))
  }

  function addRow() {
    const today = todayIso()
    onChange([
      ...exits,
      {
        id: crypto.randomUUID(),
        date: entryDate && today < entryDate ? entryDate : today,
        price: "",
        quantity: remaining !== null && remaining > 0 ? String(remaining) : "",
        fees: "",
      },
    ])
  }

  return (
    <div className="grid gap-2">
      {exits.length > 0 && (
        <div className="grid gap-1.5">
          <div className="grid grid-cols-[8.25rem_1fr_1fr_1fr_auto] gap-2 text-[0.6875rem] text-muted-foreground">
            <span>Date</span>
            <span>Qty{multiplier !== 1 && " (lots)"}</span>
            <span>Price</span>
            <span>Charges</span>
            <span className="w-6" />
          </div>
          {exits.map((exit, index) => {
            const price = Number(exit.price)
            const qty = Number(exit.quantity)
            const pnl =
              entryPrice && price > 0 && qty > 0
                ? (price - entryPrice) * (side === "long" ? 1 : -1) * qty * multiplier - (Number(exit.fees) || 0)
                : null
            return (
              <div key={exit.id} className="grid gap-1">
                <div className="grid grid-cols-[8.25rem_1fr_1fr_1fr_auto] items-center gap-2">
                  <Input
                    type="date"
                    aria-label={`Exit ${index + 1} date`}
                    className="font-mono tabular-nums"
                    value={exit.date}
                    onChange={(e) => update(exit.id, "date", e.target.value)}
                  />
                  <Input
                    aria-label={`Exit ${index + 1} quantity`}
                    inputMode="decimal"
                    autoComplete="off"
                    className="font-mono tabular-nums"
                    value={exit.quantity}
                    onChange={(e) => update(exit.id, "quantity", e.target.value.replace(/[^\d.]/g, ""))}
                  />
                  <Input
                    aria-label={`Exit ${index + 1} price`}
                    inputMode="decimal"
                    autoComplete="off"
                    className="font-mono tabular-nums"
                    value={exit.price}
                    onChange={(e) => update(exit.id, "price", e.target.value.replace(/[^\d.]/g, ""))}
                  />
                  <Input
                    aria-label={`Exit ${index + 1} charges`}
                    inputMode="decimal"
                    autoComplete="off"
                    className="font-mono tabular-nums"
                    value={exit.fees}
                    onChange={(e) => update(exit.id, "fees", e.target.value.replace(/[^\d.]/g, ""))}
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove exit ${index + 1}`}
                    onClick={() => onChange(exits.filter((item) => item.id !== exit.id))}
                  >
                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                  </Button>
                </div>
                {pnl !== null && (
                  <div className={cn("text-right font-mono text-[0.6875rem] tabular-nums", pnlTone(pnl))}>
                    {formatMoney(pnl, { signed: true })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.6875rem] text-muted-foreground">
          {exits.length === 0
            ? "No exits yet. The position is open."
            : remaining === null
              ? ""
              : remaining > 0
                ? `${formatNumber(remaining)} still open`
                : remaining === 0
                  ? "Fully closed"
                  : "Exits are more than the quantity bought"}
        </span>
        <Button type="button" size="sm" variant="outline" onClick={addRow} disabled={remaining !== null && remaining <= 0}>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
          Add exit
        </Button>
      </div>
      {error && <FieldError>{error}</FieldError>}
    </div>
  )
}

interface InputFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
}

function NumberField({ id, label, value, onChange, error }: InputFieldProps) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        className="font-mono tabular-nums"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
        aria-invalid={!!error}
      />
      <FieldError>{error}</FieldError>
    </Field>
  )
}

function DateField({ id, label, value, onChange, error }: InputFieldProps) {
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="date"
        className="font-mono tabular-nums"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
      />
      <FieldError>{error}</FieldError>
    </Field>
  )
}
