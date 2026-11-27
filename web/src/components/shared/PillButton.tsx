import type { ComponentProps, ReactElement } from 'react';

import { Button } from '@/components/ui/button';
import { type PillSize, type PillVariant, pillClass } from '@/lib/pill';

type PillButtonProps = Omit<
  ComponentProps<typeof Button>,
  'size' | 'variant' | 'className'
> & {
  variant?: PillVariant;
  size?: PillSize;
  className?: string;
};

export function PillButton({
  variant = 'outline',
  size = 'small',
  className,
  ...props
}: PillButtonProps): ReactElement {
  return (
    <Button
      size="sm"
      variant={variant}
      className={pillClass(variant, className, size)}
      {...props}
    />
  );
}
