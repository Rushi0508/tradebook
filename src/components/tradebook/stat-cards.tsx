import { formatMoney, formatPercent, formatRatio, pnlTone } from "@/lib/format"
import type { OpenRiskSummary, PerformanceStats } from "@/lib/metrics"
import { cn } from "@/lib/utils"

interface StatCardsProps {
  stats: PerformanceStats
  risk: OpenRiskSummary
  capital: number
  currency: string
  periodLabel: string
}

export function StatCards({ stats, risk, capital, currency, periodLabel }: StatCardsProps) {
  const money = (value: number, signed = false) => formatMoney(value, currency, { signed })
  const riskPct = capital > 0 ? risk.total / capital : null

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border ring-1 ring-border md:grid-cols-3 xl:grid-cols-6">
      <Stat
        label={`Net P&L · ${periodLabel}`}
        value={money(stats.netPnl, true)}
        tone={pnlTone(stats.netPnl)}
        detail={`${stats.trades} closed · ${stats.wins}W ${stats.losses}L`}
      />
      <Stat
        label="Open risk"
        value={money(risk.total)}
        tone={risk.total > 0 ? "text-warning" : undefined}
        detail={
          <>
            {riskPct !== null && <span>{formatPercent(riskPct, 2)} of capital · </span>}
            {risk.count} open
            {risk.withoutStop > 0 && <span className="text-loss"> · {risk.withoutStop} without stop</span>}
          </>
        }
      />
      <Stat
        label="Win rate"
        value={formatPercent(stats.winRate)}
        detail={
          stats.avgWin !== null || stats.avgLoss !== null
            ? `Avg win ${stats.avgWin !== null ? money(stats.avgWin) : "—"} · loss ${
                stats.avgLoss !== null ? money(stats.avgLoss) : "—"
              }`
            : "No closed trades"
        }
      />
      <Stat
        label="Expectancy"
        value={stats.expectancy !== null ? money(stats.expectancy, true) : "—"}
        tone={stats.expectancy !== null ? pnlTone(stats.expectancy) : undefined}
        detail={stats.expectancyR !== null ? `${formatRatio(stats.expectancyR, "R")} per trade` : "Per closed trade"}
      />
      <Stat
        label="Profit factor"
        value={formatRatio(stats.profitFactor)}
        tone={
          stats.profitFactor === null ? undefined : stats.profitFactor >= 1 ? "text-profit" : "text-loss"
        }
        detail={`${money(stats.grossProfit)} / ${money(stats.grossLoss)}`}
      />
      <Stat
        label="Max drawdown"
        value={stats.maxDrawdown > 0 ? money(-stats.maxDrawdown) : money(0)}
        tone={stats.maxDrawdown > 0 ? "text-loss" : undefined}
        detail={
          stats.maxDrawdownPct !== null
            ? `${formatPercent(stats.maxDrawdownPct, 2)} from peak`
            : "Peak-to-trough, closed trades"
        }
      />
    </div>
  )
}

function Stat({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string
  detail: React.ReactNode
  tone?: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-card px-4 py-3">
      <div className="truncate text-[0.6875rem] tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className={cn("truncate font-mono text-xl font-medium tabular-nums", tone)}>{value}</div>
      <div className="truncate text-[0.6875rem] text-muted-foreground">{detail}</div>
    </div>
  )
}
