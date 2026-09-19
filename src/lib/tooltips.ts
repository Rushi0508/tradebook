export const TOOLTIPS = {
  netPnl:
    "Realized profit after charges from every exit in the selected month, including partial exits of positions you still hold. Profit on the part you still hold is not counted until you exit it.",
  openRisk:
    "What you would lose if every open trade hit its current stop. Stops trailed past entry count as zero risk and show the profit they have locked in. Trades without a stop are flagged separately.",
  capitalDeployed:
    "Money tied up in open positions at their entry price. Below it is their value at the last close and the % move. Futures and short positions use margin, so they are not counted.",
  winRate:
    "Share of fully closed trades that made money. Read it with the average win and loss: a low win rate can still be profitable when winners are bigger than losers.",
  expectancy:
    "Average profit per fully closed trade, counting all of its exits. The R figure is that average in units of initial risk: 0.5R means you make half of what you risk per trade.",
  profitFactor:
    "Total profit from winning trades divided by total loss from losing trades, using fully closed trades. Above 1 means you are profitable; above 1.5 is generally considered strong.",
  stopTarget:
    "Current stop, trailed or not, with the target and reward-to-risk below. Reward-to-risk uses the initial stop, so it does not change when you trail.",
  last: "Closing price from the latest NSE/BSE bhav copy, with the % move since your entry.",
  unrealized:
    "Profit or loss on the quantity you still hold, at the last close, with the % move and how many R it is worth. Charges are not included until you exit.",
  tradeRisk: "Loss if this trade hits its current stop. Zero once the stop is at or past your entry.",
  pnl: "Realized profit after charges across all exits, with the R-multiple measured from the initial stop.",
  exitPrice: "Average exit price across all exits, weighted by quantity, with the % move from entry.",
  qtyOpen:
    "Quantity still held, with its value at your entry price. After a partial exit it also shows the original quantity, e.g. 50 of 100.",
} as const

export type TooltipKey = keyof typeof TOOLTIPS
