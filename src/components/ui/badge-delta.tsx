/**
 * Badge Delta: a small badge with an arrow and a change such as "+€0.65".
 * Adapted from 21st.dev "Badge Delta" by Serafim (inspired by Tremor), MIT licence.
 * Source: https://21st.dev/@serafimcloud/components/badge-delta
 * Licence text: third_party/21st/badge-delta/LICENSE
 *
 * Changes: Remix icons replaced by lucide-react (no new dependency); Tremor-only classes
 * replaced by plain Tailwind; only the "solid" look is kept; `tone` added because for a
 * cost an arrow up is bad news while for contribution it is good news.
 */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const badgeDeltaVariants = cva(
  "inline-flex items-center gap-x-0.5 rounded-md px-1.5 py-0.5 text-xs tabular-nums font-semibold whitespace-nowrap",
  {
    variants: {
      tone: {
        good: "text-positive",
        bad: "text-negative",
        neutral: "text-muted-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
)

type DeltaType = "increase" | "decrease" | "neutral"

const ICONS = { increase: ArrowUpIcon, decrease: ArrowDownIcon, neutral: ArrowRightIcon } as const

interface BadgeDeltaProps
  extends Omit<React.ComponentProps<"span">, "children">,
    VariantProps<typeof badgeDeltaVariants> {
  /** Direction of the arrow. */
  deltaType: DeltaType
  /** The text to show, already formatted: "+€0.65". */
  value: string
}

function BadgeDelta({ className, deltaType, tone, value, ...props }: BadgeDeltaProps) {
  const Icon = ICONS[deltaType]
  // By default an increase is good and a decrease is bad; pass `tone` to say otherwise.
  const resolvedTone = tone ?? (deltaType === "increase" ? "good" : deltaType === "decrease" ? "bad" : "neutral")
  return (
    <span data-slot="badge-delta" className={cn(badgeDeltaVariants({ tone: resolvedTone }), className)} {...props}>
      <Icon aria-hidden="true" className="-ml-0.5 size-3.5" />
      {value}
    </span>
  )
}

export { BadgeDelta }
