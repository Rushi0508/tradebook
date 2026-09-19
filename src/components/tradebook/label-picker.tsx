"use client"

import { useMemo, useState } from "react"

import { LabelDot } from "@/components/tradebook/label-dot"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import { createLabel } from "@/lib/db"
import type { Label } from "@/lib/types"

const CREATE_ID = "__create__"

interface LabelPickerProps {
  id?: string
  labels: Label[]
  value: string[]
  onChange: (ids: string[]) => void
}

export function LabelPicker({ id, labels, value, onChange }: LabelPickerProps) {
  const anchor = useComboboxAnchor()
  const [query, setQuery] = useState("")
  const [created, setCreated] = useState<Label[]>([])

  const known = useMemo(() => {
    const byId = new Map(labels.map((label) => [label.id, label]))
    for (const label of created) if (!byId.has(label.id)) byId.set(label.id, label)
    return [...byId.values()]
  }, [labels, created])

  const selected = value.map((labelId) => known.find((label) => label.id === labelId)).filter(Boolean) as Label[]

  const trimmed = query.trim()
  const hasExactMatch = known.some((label) => label.name.toLowerCase() === trimmed.toLowerCase())
  const items: Label[] =
    trimmed && !hasExactMatch ? [...known, { id: CREATE_ID, name: trimmed, color: "transparent" }] : known

  async function handleChange(next: Label[]) {
    const pending = next.find((label) => label.id === CREATE_ID)
    if (!pending) {
      onChange(next.map((label) => label.id))
      return
    }
    const label = await createLabel(pending.name)
    setCreated((prev) => [...prev, label])
    setQuery("")
    onChange([...next.filter((item) => item.id !== CREATE_ID).map((item) => item.id), label.id])
  }

  return (
    <Combobox
      multiple
      autoHighlight
      items={items}
      value={selected}
      onValueChange={handleChange}
      inputValue={query}
      onInputValueChange={setQuery}
      itemToStringLabel={(label: Label) => label.name}
      isItemEqualToValue={(a: Label, b: Label) => a.id === b.id}
    >
      <ComboboxChips
        ref={anchor}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault()
        }}
      >
        <ComboboxValue>
          {(values: Label[]) => (
            <>
              {values.map((label) => (
                <ComboboxChip key={label.id}>
                  <LabelDot color={label.color} className="size-1.5" />
                  {label.name}
                </ComboboxChip>
              ))}
              <ComboboxChipsInput
                id={id}
                placeholder={values.length ? "" : "Breakout, earnings, swing…"}
              />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>Type to create a label</ComboboxEmpty>
        <ComboboxList>
          {(label: Label) => (
            <ComboboxItem key={label.id} value={label}>
              {label.id === CREATE_ID ? (
                <span>
                  Create <span className="font-medium">“{label.name}”</span>
                </span>
              ) : (
                <>
                  <LabelDot color={label.color} />
                  {label.name}
                </>
              )}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
