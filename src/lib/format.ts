const currencyFormatters = new Map<string, Intl.NumberFormat>()

export function formatMoney(value: number, currency: string, { signed = false } = {}) {
  const key = `${currency}:${signed}`
  let formatter = currencyFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
      signDisplay: signed ? "exceptZero" : "auto",
    })
    currencyFormatters.set(key, formatter)
  }
  return formatter.format(value)
}

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 })

export function formatNumber(value: number) {
  return numberFormatter.format(value)
}

export function formatPercent(value: number | null, digits = 1) {
  if (value === null) return "—"
  return `${(value * 100).toFixed(digits)}%`
}

export function formatRatio(value: number | null, suffix = "") {
  if (value === null) return "—"
  if (value === Infinity) return "∞"
  return `${value.toFixed(2)}${suffix}`
}

export function pnlTone(value: number) {
  if (value > 0) return "text-profit"
  if (value < 0) return "text-loss"
  return "text-muted-foreground"
}

export function todayIso() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}
