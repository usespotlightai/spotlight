import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { type PillVariant, pillClass } from '@/lib/pill';

type PillButtonProps = Omit<
  ComponentProps<typeof Button>,
  'size' | 'variant' | 'className'
> & {
  variant?: PillVariant;
  className?: string;
};

export function PillButton({
  variant = 'outline',
  className,
  ...props
}: PillButtonProps) {
  return (
    <Button
      size="sm"
      variant={variant}
      className={pillClass(variant, className)}
      {...props}
    />
  );
}
