/**
 * Alert banner with an icon, a message and inline action buttons.
 * The composition (Alert > icon + AlertDescription + AlertAction with buttons) follows the
 * 21st.dev "Alert with Action Buttons" component by Sean Hello (ReUI), MIT licence.
 * Source: https://21st.dev/@sean0205/components/alert-with-action-buttons
 * Licence text: third_party/21st/alert-with-action-buttons/LICENSE
 *
 * The 21st.dev CLI shows only the usage example, not the Alert primitives it imports, so the
 * primitives below are written here in the shadcn style (variants warning and info added).
 */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative flex w-full flex-wrap items-start gap-x-3 gap-y-2 rounded-lg border p-3 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        info: "border-border bg-secondary/60 text-foreground",
        warning: "border-amber-500/50 bg-amber-50 text-amber-950 [&>svg]:text-amber-700",
      },
    },
    defaultVariants: { variant: "info" },
  },
)

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role="status" className={cn(alertVariants({ variant }), className)} {...props} />
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-description" className={cn("min-w-0 flex-1 basis-60 space-y-1", className)} {...props} />
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-action" className={cn("flex shrink-0 flex-wrap items-center gap-2", className)} {...props} />
}

export { Alert, AlertAction, AlertDescription }
