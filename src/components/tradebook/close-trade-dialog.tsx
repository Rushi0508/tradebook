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
import { closeTrade } from "@/lib/db"
import { formatMoney, formatRatio, pnlTone, todayIso } from "@/lib/format"
import { realizedPnl, rMultiple } from "@/lib/metrics"
import type { Trade } from "@/lib/types"
import { cn } from "@/lib/utils"

interface CloseTradeDialogProps {
  trade: Trade | null
  onOpenChange: (open: boolean) => void
}

export function CloseTradeDialog({ trade, onOpenChange }: CloseTradeDialogProps) {
  return (
    <Dialog open={!!trade} onOpenChange={onOpenChange}>
      <DialogContent>
        {trade && (
          <CloseTradeForm key={trade.id} trade={trade} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function CloseTradeForm({ trade, onDone }: { trade: Trade; onDone: () => void }) {
  const [exitPrice, setExitPrice] = useState("")
  const [exitDate, setExitDate] = useState(() => (todayIso() < trade.entryDate ? trade.entryDate : todayIso()))
  const [fees, setFees] = useState(trade.fees ? String(trade.fees) : "")
  const [error, setError] = useState<string | null>(null)

  const price = Number(exitPrice)
  const feeValue = Number(fees) || 0
  const preview =
    exitPrice && Number.isFinite(price) ? { ...trade, exitPrice: price, exitDate, fees: feeValue } : null
  const pnl = preview ? realizedPnl(preview) : null
  const r = preview ? rMultiple(preview) : null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!exitPrice || !Number.isFinite(price) || price < 0) return setError("Enter a valid exit price")
    if (!exitDate) return setError("Pick an exit date")
    if (exitDate < trade.entryDate) return setError("Exit date is before the entry date")
    await closeTrade(trade.id, price, exitDate, feeValue)
    toast.success(`${trade.symbol} closed`, {
      description: pnl !== null ? formatMoney(pnl, { signed: true }) : undefined,
    })
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Close {trade.symbol}</DialogTitle>
        <DialogDescription>
          {trade.side === "long" ? "Long" : "Short"} {trade.quantity} @ {trade.entryPrice}
        </DialogDescription>
      </DialogHeader>
      <FieldGroup className="grid grid-cols-3 gap-3">
        <Field data-invalid={!!error}>
          <FieldLabel htmlFor="close-exit">Exit price</FieldLabel>
          <Input
            id="close-exit"
            autoFocus
            inputMode="decimal"
            autoComplete="off"
            className="font-mono tabular-nums"
            value={exitPrice}
            onChange={(e) => {
              setExitPrice(e.target.value.replace(/[^\d.]/g, ""))
              setError(null)
            }}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="close-date">Exit date</FieldLabel>
          <Input
            id="close-date"
            type="date"
            className="font-mono tabular-nums"
            value={exitDate}
            onChange={(e) => setExitDate(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="close-fees">Total fees</FieldLabel>
          <Input
            id="close-fees"
            inputMode="decimal"
            autoComplete="off"
            className="font-mono tabular-nums"
            value={fees}
            onChange={(e) => setFees(e.target.value.replace(/[^\d.]/g, ""))}
          />
        </Field>
      </FieldGroup>
      {error && <FieldError>{error}</FieldError>}
      <div className="flex items-baseline justify-between rounded-md bg-muted/50 px-3 py-2 font-mono tabular-nums">
        <span className="text-muted-foreground">Realized P&amp;L</span>
        <span className={cn("text-sm font-medium", pnl !== null && pnlTone(pnl))}>
          {pnl !== null ? formatMoney(pnl, { signed: true }) : "—"}
          {r !== null && <span className="ml-2 text-xs opacity-80">{formatRatio(r, "R")}</span>}
        </span>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Close trade</Button>
      </DialogFooter>
    </form>
  )
}
