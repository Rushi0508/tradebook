"use client"

import { useEffect, useMemo, useState } from "react"
import { addMonths, format, parseISO } from "date-fns"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  BookOpen01Icon,
  Moon02Icon,
  RefreshIcon,
  Settings02Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons"

import { CloseTradeDialog } from "@/components/tradebook/close-trade-dialog"
import { LabelFilter } from "@/components/tradebook/label-filter"
import { MonthStrip } from "@/components/tradebook/month-strip"
import { SettingsDialog } from "@/components/tradebook/settings-dialog"
import { StatCards } from "@/components/tradebook/stat-cards"
import { TradeFormSheet } from "@/components/tradebook/trade-form"
import { TradesTable } from "@/components/tradebook/trades-table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useMarketSync, useQuotes } from "@/hooks/use-market"
import { useTradebook } from "@/hooks/use-tradebook"
import { deleteTrade, reopenTrade, requestPersistentStorage } from "@/lib/db"
import { formatMoney, pnlTone, todayIso } from "@/lib/format"
import {
  byExitOrder,
  computeStats,
  isOpen,
  pnlByMonth,
  realizedPnl,
  summarizeOpenRisk,
  unrealizedPnl,
} from "@/lib/metrics"
import type { Trade } from "@/lib/types"
import { cn } from "@/lib/utils"

export function Dashboard() {
  const data = useTradebook()
  const [persisted, setPersisted] = useState<boolean | null>(null)

  useEffect(() => {
    requestPersistentStorage().then(setPersisted, () => setPersisted(false))
  }, [])

  if (!data) return <DashboardSkeleton />
  return <DashboardView {...data} persisted={persisted} />
}

function DashboardView({
  trades,
  labels,
  settings,
  persisted,
}: NonNullable<ReturnType<typeof useTradebook>> & { persisted: boolean | null }) {
  const currentMonth = todayIso().slice(0, 7)
  const [period, setPeriod] = useState<string | null>(currentMonth)
  const [labelFilter, setLabelFilter] = useState<string[]>([])
  const [tab, setTab] = useState<"open" | "closed">("open")
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Trade | undefined>()
  const [closing, setClosing] = useState<Trade | null>(null)
  const [deleting, setDeleting] = useState<Trade | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const market = useMarketSync()

  const view = useMemo(() => {
    const matches = (trade: Trade) =>
      labelFilter.length === 0 || trade.labels.some((id) => labelFilter.includes(id))
    const filtered = trades.filter(matches)
    const open = filtered.filter(isOpen).sort((a, b) => b.entryDate.localeCompare(a.entryDate))
    const allClosed = filtered.filter((trade) => !isOpen(trade))
    const closed = (period ? allClosed.filter((trade) => trade.exitDate!.startsWith(period)) : allClosed)
      .sort(byExitOrder)
      .reverse()
    const priorPnl = period
      ? allClosed.filter((trade) => trade.exitDate! < `${period}-01`).reduce((sum, t) => sum + realizedPnl(t), 0)
      : 0
    const year = Number((period ?? currentMonth).slice(0, 4))

    return {
      open,
      closed,
      stats: computeStats(closed, settings.capital > 0 ? settings.capital + priorPnl : null),
      risk: summarizeOpenRisk(open),
      months: pnlByMonth(allClosed, year),
    }
  }, [trades, labelFilter, period, settings.capital, currentMonth])

  const quotes = useQuotes([...view.open, ...view.closed].map((trade) => trade.symbol))
  const priced = view.open.filter((trade) => quotes.get(trade.symbol)?.close != null)
  const unrealized = priced.reduce((sum, trade) => sum + unrealizedPnl(trade, quotes.get(trade.symbol)!.close!), 0)

  const periodLabel = period ? format(parseISO(`${period}-01`), "MMM yyyy") : "All time"

  function shiftMonth(delta: number) {
    const base = parseISO(`${period ?? currentMonth}-01`)
    const next = format(addMonths(base, delta), "yyyy-MM")
    if (next <= currentMonth) setPeriod(next)
  }

  function openForm(trade?: Trade) {
    setEditing(trade)
    setFormOpen(true)
  }

  async function handleReopen(trade: Trade) {
    await reopenTrade(trade.id)
    toast.success(`${trade.symbol} reopened`)
    setTab("open")
  }

  async function confirmDelete() {
    if (!deleting) return
    const trade = deleting
    await deleteTrade(trade.id)
    setDeleting(null)
    toast.success(`${trade.symbol} deleted`)
  }

  const actions = {
    onEdit: openForm,
    onClose: setClosing,
    onReopen: handleReopen,
    onDelete: setDeleting,
  }

  const hasTrades = trades.length > 0

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="mr-auto flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <HugeiconsIcon icon={BookOpen01Icon} strokeWidth={2} className="size-4" />
          </div>
          <span className="text-sm font-semibold tracking-tight">TradeBook</span>
        </div>

        <div className="flex items-center gap-1 rounded-md ring-1 ring-border">
          <Button size="icon" variant="ghost" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          </Button>
          <button
            type="button"
            onClick={() => setPeriod(period ? null : currentMonth)}
            className="min-w-24 rounded-sm px-1 text-center text-xs font-medium outline-none hover:text-foreground/80 focus-visible:ring-2 focus-visible:ring-ring/40"
            title={period ? "Show all time" : "Show current month"}
          >
            {periodLabel}
          </button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Next month"
            disabled={!period || period >= currentMonth}
            onClick={() => shiftMonth(1)}
          >
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
          </Button>
        </div>

        <MarketStatus {...market} />
        <LabelFilter labels={labels} value={labelFilter} onChange={setLabelFilter} />
        <ThemeToggle />
        <Button size="icon" variant="outline" aria-label="Settings" onClick={() => setSettingsOpen(true)}>
          <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} />
        </Button>
        <Button onClick={() => openForm()}>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
          New trade
        </Button>
      </header>

      <StatCards
        stats={view.stats}
        risk={view.risk}
        capital={settings.capital}
        currency={settings.currency}
        periodLabel={periodLabel}
      />

      <MonthStrip
        months={view.months}
        selected={period}
        currentMonth={currentMonth}
        currency={settings.currency}
        onSelect={(key) => setPeriod(key === period ? null : key)}
      />

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as "open" | "closed")}
        className="flex-1 gap-0 overflow-hidden rounded-lg bg-card ring-1 ring-border"
      >
        <div className="flex items-center justify-between border-b px-4 py-2">
          <TabsList>
            <TabsTrigger value="open">
              Open <span className="font-mono text-muted-foreground tabular-nums">{view.open.length}</span>
            </TabsTrigger>
            <TabsTrigger value="closed">
              Closed <span className="font-mono text-muted-foreground tabular-nums">{view.closed.length}</span>
            </TabsTrigger>
          </TabsList>
          <span className="text-[0.6875rem] text-muted-foreground">
            {tab === "open" ? (
              priced.length ? (
                <>
                  Unrealized{" "}
                  <span className={cn("font-mono tabular-nums", pnlTone(unrealized))}>
                    {formatMoney(unrealized, settings.currency, { signed: true })}
                  </span>
                  {priced.length < view.open.length && ` · ${priced.length}/${view.open.length} priced`}
                </>
              ) : (
                "All open positions"
              )
            ) : (
              `Closed in ${periodLabel === "All time" ? "all time" : periodLabel}`
            )}
          </span>
        </div>
        <TabsContent value="open">
          <TradesTable
            mode="open"
            quotes={quotes}
            trades={view.open}
            labels={labels}
            currency={settings.currency}
            empty={
              <EmptyState
                title={hasTrades ? "No open positions" : "Log your first trade"}
                description={
                  hasTrades
                    ? labelFilter.length
                      ? "No open trades match this label filter."
                      : "You are fully in cash."
                    : "Your journal lives only in this browser. Nothing is uploaded anywhere."
                }
                action={!hasTrades ? () => openForm() : undefined}
              />
            }
            {...actions}
          />
        </TabsContent>
        <TabsContent value="closed">
          <TradesTable
            mode="closed"
            quotes={quotes}
            trades={view.closed}
            labels={labels}
            currency={settings.currency}
            empty={
              <EmptyState
                title="No closed trades"
                description={`Nothing was closed in ${periodLabel === "All time" ? "your journal yet" : periodLabel}.`}
              />
            }
            {...actions}
          />
        </TabsContent>
      </Tabs>

      <TradeFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        trade={editing}
        labels={labels}
        currency={settings.currency}
      />
      <CloseTradeDialog
        trade={closing}
        currency={settings.currency}
        onOpenChange={(open) => !open && setClosing(null)}
      />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        labels={labels}
        persisted={persisted}
      />
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.symbol}?</AlertDialogTitle>
            <AlertDialogDescription>This removes the trade from your journal permanently.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: () => void }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && (
        <Button onClick={action}>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
          New trade
        </Button>
      )}
    </Empty>
  )
}

function MarketStatus({
  date,
  syncing,
  error,
  refresh,
}: {
  date: string | null
  syncing: boolean
  error: string | null
  refresh: () => void
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button variant="ghost" onClick={refresh} disabled={syncing} className="text-muted-foreground" />
        }
      >
        <HugeiconsIcon
          icon={RefreshIcon}
          strokeWidth={2}
          data-icon="inline-start"
          className={cn(syncing && "animate-spin", error && "text-loss")}
        />
        {date ? `NSE close ${format(parseISO(date), "d MMM")}` : syncing ? "Loading NSE…" : "NSE prices"}
      </TooltipTrigger>
      <TooltipContent>
        {error ? `Refresh failed: ${error}` : "End-of-day prices from the NSE bhav copy. Updates after 5 PM IST."}
      </TooltipContent>
    </Tooltip>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      size="icon"
      variant="outline"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <HugeiconsIcon icon={Moon02Icon} strokeWidth={2} className="dark:hidden" />
      <HugeiconsIcon icon={Sun03Icon} strokeWidth={2} className="hidden dark:block" />
    </Button>
  )
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6">
      <Skeleton className="h-7 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
