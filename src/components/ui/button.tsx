/**
 * Button — Void theme variants.
 *
 * All variants use rounded-sm per design requirement. Colors mapped to Void
 * tokens: red-500/red-600 for primary, white/opacity for outline/ghost/secondary,
 * red-400 for destructive, red-400 link.
 *
 * Active (primary) action        → `variant="default"`
 * Secondary action               → `variant="outline"` or `variant="secondary"`
 * Dangerous action               → `variant="destructive"`
 * Tertiary/inline                → `variant="ghost"` or `variant="link"`
 */

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500/30 disabled:pointer-events-none disabled:opacity-30 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-red-600 text-white hover:bg-red-500 active:scale-[0.98]",
        destructive:
          "bg-red-500/[0.1] border border-red-500/20 text-red-400 hover:bg-red-500/[0.15] hover:border-red-500/30",
        outline:
          "bg-white/[0.02] border border-white/[0.04] text-white/60 hover:bg-white/[0.04] hover:border-white/[0.08] hover:text-white/85",
        secondary:
          "bg-white/[0.04] border border-white/[0.04] text-white/70 hover:bg-white/[0.06] hover:text-white/90",
        ghost:
          "text-white/50 hover:bg-white/[0.04] hover:text-white/85",
        link:
          "text-red-400 underline-offset-4 hover:text-red-300 hover:underline",
      },
      size: {
        default: "h-8 px-3 py-1.5",
        sm: "h-7 px-2.5 text-[11px]",
        lg: "h-9 px-4 text-[13px]",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
