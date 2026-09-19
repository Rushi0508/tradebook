"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Tag01Icon } from "@hugeicons/core-free-icons"

import { LabelDot } from "@/components/tradebook/label-dot"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Label } from "@/lib/types"

interface LabelFilterProps {
  labels: Label[]
  value: string[]
  onChange: (ids: string[]) => void
}

export function LabelFilter({ labels, value, onChange }: LabelFilterProps) {
  const active = labels.filter((label) => value.includes(label.id))

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant={active.length ? "secondary" : "outline"} />}>
        <HugeiconsIcon icon={Tag01Icon} strokeWidth={2} data-icon="inline-start" />
        {active.length === 0 ? (
          "All strategies"
        ) : active.length === 1 ? (
          <>
            <LabelDot color={active[0].color} />
            {active[0].name}
          </>
        ) : (
          `${active.length} strategies`
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Filter by label</DropdownMenuLabel>
          {labels.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Add labels to trades to filter by strategy.
            </div>
          )}
          {labels.map((label) => (
            <DropdownMenuCheckboxItem
              key={label.id}
              checked={value.includes(label.id)}
              onCheckedChange={(checked) =>
                onChange(checked ? [...value, label.id] : value.filter((id) => id !== label.id))
              }
            >
              <LabelDot color={label.color} />
              {label.name}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        {value.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onChange([])}>Clear filter</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
