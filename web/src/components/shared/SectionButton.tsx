import type { ComponentProps } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SectionButtonProps = Omit<
  ComponentProps<typeof Button>,
  'variant' | 'size'
>;

export function SectionButton({ className, ...props }: SectionButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        'rounded-full border-border bg-card px-3 shadow-none',
        className,
      )}
      {...props}
    />
  );
}
