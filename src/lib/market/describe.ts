import { format, parseISO } from "date-fns"

import { formatNumber } from "@/lib/format"
import type { Instrument } from "@/lib/market/types"

export function describeInstrument(instrument: Instrument) {
  if (instrument.kind === "stock") return instrument.name
  const expiry = instrument.expiry ? format(parseISO(instrument.expiry), "d MMM yy") : ""
  if (instrument.kind === "future") return `${instrument.underlying} ${expiry} FUT`
  return `${instrument.underlying} ${expiry} ${formatNumber(instrument.strike ?? 0)} ${instrument.optionType}`
}
