import { format, parseISO } from "date-fns"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

interface MonthStripProps {
  months: { key: string; pnl: number; trades: number }[]
  selected: string | null
  currentMonth: string
  currency: string
  onSelect: (key: string) => void
}

export function MonthStrip({ months, selected, currentMonth, currency, onSelect }: MonthStripProps) {
  const max = Math.max(...months.map((month) => Math.abs(month.pnl)), 1)
  const yearTotal = months.reduce((sum, month) => sum + month.pnl, 0)

  return (
    <div className="rounded-lg bg-card px-4 pt-3 pb-2 ring-1 ring-border">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-[0.6875rem] tracking-wide text-muted-foreground uppercase">
          Monthly P&amp;L · {months[0].key.slice(0, 4)}
        </div>
        <div
          className={cn(
            "font-mono text-xs tabular-nums",
            yearTotal > 0 ? "text-profit" : yearTotal < 0 ? "text-loss" : "text-muted-foreground"
          )}
        >
          {formatMoney(yearTotal, currency, { signed: true })}
        </div>
      </div>
      <div className="grid grid-cols-12 gap-1">
        {months.map((month) => {
          const height = (Math.abs(month.pnl) / max) * 100
          const isSelected = month.key === selected
          const isFuture = month.key > currentMonth
          return (
            <Tooltip key={month.key}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => onSelect(month.key)}
                    disabled={isFuture}
                    className={cn(
                      "group flex flex-col items-stretch gap-1 rounded-md px-1 pt-1 pb-0.5 transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-40",
                      isSelected && "bg-muted"
                    )}
                  />
                }
              >
                <div className="relative h-14">
                  <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
                  {month.pnl !== 0 && (
                    <div
                      className={cn(
                        "absolute inset-x-1 rounded-[2px]",
                        month.pnl > 0 ? "bottom-1/2 bg-profit" : "top-1/2 bg-loss",
                        !isSelected && "opacity-70 group-hover:opacity-100"
                      )}
                      style={{ height: `${Math.max(height / 2, 2)}%` }}
                    />
                  )}
                </div>
                <div
                  className={cn(
                    "text-center text-[0.625rem] text-muted-foreground",
                    isSelected && "font-medium text-foreground"
                  )}
                >
                  {format(parseISO(`${month.key}-01`), "MMM")}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {format(parseISO(`${month.key}-01`), "MMMM yyyy")} ·{" "}
                {month.trades ? formatMoney(month.pnl, currency, { signed: true }) : "no trades"}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}
