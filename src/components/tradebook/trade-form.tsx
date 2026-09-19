"use client"

import { useState } from "react"
import { toast } from "sonner"

import { LabelPicker } from "@/components/tradebook/label-picker"
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
import { saveTrade, type TradeInput } from "@/lib/db"
import { formatMoney, formatRatio, todayIso } from "@/lib/format"
import { INSTRUMENTS, type Instrument, type Label, type Side, type Trade } from "@/lib/types"

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
  exitPrice: string
  exitDate: string
  fees: string
  labels: string[]
  notes: string
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
      exitPrice: "",
      exitDate: "",
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
    stopLoss: toText(trade.stopLoss),
    target: toText(trade.target),
    entryDate: trade.entryDate,
    exitPrice: toText(trade.exitPrice),
    exitDate: trade.exitDate ?? "",
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

function validate(form: FormState): { errors: Errors; input?: TradeInput } {
  const errors: Errors = {}
  const quantity = parseNumber(form.quantity)
  const multiplier = parseNumber(form.multiplier)
  const entryPrice = parseNumber(form.entryPrice)
  const stopLoss = parseNumber(form.stopLoss)
  const target = parseNumber(form.target)
  const exitPrice = parseNumber(form.exitPrice)
  const fees = parseNumber(form.fees)

  if (!form.symbol.trim()) errors.symbol = "Symbol is required"
  if (quantity === null || !(quantity > 0)) errors.quantity = "Enter a quantity above 0"
  if (multiplier === null || !(multiplier > 0)) errors.multiplier = "Must be above 0"
  if (entryPrice === null || !(entryPrice > 0)) errors.entryPrice = "Enter an entry price"
  if (!form.entryDate) errors.entryDate = "Pick an entry date"
  if (Number.isNaN(stopLoss) || (stopLoss !== null && stopLoss < 0)) errors.stopLoss = "Invalid stop"
  if (Number.isNaN(target) || (target !== null && target < 0)) errors.target = "Invalid target"
  if (Number.isNaN(fees) || (fees !== null && fees < 0)) errors.fees = "Invalid fees"
  if (Number.isNaN(exitPrice) || (exitPrice !== null && exitPrice < 0)) errors.exitPrice = "Invalid exit"
  if (exitPrice !== null && !form.exitDate) errors.exitDate = "Pick an exit date"
  if (exitPrice === null && form.exitDate) errors.exitPrice = "Enter the exit price"
  if (form.exitDate && form.entryDate && form.exitDate < form.entryDate) {
    errors.exitDate = "Exit is before entry"
  }

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
      exitPrice,
      exitDate: exitPrice === null ? null : form.exitDate,
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
  currency: string
}

export function TradeFormSheet({ open, onOpenChange, trade, labels, currency }: TradeFormSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        {open && (
          <TradeForm
            key={trade?.id ?? "new"}
            trade={trade}
            labels={labels}
            currency={currency}
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
  currency,
  onDone,
}: {
  trade?: Trade
  labels: Label[]
  currency: string
  onDone: () => void
}) {
  const [form, setForm] = useState(() => initialState(trade))
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
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
      await saveTrade(result.input, trade?.id)
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
        <SheetDescription>Leave the exit empty while the position is still open.</SheetDescription>
      </SheetHeader>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <FieldGroup className="gap-4">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field data-invalid={!!errors.symbol}>
              <FieldLabel htmlFor="symbol">Symbol</FieldLabel>
              <Input
                id="symbol"
                autoFocus
                autoComplete="off"
                value={form.symbol}
                onChange={(e) => set("symbol", e.target.value.toUpperCase())}
                placeholder="AAPL"
                aria-invalid={!!errors.symbol}
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
              label="Stop loss"
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
              <div>{riskAmount !== null ? formatMoney(riskAmount, currency) : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Reward : risk</div>
              <div>{formatRatio(rewardRatio, "R")}</div>
            </div>
          </div>

          <Field>
            <FieldLabel htmlFor="labels">Labels</FieldLabel>
            <LabelPicker id="labels" labels={labels} value={form.labels} onChange={(v) => set("labels", v)} />
          </Field>

          <FieldSeparator>Exit</FieldSeparator>

          <div className="grid grid-cols-3 gap-3">
            <NumberField
              id="exitPrice"
              label="Exit price"
              value={form.exitPrice}
              onChange={(v) => set("exitPrice", v)}
              error={errors.exitPrice}
            />
            <DateField
              id="exitDate"
              label="Exit date"
              value={form.exitDate}
              onChange={(v) => set("exitDate", v)}
              error={errors.exitDate}
            />
            <NumberField
              id="fees"
              label="Fees"
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
