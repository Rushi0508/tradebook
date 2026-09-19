export const TOOLTIPS = {
  netPnl:
    "Realized profit after fees from trades closed in the selected month. Open positions are not counted until they are closed.",
  openRisk:
    "What you would lose if every open trade hit its current stop. Stops trailed past entry count as zero risk and show the profit they have locked in. Trades without a stop are flagged separately.",
  capitalDeployed:
    "Money tied up in open positions at their entry price. Below it is their value at the last close and the % move. Futures and short positions use margin, so they are not counted.",
  winRate:
    "Share of closed trades that made money. Read it with the average win and loss: a low win rate can still be profitable when winners are bigger than losers.",
  expectancy:
    "Average profit per closed trade. The R figure is that average in units of initial risk: 0.5R means you make half of what you risk per trade.",
  profitFactor:
    "Total profit from winning trades divided by total loss from losing trades. Above 1 means you are profitable; above 1.5 is generally considered strong.",
  stopTarget:
    "Current stop, trailed or not, with the target and reward-to-risk below. Reward-to-risk uses the initial stop, so it does not change when you trail.",
  last: "Closing price from the latest NSE/BSE bhav copy, with the % move since your entry.",
  unrealized:
    "Profit or loss on the open position at the last close, with the % move and how many R it is worth. Fees are not included until you close.",
  tradeRisk: "Loss if this trade hits its current stop. Zero once the stop is at or past your entry.",
  pnl: "Realized profit after fees, with the R-multiple measured from the initial stop.",
} as const

export type TooltipKey = keyof typeof TOOLTIPS
