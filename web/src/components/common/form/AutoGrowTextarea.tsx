import { type ComponentProps, useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

type AutoGrowTextareaProps = ComponentProps<'textarea'> & { value: string };

export function AutoGrowTextarea({
  value,
  className,
  ...props
}: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the text is what the measurement follows, though the effect reads only the node
  useLayoutEffect(() => {
    const textarea = ref.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

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
