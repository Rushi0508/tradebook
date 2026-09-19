import { HugeiconsIcon } from "@hugeicons/react"
import { InformationCircleIcon } from "@hugeicons/core-free-icons"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatMoney, formatPercent, formatRatio, pnlTone } from "@/lib/format"
import type { DeployedSummary, OpenRiskSummary, PerformanceStats } from "@/lib/metrics"
import { TOOLTIPS, type TooltipKey } from "@/lib/tooltips"
import { cn } from "@/lib/utils"

interface StatCardsProps {
  stats: PerformanceStats
  risk: OpenRiskSummary
  deployed: DeployedSummary
  periodLabel: string
}

export function StatCards({ stats, risk, deployed, periodLabel }: StatCardsProps) {
  const marketChange = deployed.market - deployed.cost
  const money = (value: number, signed = false) => formatMoney(value, { signed })

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border ring-1 ring-border md:grid-cols-3 xl:grid-cols-6">
      <Stat
        label={`Net P&L • ${periodLabel}`}
        info="netPnl"
        value={money(stats.netPnl, true)}
        tone={pnlTone(stats.netPnl)}
        detail={`${stats.trades} closed • ${stats.wins}W ${stats.losses}L`}
      />
      <Stat
        label="Open risk"
        info="openRisk"
        value={money(risk.total)}
        tone={risk.total > 0 ? "text-warning" : undefined}
        detail={
          <>
            {risk.count} open
            {risk.locked > 0 && <span className="text-profit"> • {money(risk.locked)} locked</span>}
            {risk.withoutStop > 0 && <span className="text-loss"> • {risk.withoutStop} without stop</span>}
          </>
        }
      />
      <Stat
        label="Capital deployed"
        info="capitalDeployed"
        value={money(deployed.cost)}
        detail={
          <>
            {deployed.positions ? (
              <>
                {formatMoney(deployed.market, { compact: true })} at market
                {marketChange !== 0 && deployed.cost > 0 && (
                  <span className={pnlTone(marketChange)}>
                    {" "}
                    {marketChange > 0 ? "+" : ""}
                    {formatPercent(marketChange / deployed.cost, 2)}
                  </span>
                )}
              </>
            ) : (
              "No open positions"
            )}
            {deployed.excluded > 0 && (
              <span title={`${deployed.excluded} futures or short positions are not counted, since they use margin`}>
                {" "}
                • {deployed.excluded} excl.
              </span>
            )}
          </>
        }
      />
      <Stat
        label="Win rate"
        info="winRate"
        value={formatPercent(stats.winRate)}
        detail={
          stats.avgWin !== null || stats.avgLoss !== null
            ? `Avg win ${stats.avgWin !== null ? money(stats.avgWin) : "—"} • loss ${
                stats.avgLoss !== null ? money(stats.avgLoss) : "—"
              }`
            : "No closed trades"
        }
      />
      <Stat
        label="Expectancy"
        info="expectancy"
        value={stats.expectancy !== null ? money(stats.expectancy, true) : "—"}
        tone={stats.expectancy !== null ? pnlTone(stats.expectancy) : undefined}
        detail={stats.expectancyR !== null ? `${formatRatio(stats.expectancyR, "R")} per trade` : "Per closed trade"}
      />
      <Stat
        label="Profit factor"
        info="profitFactor"
        value={formatRatio(stats.profitFactor)}
        tone={
          stats.profitFactor === null ? undefined : stats.profitFactor >= 1 ? "text-profit" : "text-loss"
        }
        detail={`${money(stats.grossProfit)} / ${money(stats.grossLoss)}`}
      />
    </div>
  )
}

function Stat({
  label,
  info,
  value,
  detail,
  tone,
}: {
  label: string
  info: TooltipKey
  value: string
  detail: React.ReactNode
  tone?: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-card px-4 py-3">
      <div className="flex items-center gap-1 text-[0.6875rem] tracking-wide text-muted-foreground uppercase">
        <span className="truncate">{label}</span>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={`About ${label}`}
                className="shrink-0 rounded-full opacity-60 outline-none hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            }
          >
            <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} className="size-3" />
          </TooltipTrigger>
          <TooltipContent className="max-w-64 normal-case tracking-normal">{TOOLTIPS[info]}</TooltipContent>
        </Tooltip>
      </div>
      <div className={cn("truncate font-mono text-xl font-medium tabular-nums", tone)}>{value}</div>
      <div className="truncate text-[0.6875rem] text-muted-foreground">{detail}</div>
    </div>
  )
}
