import type { Trade, TradeExit } from "@/lib/types"

function direction(trade: Pick<Trade, "side">) {
  return trade.side === "long" ? 1 : -1
}

function units(trade: Trade) {
  return trade.quantity * trade.multiplier
}

export function exitedQuantity(trade: Trade) {
  return trade.exits.reduce((sum, exit) => sum + exit.quantity, 0)
}

export function remainingQuantity(trade: Trade) {
  return Math.max(0, trade.quantity - exitedQuantity(trade))
}

function remainingUnits(trade: Trade) {
  return remainingQuantity(trade) * trade.multiplier
}

export function isOpen(trade: Trade) {
  return remainingQuantity(trade) > 0
}

export function isPartiallyExited(trade: Trade) {
  return trade.exits.length > 0 && isOpen(trade)
}

export function lastExitDate(trade: Trade) {
  return trade.exits.reduce<string | null>((latest, exit) => (!latest || exit.date > latest ? exit.date : latest), null)
}

export function averageExitPrice(trade: Trade) {
  const quantity = exitedQuantity(trade)
  if (!quantity) return null
  return trade.exits.reduce((sum, exit) => sum + exit.price * exit.quantity, 0) / quantity
}

export function exitPnl(trade: Trade, exit: Pick<TradeExit, "price" | "quantity" | "fees">) {
  return (exit.price - trade.entryPrice) * direction(trade) * exit.quantity * trade.multiplier - exit.fees
}

function firstExitDate(trade: Trade) {
  return trade.exits.reduce<string | null>((first, exit) => (!first || exit.date < first ? exit.date : first), null)
}

export function realizedPnl(trade: Trade) {
  if (!trade.exits.length) return 0
  return trade.exits.reduce((sum, exit) => sum + exitPnl(trade, exit), 0) - trade.fees
}

export function realizedPnlIn(trade: Trade, period: string | null) {
  if (period === null) return realizedPnl(trade)
  let pnl = 0
  for (const exit of trade.exits) if (exit.date.startsWith(period)) pnl += exitPnl(trade, exit)
  if (firstExitDate(trade)?.startsWith(period)) pnl -= trade.fees
  return pnl
}

export function unrealizedPnl(trade: Trade, lastPrice: number) {
  return (lastPrice - trade.entryPrice) * direction(trade) * remainingUnits(trade)
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
  return Math.max(0, (trade.stopLoss - trade.entryPrice) * direction(trade) * remainingUnits(trade))
}

export function isRiskFree(trade: Trade) {
  return trade.stopLoss !== null && (trade.stopLoss - trade.entryPrice) * direction(trade) >= 0
}

export function isWideningStop(trade: Trade, price: number) {
  return trade.stopLoss !== null && (price - trade.stopLoss) * direction(trade) < 0
}

export function openRisk(trade: Trade) {
  if (trade.stopLoss === null) return null
  return Math.max(0, (trade.entryPrice - trade.stopLoss) * direction(trade) * remainingUnits(trade))
}

export function rMultiple(trade: Trade) {
  const risk = initialRisk(trade)
  if (!risk || !trade.exits.length) return null
  return realizedPnl(trade) / risk
}

export function positionValue(trade: Trade) {
  return trade.entryPrice * remainingUnits(trade)
}

export function byExitOrder(a: Trade, b: Trade) {
  return (lastExitDate(a) ?? "").localeCompare(lastExitDate(b) ?? "") || a.createdAt - b.createdAt
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
    summary.market += last === null ? cost : last * remainingUnits(trade)
  }
  return summary
}

export interface PerformanceStats {
  trades: number
  wins: number
  losses: number
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

  return {
    trades: count,
    wins,
    losses,
    grossProfit,
    grossLoss,
    winRate: count ? wins / count : null,
    avgWin: wins ? grossProfit / wins : null,
    avgLoss: losses ? grossLoss / losses : null,
    expectancy: count ? (grossProfit - grossLoss) / count : null,
    expectancyR: rCount ? rSum / rCount : null,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null,
  }
}

export function pnlByMonth(trades: Trade[], year: number) {
  const months = Array.from({ length: 12 }, (_, i) => ({
    key: `${year}-${String(i + 1).padStart(2, "0")}`,
    pnl: 0,
    trades: 0,
  }))
  for (const trade of trades) {
    const first = firstExitDate(trade)
    for (const exit of trade.exits) {
      if (!exit.date.startsWith(String(year))) continue
      const month = months[Number(exit.date.slice(5, 7)) - 1]
      month.pnl += exitPnl(trade, exit)
      month.trades++
    }
    if (first?.startsWith(String(year))) months[Number(first.slice(5, 7)) - 1].pnl -= trade.fees
  }
  return months
}
