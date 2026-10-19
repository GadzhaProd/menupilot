import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "@radix-ui/react-slot"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-semibold whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:underline",
        destructive:
          "border border-destructive bg-card text-destructive hover:bg-accent",
        outline:
          "border border-input bg-card hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:underline",
        ghost:
          "hover:bg-accent hover:text-accent-foreground",
        link: "text-accent-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-12 px-4 py-2 has-[>svg]:px-3",
        xs: "min-h-12 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "min-h-12 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "min-h-12 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-12",
        "icon-xs": "size-12 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-12",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
