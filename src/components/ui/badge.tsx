import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-zinc-50 text-zinc-900',
        secondary: 'border-transparent bg-zinc-900 text-zinc-50',
        destructive: 'border-transparent bg-rose-500 text-zinc-50',
        outline: 'border-zinc-700 text-zinc-400',
        buy: 'border-emerald-800 bg-emerald-950 text-emerald-400',
        sell: 'border-rose-800 bg-rose-950 text-rose-400',
        watch: 'border-amber-800 bg-amber-950 text-amber-400',
        cn: 'border-rose-800 bg-rose-950 text-rose-400',
        us: 'border-blue-800 bg-blue-950 text-blue-400',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
