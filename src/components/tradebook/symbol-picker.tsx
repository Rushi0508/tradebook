"use client"

import { useMemo } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { Autocomplete } from "@base-ui/react/autocomplete"

import { logoTicker, SymbolLogo } from "@/components/tradebook/symbol-logo"
import { ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxList } from "@/components/ui/combobox"
import { db } from "@/lib/db"
import { formatNumber } from "@/lib/format"
import { describeInstrument } from "@/lib/market/describe"
import type { Instrument } from "@/lib/market/types"

const LIMIT = 40
const KIND_ORDER = { stock: 0, future: 1, option: 2 } as const

interface Indexed {
  instrument: Instrument
  haystack: string
}

function search(index: Indexed[], query: string) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!tokens.length) return []
  const first = tokens[0]
  const matches: { instrument: Instrument; score: number }[] = []
  for (const entry of index) {
    if (!tokens.every((token) => entry.haystack.includes(token))) continue
    const { instrument } = entry
    const symbol = instrument.symbol.toLowerCase()
    const underlying = instrument.underlying?.toLowerCase()
    const score =
      symbol === first ? 0 : symbol.startsWith(first) || underlying === first ? 1 : underlying?.startsWith(first) ? 2 : 3
    matches.push({ instrument, score })
  }
  matches.sort(
    (a, b) =>
      a.score - b.score ||
      KIND_ORDER[a.instrument.kind] - KIND_ORDER[b.instrument.kind] ||
      (a.instrument.expiry ?? "").localeCompare(b.instrument.expiry ?? "") ||
      (a.instrument.strike ?? 0) - (b.instrument.strike ?? 0) ||
      a.instrument.symbol.localeCompare(b.instrument.symbol)
  )
  return matches.slice(0, LIMIT).map((match) => match.instrument)
}

interface SymbolPickerProps {
  id?: string
  value: string
  onValueChange: (value: string) => void
  onSelect: (instrument: Instrument) => void
  invalid?: boolean
}

export function SymbolPicker({ id, value, onValueChange, onSelect, invalid }: SymbolPickerProps) {
  const instruments = useLiveQuery(() => db.instruments.toArray(), [])

  const index = useMemo<Indexed[]>(
    () =>
      (instruments ?? []).map((instrument) => ({
        instrument,
        haystack: `${instrument.symbol} ${describeInstrument(instrument)} ${instrument.strike ?? ""}`.toLowerCase(),
      })),
    [instruments]
  )

  const items = useMemo(() => search(index, value), [index, value])

  return (
    <Autocomplete.Root
      items={items}
      filter={null}
      autoHighlight
      value={value}
      onValueChange={(next, details) => {
        onValueChange(next)
        if (details.reason === "input-change") return
        const picked = items.find((instrument) => instrument.symbol === next)
        if (picked) onSelect(picked)
      }}
      itemToStringValue={(instrument: Instrument) => instrument.symbol}
    >
      <ComboboxInput
        id={id}
        autoFocus
        autoComplete="off"
        placeholder={instruments?.length ? "Search NSE stocks, futures, options" : "Symbol"}
        showTrigger={false}
        className="w-full [&_input]:uppercase [&_input]:placeholder:normal-case"
        aria-invalid={invalid}
      />
      <ComboboxContent className="w-[calc(var(--anchor-width)+10rem)]">
        {value.trim() && (
          <ComboboxEmpty>
            {instruments?.length ? "No NSE match. The symbol will be saved as typed." : "Market list not loaded yet"}
          </ComboboxEmpty>
        )}
        <ComboboxList>
          {(instrument: Instrument) => (
            <Autocomplete.Item
              key={instrument.symbol}
              value={instrument}
              className="relative flex min-h-7 w-full cursor-default items-center gap-2.5 rounded-md px-2 py-1 text-xs/relaxed outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground"
            >
              <SymbolLogo ticker={logoTicker(instrument.symbol, instrument.underlying, "NSE")} size={20} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {instrument.kind === "stock" ? instrument.symbol : describeInstrument(instrument)}
                </div>
                <div className="truncate text-[0.6875rem] text-muted-foreground">
                  {instrument.kind === "stock"
                    ? instrument.name
                    : `${instrument.kind === "option" ? "Option" : "Future"} · lot ${instrument.lot}`}
                </div>
              </div>
              {instrument.close !== null && (
                <span className="font-mono text-[0.6875rem] text-muted-foreground tabular-nums">
                  {formatNumber(instrument.close)}
                </span>
              )}
            </Autocomplete.Item>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Autocomplete.Root>
  )
}
