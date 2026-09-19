import { cn } from "@/lib/utils"

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn("shrink-0 rounded-[22%] ring-1 ring-foreground/10", className)}
    >
      <rect width="64" height="64" rx="14" fill="#0c0d0e" />
      <path d="M20 9 H44 a3 3 0 0 1 3 3 V55 L32 45 L17 55 V12 a3 3 0 0 1 3 -3 Z" fill="#3ddc97" />
      <polyline
        points="22.5,34 28.5,27 33.5,31 41,20.5"
        fill="none"
        stroke="#0c0d0e"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="41" cy="20.5" r="3" fill="#0c0d0e" />
    </svg>
  )
}
