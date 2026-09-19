"use client"

import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowTurnBackwardIcon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons"

import { LabelTag } from "@/components/tradebook/label-dot"
import { logoTicker, SymbolLogo } from "@/components/tradebook/symbol-logo"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatMoney, formatNumber, formatRatio, pnlTone } from "@/lib/format"
import { describeInstrument } from "@/lib/market/describe"
import type { Instrument } from "@/lib/market/types"
import { openRisk, realizedPnl, rMultiple, unrealizedPnl } from "@/lib/metrics"
import type { Label, Trade } from "@/lib/types"
import { cn } from "@/lib/utils"

export interface TradeActions {
  onEdit: (trade: Trade) => void
  onClose: (trade: Trade) => void
  onReopen: (trade: Trade) => void
  onDelete: (trade: Trade) => void
}

interface TradesTableProps extends TradeActions {
  trades: Trade[]
  labels: Label[]
  mode: "open" | "closed"
  quotes: Map<string, Instrument>
  empty: React.ReactNode
}

function shortDate(date: string) {
  return format(parseISO(date), "d MMM yy")
}

export function TradesTable({ trades, labels, mode, quotes, empty, ...actions }: TradesTableProps) {
  const labelById = new Map(labels.map((label) => [label.id, label]))

  if (!trades.length) return <div className="py-14">{empty}</div>

  const money = (value: number, signed = false) => formatMoney(value, { signed })

  return (
    <Table className="font-mono text-xs tabular-nums">
      <TableHeader>
        <TableRow className="font-sans hover:bg-transparent">
          <TableHead className="pl-4">Symbol</TableHead>
          <TableHead>Labels</TableHead>
          <TableHead>{mode === "open" ? "Opened" : "Closed"}</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="text-right">Entry</TableHead>
          {mode === "open" ? (
            <>
              <TableHead className="text-right">Stop</TableHead>
              <TableHead className="text-right">Target</TableHead>
              <TableHead className="text-right">Last</TableHead>
              <TableHead className="text-right">Unrealized</TableHead>
              <TableHead className="text-right">Open risk</TableHead>
            </>
          ) : (
            <>
              <TableHead className="text-right">Exit</TableHead>
              <TableHead className="text-right">P&amp;L</TableHead>
              <TableHead className="text-right">R</TableHead>
            </>
          )}
          <TableHead className="w-10 pr-4" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {trades.map((trade) => {
          const risk = openRisk(trade)
          const pnl = realizedPnl(trade)
          const r = rMultiple(trade)
          const quote = quotes.get(trade.symbol)
          const last = quote?.close ?? null
          const title = quote && quote.kind !== "stock" ? describeInstrument(quote) : trade.symbol
          const unrealized = last !== null ? unrealizedPnl(trade, last) : null
          const qty = trade.multiplier === 1 ? formatNumber(trade.quantity) : `${formatNumber(trade.quantity)}×${formatNumber(trade.multiplier)}`
          const tradeLabels = trade.labels.map((id) => labelById.get(id)).filter(Boolean) as Label[]

          return (
            <TableRow key={trade.id} className="group/row">
              <TableCell className="pl-4">
                <button
                  type="button"
                  onClick={() => actions.onEdit(trade)}
                  className="flex items-center gap-2 text-left font-sans outline-none focus-visible:underline"
                >
                  <SymbolLogo ticker={logoTicker(trade.symbol, trade.underlying, trade.exchange)} size={22} />
                  <span
                    className={cn(
                      "w-9 rounded-sm px-1 py-px text-center font-mono text-[0.625rem] font-medium uppercase",
                      trade.side === "long" ? "bg-profit/12 text-profit" : "bg-loss/12 text-loss"
                    )}
                  >
                    {trade.side}
                  </span>
                  <span className="font-medium" title={trade.symbol}>{title}</span>
                  <span className="text-[0.6875rem] text-muted-foreground capitalize">{trade.instrument}</span>
                </button>
              </TableCell>
              <TableCell>
                <div className="flex max-w-56 flex-wrap gap-1 font-sans">
                  {tradeLabels.length ? (
                    tradeLabels.map((label) => <LabelTag key={label.id} label={label} />)
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {mode === "open" ? (
                  <>
                    {shortDate(trade.entryDate)}
                    <span className="ml-1.5 opacity-70">
                      {differenceInCalendarDays(new Date(), parseISO(trade.entryDate))}d
                    </span>
                  </>
                ) : (
                  <>
                    {shortDate(trade.exitDate!)}
                    <span className="ml-1.5 opacity-70">
                      {differenceInCalendarDays(parseISO(trade.exitDate!), parseISO(trade.entryDate))}d
                    </span>
                  </>
                )}
              </TableCell>
              <TableCell className="text-right">{qty}</TableCell>
              <TableCell className="text-right">{formatNumber(trade.entryPrice)}</TableCell>
              {mode === "open" ? (
                <>
                  <TableCell className="text-right">
                    {trade.stopLoss !== null ? formatNumber(trade.stopLoss) : <span className="text-loss">none</span>}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {trade.target !== null ? formatNumber(trade.target) : "—"}
                  </TableCell>
                  <TableCell className="text-right">{last !== null ? formatNumber(last) : "—"}</TableCell>
                  <TableCell className={cn("text-right", unrealized !== null ? pnlTone(unrealized) : "text-muted-foreground")}>
                    {unrealized !== null ? money(unrealized, true) : "—"}
                  </TableCell>
                  <TableCell className={cn("text-right", risk ? "text-warning" : "text-muted-foreground")}>
                    {risk === null ? "—" : money(risk)}
                  </TableCell>
                </>
              ) : (
                <>
                  <TableCell className="text-right">{formatNumber(trade.exitPrice!)}</TableCell>
                  <TableCell className={cn("text-right font-medium", pnlTone(pnl))}>{money(pnl, true)}</TableCell>
                  <TableCell className={cn("text-right", r !== null ? pnlTone(r) : "text-muted-foreground")}>
                    {formatRatio(r, "R")}
                  </TableCell>
                </>
              )}
              <TableCell className="pr-4 text-right">
                <RowActions trade={trade} mode={mode} {...actions} />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function RowActions({ trade, mode, onEdit, onClose, onReopen, onDelete }: TradeActions & { trade: Trade; mode: "open" | "closed" }) {
  return (
    <div className="flex items-center justify-end gap-1">
      {mode === "open" && (
        <Button size="sm" variant="outline" className="font-sans" onClick={() => onClose(trade)}>
          <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} data-icon="inline-start" />
          Close
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label={`Actions for ${trade.symbol}`} />}>
          <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36 font-sans">
          <DropdownMenuItem onClick={() => onEdit(trade)}>
            <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} />
            Edit
          </DropdownMenuItem>
          {mode === "closed" && (
            <DropdownMenuItem onClick={() => onReopen(trade)}>
              <HugeiconsIcon icon={ArrowTurnBackwardIcon} strokeWidth={2} />
              Reopen
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(trade)}>
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
