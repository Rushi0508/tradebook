"use client"

import { format, parseISO } from "date-fns"
import { useLiveQuery } from "dexie-react-hooks"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { db, undoStopMove } from "@/lib/db"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

export function StopHistory({ tradeId }: { tradeId: string }) {
  const trade = useLiveQuery(() => db.trades.get(tradeId), [tradeId])
  if (!trade || trade.stopHistory.length < 2) return null

  const direction = trade.side === "long" ? 1 : -1

  return (
    <div className="grid gap-2 rounded-md border px-3 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">Stop history</span>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={async () => {
            await undoStopMove(trade.id)
            toast.success("Last stop move removed")
          }}
        >
          Undo last move
        </Button>
      </div>
      <ol className="grid gap-1 font-mono text-[0.6875rem] tabular-nums">
        {trade.stopHistory.map((move, index) => {
          const previous = trade.stopHistory[index - 1]
          const change = previous ? (move.price - previous.price) * direction : 0
          return (
            <li key={`${move.date}-${index}`} className="flex items-center gap-2">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  index === trade.stopHistory.length - 1 ? "bg-foreground" : "bg-muted-foreground/40"
                )}
              />
              <span className="w-20 text-muted-foreground">{format(parseISO(move.date), "d MMM yy")}</span>
              <span className="flex-1">{formatNumber(move.price)}</span>
              <span className={cn(!previous ? "text-muted-foreground" : change >= 0 ? "text-profit" : "text-loss")}>
                {previous ? `${change >= 0 ? "tightened" : "widened"} ${formatNumber(Math.abs(move.price - previous.price))}` : "initial"}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
