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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { addExit } from "@/lib/db"
import { formatMoney, formatNumber, formatRatio, pnlTone, todayIso } from "@/lib/format"
import { exitPnl, initialRisk, lastExitDate, remainingQuantity } from "@/lib/metrics"
import type { Trade } from "@/lib/types"
import { cn } from "@/lib/utils"

const SHARES = [
  { label: "25%", value: 0.25 },
  { label: "50%", value: 0.5 },
  { label: "All", value: 1 },
]

interface ExitTradeDialogProps {
  trade: Trade | null
  onOpenChange: (open: boolean) => void
}

export function ExitTradeDialog({ trade, onOpenChange }: ExitTradeDialogProps) {
  return (
    <Dialog open={!!trade} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {trade && <ExitForm key={trade.id} trade={trade} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ExitForm({ trade, onDone }: { trade: Trade; onDone: () => void }) {
  const remaining = remainingQuantity(trade)
  const earliest = lastExitDate(trade) ?? trade.entryDate
  const unit = trade.multiplier === 1 ? "qty" : "lots"
  const [quantity, setQuantity] = useState(String(remaining))
  const [price, setPrice] = useState("")
  const [date, setDate] = useState(() => (todayIso() < earliest ? earliest : todayIso()))
  const [fees, setFees] = useState("")
  const [error, setError] = useState<string | null>(null)

  const qty = Number(quantity)
  const exitPrice = Number(price)
  const feeValue = Number(fees) || 0
  const validQty = quantity !== "" && Number.isFinite(qty) && qty > 0 && qty <= remaining
  const validPrice = price !== "" && Number.isFinite(exitPrice) && exitPrice > 0
  const pnl = validQty && validPrice ? exitPnl(trade, { price: exitPrice, quantity: qty, fees: feeValue }) : null
  const risk = initialRisk(trade)
  const r = pnl !== null && risk ? pnl / ((risk * qty) / trade.quantity) : null
  const left = validQty ? remaining - qty : remaining

  function pickShare(share: number) {
    const value = share === 1 ? remaining : Math.max(1, Math.round(remaining * share))
    setQuantity(String(Math.min(value, remaining)))
    setError(null)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!validQty) return setError(`Enter a quantity between 1 and ${formatNumber(remaining)}`)
    if (!validPrice) return setError("Enter a valid exit price")
    if (!date) return setError("Pick an exit date")
    if (date < earliest) return setError(`Exit date must be on or after ${earliest}`)
    await addExit(trade.id, { date, price: exitPrice, quantity: qty, fees: feeValue })
    toast.success(left === 0 ? `${trade.symbol} closed` : `Exited ${formatNumber(qty)} of ${trade.symbol}`, {
      description: pnl !== null ? formatMoney(pnl, { signed: true }) : undefined,
    })
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Exit {trade.symbol}</DialogTitle>
        <DialogDescription>
          {trade.side === "long" ? "Long" : "Short"} {formatNumber(remaining)} {unit} @ {formatNumber(trade.entryPrice)}
          {remaining !== trade.quantity && ` • ${formatNumber(trade.quantity - remaining)} already exited`}
        </DialogDescription>
      </DialogHeader>

      <FieldGroup className="gap-3">
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Field data-invalid={!!error && !validQty}>
            <FieldLabel htmlFor="exit-qty">Quantity{trade.multiplier !== 1 && " (lots)"}</FieldLabel>
            <Input
              id="exit-qty"
              inputMode="decimal"
              autoComplete="off"
              className="font-mono tabular-nums"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value.replace(/[^\d.]/g, ""))
                setError(null)
              }}
            />
          </Field>
          <ToggleGroup variant="outline" value={[]} onValueChange={(value: string[]) => value[0] && pickShare(Number(value[0]))}>
            {SHARES.map((share) => (
              <ToggleGroupItem key={share.label} value={String(share.value)}>
                {share.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field data-invalid={!!error && validQty && !validPrice}>
            <FieldLabel htmlFor="exit-price">Exit price</FieldLabel>
            <Input
              id="exit-price"
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
            <FieldLabel htmlFor="exit-date">Exit date</FieldLabel>
            <Input
              id="exit-date"
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
          <Field>
            <FieldLabel htmlFor="exit-fees">Charges</FieldLabel>
            <Input
              id="exit-fees"
              inputMode="decimal"
              autoComplete="off"
              className="font-mono tabular-nums"
              value={fees}
              onChange={(e) => setFees(e.target.value.replace(/[^\d.]/g, ""))}
            />
          </Field>
        </div>
      </FieldGroup>

      {error && <FieldError>{error}</FieldError>}

      <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/50 px-3 py-2 font-mono text-[0.6875rem] tabular-nums">
        <div>
          <div className="text-muted-foreground">Realized on this exit</div>
          <div className={cn("text-sm font-medium", pnl !== null && pnlTone(pnl))}>
            {pnl !== null ? formatMoney(pnl, { signed: true }) : "—"}
            {r !== null && <span className="ml-2 text-xs opacity-80">{formatRatio(r, "R")}</span>}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Left open</div>
          <div className="text-sm font-medium">
            {left === 0 ? "Fully closed" : `${formatNumber(left)} ${unit}`}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{left === 0 ? "Close trade" : "Book partial exit"}</Button>
      </DialogFooter>
    </form>
  )
}
