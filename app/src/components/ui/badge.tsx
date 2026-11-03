import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-destructive-foreground dark:bg-destructive/60 [a&]:hover:bg-destructive/90",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
      },
      // Presentational color only; which tone a value gets is decided outside ui/ (lib/utils).
      tone: {
        blue: "border-tone-blue-border bg-tone-blue-bg text-tone-blue-fg",
        green: "border-tone-green-border bg-tone-green-bg text-tone-green-fg",
        purple: "border-tone-purple-border bg-tone-purple-bg text-tone-purple-fg",
        amber: "border-tone-amber-border bg-tone-amber-bg text-tone-amber-fg",
        rose: "border-tone-rose-border bg-tone-rose-bg text-tone-rose-fg",
        sky: "border-tone-sky-border bg-tone-sky-bg text-tone-sky-fg",
        cyan: "border-tone-cyan-border bg-tone-cyan-bg text-tone-cyan-fg",
        slate: "border-tone-slate-border bg-tone-slate-bg text-tone-slate-fg",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>

function Badge({
  className,
  variant = "default",
  tone,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={tone ? undefined : variant}
      data-tone={tone ?? undefined}
      className={cn(badgeVariants({ variant: tone ? null : variant, tone }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants, type BadgeTone }
