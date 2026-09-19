"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { trailStop } from "@/lib/db"
import { formatMoney, formatNumber, todayIso } from "@/lib/format"
import { isWideningStop, lockedProfit, openRisk } from "@/lib/metrics"
import type { Trade } from "@/lib/types"

interface TrailStopDialogProps {
  trade: Trade | null
  onOpenChange: (open: boolean) => void
}

export function TrailStopDialog({ trade, onOpenChange }: TrailStopDialogProps) {
  return (
    <Dialog open={!!trade} onOpenChange={onOpenChange}>
      <DialogContent>
        {trade && <TrailStopForm key={trade.id} trade={trade} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function TrailStopForm({ trade, onDone }: { trade: Trade; onDone: () => void }) {
  const lastMove = trade.stopHistory[trade.stopHistory.length - 1]
  const earliest = lastMove?.date ?? trade.entryDate
  const [price, setPrice] = useState(trade.stopLoss !== null ? String(trade.stopLoss) : "")
  const [date, setDate] = useState(() => (todayIso() < earliest ? earliest : todayIso()))
  const [error, setError] = useState<string | null>(null)

  const value = Number(price)
  const valid = price !== "" && Number.isFinite(value) && value > 0
  const preview = valid ? { ...trade, stopLoss: value } : null
  const widening = valid && isWideningStop(trade, value)
  const unchanged = valid && value === trade.stopLoss

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!valid) return setError("Enter a valid stop price")
    if (unchanged) return setError("That is already the current stop")
    if (!date) return setError("Pick a date")
    if (date < earliest) return setError(`Date must be on or after ${earliest}`)
    await trailStop(trade.id, { date, price: value })
    toast.success(`${trade.symbol} stop moved to ${formatNumber(value)}`)
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{trade.stopLoss === null ? "Set stop" : "Trail stop"} • {trade.symbol}</DialogTitle>
        <DialogDescription>
          {trade.side === "long" ? "Long" : "Short"} from {formatNumber(trade.entryPrice)}
          {trade.stopLoss !== null && ` • current stop ${formatNumber(trade.stopLoss)}`}
          {trade.initialStop !== null && trade.initialStop !== trade.stopLoss && ` • initial ${formatNumber(trade.initialStop)}`}
        </DialogDescription>
      </DialogHeader>

      <FieldGroup className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
        <Field data-invalid={!!error}>
          <FieldLabel htmlFor="trail-price">New stop</FieldLabel>
          <Input
            id="trail-price"
            autoFocus
            inputMode="decimal"
            autoComplete="off"
            className="font-mono tabular-nums"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value.replace(/[^\d.]/g, ""))
              setError(null)
            }}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="trail-date">Date</FieldLabel>
          <Input
            id="trail-date"
            type="date"
            min={earliest}
            className="font-mono tabular-nums"
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              setError(null)
            }}
          />
        </Field>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setPrice(String(trade.entryPrice))
            setError(null)
          }}
        >
          Breakeven
        </Button>
      </FieldGroup>

      {error && <FieldError>{error}</FieldError>}
      {widening && !error && (
        <p className="text-warning">This widens your stop and increases the risk on this trade.</p>
      )}

      <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/50 px-3 py-2 font-mono text-[0.6875rem] tabular-nums">
        <div>
          <div className="text-muted-foreground">Open risk</div>
          <div className={preview && openRisk(preview) ? "text-warning" : undefined}>
            {preview ? formatMoney(openRisk(preview) ?? 0) : "—"}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Locked in</div>
          <div className={preview && lockedProfit(preview) ? "text-profit" : undefined}>
            {preview ? formatMoney(lockedProfit(preview)) : "—"}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Save stop</Button>
      </DialogFooter>
    </form>
  )
}
