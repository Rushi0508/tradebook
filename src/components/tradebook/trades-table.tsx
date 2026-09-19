"use client"

import { createContext, useContext, useMemo } from "react"
import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  ArrowMoveUpRightIcon,
  ArrowTurnBackwardIcon,
  ArrowUp01Icon,
  ArrowUpDownIcon,
  ChartLineData02Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons"
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_text,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table"

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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatMoney, formatNumber, formatPercent, formatRatio, pnlTone } from "@/lib/format"
import { describeInstrument } from "@/lib/market/describe"
import { tradingViewUrl } from "@/lib/market/tradingview"
import type { Instrument } from "@/lib/market/types"
import { initialRisk, isRiskFree, openRisk, realizedPnl, rewardToRisk, rMultiple, unrealizedPnl } from "@/lib/metrics"
import type { Label, Trade } from "@/lib/types"
import { cn } from "@/lib/utils"

export interface TradeActions {
  onEdit: (trade: Trade) => void
  onClose: (trade: Trade) => void
  onReopen: (trade: Trade) => void
  onDelete: (trade: Trade) => void
  onTrail: (trade: Trade) => void
}

type Mode = "open" | "closed"

interface TradeRow {
  trade: Trade
  title: string
  labels: Label[]
  exchange: string | null
  daysHeld: number
  last: number | undefined
  lastChange: number | undefined
  unrealized: number | undefined
  unrealizedR: number | undefined
  risk: number | undefined
  pnl: number
  r: number | undefined
  exitChange: number | undefined
}

function toRow(trade: Trade, quote: Instrument | undefined, labelById: Map<string, Label>): TradeRow {
  const direction = trade.side === "long" ? 1 : -1
  const last = quote?.close ?? undefined
  const unrealized = last !== undefined ? unrealizedPnl(trade, last) : undefined
  const risk = initialRisk(trade)
  const end = trade.exitDate ? parseISO(trade.exitDate) : new Date()
  return {
    trade,
    title: quote && quote.kind !== "stock" ? describeInstrument(quote) : trade.symbol,
    labels: trade.labels.map((id) => labelById.get(id)).filter((label): label is Label => !!label),
    exchange: trade.exchange ?? quote?.exchange ?? null,
    daysHeld: differenceInCalendarDays(end, parseISO(trade.entryDate)),
    last,
    lastChange: last !== undefined ? ((last - trade.entryPrice) / trade.entryPrice) * direction : undefined,
    unrealized,
    unrealizedR: unrealized !== undefined && risk ? unrealized / risk : undefined,
    risk: openRisk(trade) ?? undefined,
    pnl: realizedPnl(trade),
    r: rMultiple(trade) ?? undefined,
    exitChange:
      trade.exitPrice !== null ? ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * direction : undefined,
  }
}

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text },
})

const helper = createColumnHelper<typeof features, TradeRow>()

const RIGHT_ALIGNED = new Set(["qty", "entry", "stop", "last", "unrealized", "risk", "exit", "pnl"])

const ActionsContext = createContext<(TradeActions & { mode: Mode }) | null>(null)

function useActions() {
  const actions = useContext(ActionsContext)
  if (!actions) throw new Error("Trade actions are missing")
  return actions
}

function shortDate(date: string) {
  return format(parseISO(date), "d MMM yy")
}

function money(value: number, signed = false) {
  return formatMoney(value, { signed })
}

function Stack({ top, bottom, className }: { top: React.ReactNode; bottom?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div>{top}</div>
      <div className="text-[0.6875rem] text-muted-foreground">{bottom ?? " "}</div>
    </div>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>
}

function signedPercent(value: number | undefined) {
  if (value === undefined) return undefined
  return <span className={pnlTone(value)}>{`${value > 0 ? "+" : ""}${formatPercent(value, 2)}`}</span>
}

const symbolColumn = helper.accessor("title", {
  id: "symbol",
  header: "Symbol",
  sortFn: "text",
  cell: ({ row }) => <SymbolCell row={row.original} />,
})

const labelsColumn = helper.display({
  id: "labels",
  header: "Labels",
  cell: ({ row }) =>
    row.original.labels.length ? (
      <div className="flex max-w-52 flex-wrap gap-1 font-sans">
        {row.original.labels.map((label) => (
          <LabelTag key={label.id} label={label} />
        ))}
      </div>
    ) : (
      <Muted>—</Muted>
    ),
})

const qtyColumn = helper.accessor((row) => row.trade.quantity * row.trade.multiplier, {
  id: "qty",
  header: "Qty",
  cell: ({ row }) => (
    <Stack
      top={formatNumber(row.original.trade.quantity * row.original.trade.multiplier)}
      bottom={
        row.original.trade.multiplier !== 1
          ? `${formatNumber(row.original.trade.quantity)} × ${formatNumber(row.original.trade.multiplier)}`
          : undefined
      }
    />
  ),
})

const entryColumn = helper.accessor((row) => row.trade.entryPrice, {
  id: "entry",
  header: "Entry",
  cell: ({ getValue }) => formatNumber(getValue()),
})

const actionsColumn = helper.display({
  id: "actions",
  header: "",
  cell: ({ row }) => <RowActions trade={row.original.trade} />,
})

const openColumns = helper.columns([
  symbolColumn,
  labelsColumn,
  helper.accessor((row) => row.trade.entryDate, {
    id: "opened",
    header: "Opened",
    sortFn: "text",
    cell: ({ row }) => (
      <Stack top={<Muted>{shortDate(row.original.trade.entryDate)}</Muted>} bottom={`${row.original.daysHeld}d held`} />
    ),
  }),
  qtyColumn,
  entryColumn,
  helper.accessor((row) => row.trade.stopLoss ?? undefined, {
    id: "stop",
    header: "Stop / Target",
    sortUndefined: "last",
    cell: ({ row }) => <StopCell trade={row.original.trade} />,
  }),
  helper.accessor("last", {
    id: "last",
    header: "Last",
    sortUndefined: "last",
    cell: ({ row }) =>
      row.original.last !== undefined ? (
        <Stack top={formatNumber(row.original.last)} bottom={signedPercent(row.original.lastChange)} />
      ) : (
        <Muted>—</Muted>
      ),
  }),
  helper.accessor("unrealized", {
    id: "unrealized",
    header: "Unrealized",
    sortUndefined: "last",
    cell: ({ row }) =>
      row.original.unrealized !== undefined ? (
        <Stack
          className={pnlTone(row.original.unrealized)}
          top={money(row.original.unrealized, true)}
          bottom={row.original.unrealizedR !== undefined ? formatRatio(row.original.unrealizedR, "R") : undefined}
        />
      ) : (
        <Muted>—</Muted>
      ),
  }),
  helper.accessor("risk", {
    id: "risk",
    header: "Open risk",
    sortUndefined: "last",
    cell: ({ getValue }) => {
      const risk = getValue()
      if (risk === undefined) return <Muted>—</Muted>
      return <span className={risk ? "text-warning" : "text-muted-foreground"}>{money(risk)}</span>
    },
  }),
  actionsColumn,
])

const closedColumns = helper.columns([
  symbolColumn,
  labelsColumn,
  helper.accessor((row) => row.trade.exitDate ?? "", {
    id: "closed",
    header: "Closed",
    sortFn: "text",
    cell: ({ row }) => (
      <Stack top={<Muted>{shortDate(row.original.trade.exitDate!)}</Muted>} bottom={`${row.original.daysHeld}d held`} />
    ),
  }),
  qtyColumn,
  entryColumn,
  helper.accessor((row) => row.trade.exitPrice ?? 0, {
    id: "exit",
    header: "Exit",
    cell: ({ row }) => (
      <Stack top={formatNumber(row.original.trade.exitPrice!)} bottom={signedPercent(row.original.exitChange)} />
    ),
  }),
  helper.accessor("pnl", {
    id: "pnl",
    header: "P&L",
    cell: ({ row }) => (
      <Stack
        className={cn("font-medium", pnlTone(row.original.pnl))}
        top={money(row.original.pnl, true)}
        bottom={row.original.r !== undefined ? formatRatio(row.original.r, "R") : undefined}
      />
    ),
  }),
  actionsColumn,
])

const INITIAL_SORTING: Record<Mode, SortingState> = {
  open: [{ id: "opened", desc: true }],
  closed: [{ id: "closed", desc: true }],
}

interface TradesTableProps extends TradeActions {
  trades: Trade[]
  labels: Label[]
  mode: Mode
  quotes: Map<string, Instrument>
  empty: React.ReactNode
}

export function TradesTable({
  trades,
  labels,
  mode,
  quotes,
  empty,
  onEdit,
  onClose,
  onReopen,
  onDelete,
  onTrail,
}: TradesTableProps) {
  const data = useMemo(() => {
    const labelById = new Map(labels.map((label) => [label.id, label]))
    return trades.map((trade) => toRow(trade, quotes.get(trade.symbol), labelById))
  }, [trades, labels, quotes])

  const table = useTable({
    features,
    columns: mode === "open" ? openColumns : closedColumns,
    data,
    getRowId: (row) => row.trade.id,
    initialState: { sorting: INITIAL_SORTING[mode] },
    enableSortingRemoval: false,
  })

  if (!trades.length) return <div className="py-14">{empty}</div>

  return (
    <ActionsContext.Provider value={{ mode, onEdit, onClose, onReopen, onDelete, onTrail }}>
      <Table className="font-mono text-xs tabular-nums">
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="font-sans hover:bg-transparent">
              {group.headers.map((header) => {
                const right = RIGHT_ALIGNED.has(header.column.id)
                const sorted = header.column.getIsSorted()
                return (
                  <TableHead
                    key={header.id}
                    className={cn(
                      right && "text-right",
                      header.column.id === "symbol" && "pl-4",
                      header.column.id === "actions" && "w-10 pr-4"
                    )}
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          "group/sort inline-flex items-center gap-1 outline-none hover:text-foreground focus-visible:underline",
                          right && "flex-row-reverse",
                          sorted && "text-foreground"
                        )}
                      >
                        <table.FlexRender header={header} />
                        <HugeiconsIcon
                          icon={sorted === "asc" ? ArrowUp01Icon : sorted === "desc" ? ArrowDown01Icon : ArrowUpDownIcon}
                          strokeWidth={2}
                          className={cn("size-3", !sorted && "opacity-0 group-hover/sort:opacity-50")}
                        />
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cn(
                    "py-2.5 align-middle",
                    RIGHT_ALIGNED.has(cell.column.id) && "text-right",
                    cell.column.id === "symbol" && "pl-4",
                    cell.column.id === "actions" && "pr-4"
                  )}
                >
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ActionsContext.Provider>
  )
}

function SymbolCell({ row }: { row: TradeRow }) {
  const { onEdit } = useActions()
  const { trade } = row
  return (
    <button
      type="button"
      onClick={() => onEdit(trade)}
      className="flex items-center gap-2.5 text-left font-sans outline-none focus-visible:underline"
    >
      <SymbolLogo ticker={logoTicker(trade.symbol, trade.underlying, row.exchange)} size={30} />
      <span className="flex flex-col gap-0.5">
        <span className="font-medium" title={trade.symbol}>
          {row.title}
        </span>
        <span className="flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
          <span className={cn("font-medium uppercase", trade.side === "long" ? "text-profit" : "text-loss")}>
            {trade.side}
          </span>
          <span>•</span>
          <span className="capitalize">{trade.instrument}</span>
          {row.exchange && (
            <>
              <span>•</span>
              <span>{row.exchange}</span>
            </>
          )}
        </span>
      </span>
    </button>
  )
}

function StopCell({ trade }: { trade: Trade }) {
  const moves = trade.stopHistory.length - 1
  const ratio = rewardToRisk(trade)
  const target =
    trade.target !== null ? `T ${formatNumber(trade.target)}${ratio !== null ? ` • ${formatRatio(ratio, "R")}` : ""}` : undefined

  const stop =
    trade.stopLoss === null ? (
      <span className="text-loss">no stop</span>
    ) : (
      <span className="inline-flex items-center justify-end gap-1.5">
        {isRiskFree(trade) ? (
          <span className="rounded-sm bg-profit/12 px-1 font-sans text-[0.625rem] font-medium text-profit">Risk-free</span>
        ) : (
          moves > 0 && (
            <span className="rounded-sm bg-muted px-1 font-sans text-[0.625rem] text-muted-foreground">
              Trailed {moves}×
            </span>
          )
        )}
        {formatNumber(trade.stopLoss)}
      </span>
    )

  if (moves < 1) return <Stack top={stop} bottom={target} />

  return (
    <Tooltip>
      <TooltipTrigger render={<div className="cursor-default" />}>
        <Stack top={stop} bottom={target} />
      </TooltipTrigger>
      <TooltipContent className="font-mono tabular-nums">
        {trade.stopHistory.map((move, index) => (
          <div key={`${move.date}-${index}`}>
            {format(parseISO(move.date), "d MMM")} • {formatNumber(move.price)}
            {index === 0 && " (initial)"}
          </div>
        ))}
      </TooltipContent>
    </Tooltip>
  )
}

function RowActions({ trade }: { trade: Trade }) {
  const { mode, onEdit, onClose, onReopen, onDelete, onTrail } = useActions()
  return (
    <div className="flex items-center justify-end gap-1 font-sans">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Open ${trade.symbol} in TradingView`}
              nativeButton={false}
              render={
                <a
                  href={tradingViewUrl(trade.symbol, trade.underlying, trade.exchange)}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            />
          }
        >
          <HugeiconsIcon icon={ChartLineData02Icon} strokeWidth={2} />
        </TooltipTrigger>
        <TooltipContent>Open chart in TradingView</TooltipContent>
      </Tooltip>
      {mode === "open" && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Trail stop for ${trade.symbol}`}
                onClick={() => onTrail(trade)}
              />
            }
          >
            <HugeiconsIcon icon={ArrowMoveUpRightIcon} strokeWidth={2} />
          </TooltipTrigger>
          <TooltipContent>{trade.stopLoss === null ? "Set stop" : "Trail stop"}</TooltipContent>
        </Tooltip>
      )}
      {mode === "open" && (
        <Button size="sm" variant="outline" onClick={() => onClose(trade)}>
          <HugeiconsIcon icon={CheckmarkCircle02Icon} strokeWidth={2} data-icon="inline-start" />
          Close
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label={`Actions for ${trade.symbol}`} />}>
          <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
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
