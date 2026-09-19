"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon, Download04Icon, Upload04Icon } from "@hugeicons/core-free-icons"

import { LabelDot } from "@/components/tradebook/label-dot"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { deleteLabel, exportBackup, importBackup, saveSettings } from "@/lib/db"
import { todayIso } from "@/lib/format"
import type { Label, Settings } from "@/lib/types"

const CURRENCIES = ["USD", "INR", "EUR", "GBP", "JPY", "AUD", "CAD", "SGD", "USDT"].map((code) => ({
  value: code,
  label: code,
}))

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: Settings
  labels: Label[]
  persisted: boolean | null
}

export function SettingsDialog({ open, onOpenChange, settings, labels, persisted }: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <SettingsForm
            settings={settings}
            labels={labels}
            persisted={persisted}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function SettingsForm({
  settings,
  labels,
  persisted,
  onDone,
}: {
  settings: Settings
  labels: Label[]
  persisted: boolean | null
  onDone: () => void
}) {
  const [capital, setCapital] = useState(settings.capital ? String(settings.capital) : "")
  const [currency, setCurrency] = useState(settings.currency)
  const fileInput = useRef<HTMLInputElement>(null)

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    await saveSettings({ capital: Number(capital) || 0, currency })
    toast.success("Settings saved")
    onDone()
  }

  async function handleExport() {
    const backup = await exportBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `tradebook-backup-${todayIso()}.json`
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${backup.trades.length} trades`)
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (!window.confirm("Importing replaces every trade, label and setting in this browser. Continue?")) return
    try {
      const result = await importBackup(JSON.parse(await file.text()))
      toast.success(`Restored ${result.trades} trades and ${result.labels} labels`)
      onDone()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read that file")
    }
  }

  return (
    <form onSubmit={handleSave} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Settings</DialogTitle>
        <DialogDescription>Everything is stored in this browser only.</DialogDescription>
      </DialogHeader>

      <FieldGroup className="gap-4">
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Field>
            <FieldLabel htmlFor="capital">Account capital</FieldLabel>
            <Input
              id="capital"
              inputMode="decimal"
              autoComplete="off"
              className="font-mono tabular-nums"
              value={capital}
              onChange={(e) => setCapital(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="0"
            />
          </Field>
          <Field>
            <FieldLabel>Currency</FieldLabel>
            <Select items={CURRENCIES} value={currency} onValueChange={(value) => value && setCurrency(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <FieldDescription className="-mt-2">
          Used to show open risk and drawdown as a percentage of your account.
        </FieldDescription>

        <FieldSeparator>Labels</FieldSeparator>
        {labels.length === 0 ? (
          <p className="text-muted-foreground">Labels you create on trades show up here.</p>
        ) : (
          <ul className="grid max-h-40 gap-0.5 overflow-y-auto">
            {labels.map((label) => (
              <li key={label.id} className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted/50">
                <LabelDot color={label.color} />
                <span className="flex-1 truncate">{label.name}</span>
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Delete label ${label.name}`}
                  onClick={async () => {
                    await deleteLabel(label.id)
                    toast.success(`Removed “${label.name}” from all trades`)
                  }}
                >
                  <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <FieldSeparator>Backup</FieldSeparator>
        <div className="grid gap-2">
          <p className="text-muted-foreground">
            Clearing site data in your browser deletes your journal. Export a backup regularly.
            {persisted !== null && (
              <span className={persisted ? "text-profit" : "text-warning"}>
                {" "}
                {persisted ? "Persistent storage is on." : "Persistent storage was not granted."}
              </span>
            )}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleExport}>
              <HugeiconsIcon icon={Download04Icon} strokeWidth={2} data-icon="inline-start" />
              Export JSON
            </Button>
            <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}>
              <HugeiconsIcon icon={Upload04Icon} strokeWidth={2} data-icon="inline-start" />
              Import backup
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImport}
            />
          </div>
        </div>
      </FieldGroup>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  )
}
