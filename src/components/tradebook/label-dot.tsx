import { cn } from "@/lib/utils"
import type { Label } from "@/lib/types"

export function LabelDot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("size-2 shrink-0 rounded-full", className)} style={{ backgroundColor: color }} />
}

export function LabelTag({ label }: { label: Label }) {
  return (
    <span className="inline-flex h-5 items-center gap-1.5 rounded-sm border border-border bg-muted/40 px-1.5 text-[0.6875rem] whitespace-nowrap">
      <LabelDot color={label.color} className="size-1.5" />
      {label.name}
    </span>
  )
}
