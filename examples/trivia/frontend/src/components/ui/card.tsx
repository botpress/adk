import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

export { Card }
