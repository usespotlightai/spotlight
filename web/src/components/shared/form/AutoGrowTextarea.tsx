import { type ComponentProps, useRef } from 'react';

import { useAutoGrow } from '@/hooks/useAutoGrow';
import { cn } from '@/lib/utils';

type AutoGrowTextareaProps = ComponentProps<'textarea'> & { value: string };

export function AutoGrowTextarea({
  value,
  className,
  ...props
}: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useAutoGrow(ref, value);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      className={cn(
        'w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}
