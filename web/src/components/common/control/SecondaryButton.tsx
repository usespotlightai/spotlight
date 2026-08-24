import { cva } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const secondaryButton = cva(
  [
    'flex h-7 shrink-0 items-center rounded-md border-[0.5px] border-border bg-card px-3 font-medium text-muted-foreground text-sm outline-none',
    'shadow-[0px_4px_4px_-1px_#0000000a,0px_1px_1px_0px_#00000014]',
    'transition-colors duration-100 ease-out-quad',
  ],
  {
    variants: {
      disabled: {
        true: 'opacity-50',
        false: 'hover:bg-accent hover:text-foreground',
      },
    },
    defaultVariants: { disabled: false },
  },
);

type SecondaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function SecondaryButton({
  className,
  type = 'button',
  disabled,
  ...rest
}: SecondaryButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        secondaryButton({ disabled: Boolean(disabled) }),
        className,
      )}
      {...rest}
    />
  );
}
