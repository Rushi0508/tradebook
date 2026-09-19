import type { Trade } from "@/lib/types"

export function isOpen(trade: Trade) {
  return trade.exitPrice === null
}

function direction(trade: Trade) {
  return trade.side === "long" ? 1 : -1
}

function units(trade: Trade) {
  return trade.quantity * trade.multiplier
}

export function realizedPnl(trade: Trade) {
  if (trade.exitPrice === null) return 0
  return (trade.exitPrice - trade.entryPrice) * direction(trade) * units(trade) - trade.fees
}

export function unrealizedPnl(trade: Trade, lastPrice: number) {
  return (lastPrice - trade.entryPrice) * direction(trade) * units(trade)
}

export function initialRisk(trade: Trade) {
  if (trade.initialStop === null) return null
  return Math.abs(trade.entryPrice - trade.initialStop) * units(trade)
}

export function rewardToRisk(trade: Pick<Trade, "entryPrice" | "initialStop" | "target">) {
  if (trade.initialStop === null || trade.target === null) return null
  const risk = Math.abs(trade.entryPrice - trade.initialStop)
  return risk ? Math.abs(trade.target - trade.entryPrice) / risk : null
}

export function lockedProfit(trade: Trade) {
  if (trade.stopLoss === null) return 0
  return Math.max(0, (trade.stopLoss - trade.entryPrice) * direction(trade) * units(trade))
}

export function isRiskFree(trade: Trade) {
  return trade.stopLoss !== null && (trade.stopLoss - trade.entryPrice) * direction(trade) >= 0
}

export function isWideningStop(trade: Trade, price: number) {
  return trade.stopLoss !== null && (price - trade.stopLoss) * direction(trade) < 0
}

export function openRisk(trade: Trade) {
  if (trade.stopLoss === null) return null
  return Math.max(0, (trade.entryPrice - trade.stopLoss) * direction(trade) * units(trade))
}

export function rMultiple(trade: Trade) {
  const risk = initialRisk(trade)
  if (!risk || trade.exitPrice === null) return null
  return realizedPnl(trade) / risk
}

export function positionValue(trade: Trade) {
  return trade.entryPrice * units(trade)
}

export function byExitOrder(a: Trade, b: Trade) {
  return (a.exitDate ?? "").localeCompare(b.exitDate ?? "") || a.createdAt - b.createdAt
}

export interface OpenRiskSummary {
  total: number
  count: number
  withoutStop: number
  locked: number
}

export function summarizeOpenRisk(trades: Trade[]): OpenRiskSummary {
  let total = 0
  let withoutStop = 0
  let locked = 0
  for (const trade of trades) {
    locked += lockedProfit(trade)
    const risk = openRisk(trade)
    if (risk === null) withoutStop++
    else total += risk
  }
  return { total, count: trades.length, withoutStop, locked }
}

export interface DeployedSummary {
  cost: number
  market: number
  positions: number
  excluded: number
  unpriced: number
}

export function countsAsDeployed(trade: Trade) {
  return trade.side === "long" && trade.instrument !== "future"
}

export function summarizeDeployed(trades: Trade[], lastPrice: (trade: Trade) => number | null): DeployedSummary {
  const summary: DeployedSummary = { cost: 0, market: 0, positions: 0, excluded: 0, unpriced: 0 }
  for (const trade of trades) {
    if (!countsAsDeployed(trade)) {
      summary.excluded++
      continue
    }
    const cost = positionValue(trade)
    const last = lastPrice(trade)
    summary.positions++
    summary.cost += cost
    if (last === null) summary.unpriced++
    summary.market += last === null ? cost : last * units(trade)
  }
  return summary
}

export interface PerformanceStats {
  trades: number
  wins: number
  losses: number
  netPnl: number
  grossProfit: number
  grossLoss: number
  winRate: number | null
  avgWin: number | null
  avgLoss: number | null
  expectancy: number | null
  expectancyR: number | null
  profitFactor: number | null
}

export function computeStats(closed: Trade[]): PerformanceStats {
  let grossProfit = 0
  let grossLoss = 0
  let wins = 0
  let losses = 0
  let rSum = 0
  let rCount = 0

  for (const trade of closed) {
    const pnl = realizedPnl(trade)
    if (pnl > 0) {
      wins++
      grossProfit += pnl
    } else if (pnl < 0) {
      losses++
      grossLoss += -pnl
    }
    const r = rMultiple(trade)
    if (r !== null) {
      rSum += r
      rCount++
    }
  }

  const count = closed.length
  const netPnl = grossProfit - grossLoss

  return {
    trades: count,
    wins,
    losses,
    netPnl,
    grossProfit,
    grossLoss,
    winRate: count ? wins / count : null,
    avgWin: wins ? grossProfit / wins : null,
    avgLoss: losses ? grossLoss / losses : null,
    expectancy: count ? netPnl / count : null,
    expectancyR: rCount ? rSum / rCount : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null,
  }
}

export function monthKey(date: string) {
  return date.slice(0, 7)
}

export function pnlByMonth(closed: Trade[], year: number) {
  const months = Array.from({ length: 12 }, (_, i) => ({
    key: `${year}-${String(i + 1).padStart(2, "0")}`,
    pnl: 0,
    trades: 0,
  }))
  for (const trade of closed) {
    if (!trade.exitDate || !trade.exitDate.startsWith(String(year))) continue
    const month = months[Number(trade.exitDate.slice(5, 7)) - 1]
    month.pnl += realizedPnl(trade)
    month.trades++
  }
  return months
}
