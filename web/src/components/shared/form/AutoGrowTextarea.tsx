import { type ComponentProps, useEffect, useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

type AutoGrowTextareaProps = ComponentProps<'textarea'> & { value: string };

const fitToContent = (textarea: HTMLTextAreaElement) => {
  textarea.style.height = 'auto';

  const full = textarea.scrollHeight;

  if (full === 0) {
    textarea.style.height = '';
    return;
  }

  textarea.style.height = `${full}px`;
  textarea.style.overflowY =
    full - textarea.clientHeight > 1 ? 'auto' : 'hidden';
};

export function AutoGrowTextarea({
  value,
  className,
  ...props
}: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the text is what the measurement follows, though the effect reads only the node
  useLayoutEffect(() => {
    if (ref.current) {
      fitToContent(ref.current);
    }
  }, [value]);

  useEffect(() => {
    const textarea = ref.current;
    if (!textarea) {
      return;
    }

    let width = textarea.clientWidth;

    const resized = new ResizeObserver(() => {
      if (
        textarea.clientWidth !== width ||
        textarea.scrollHeight > textarea.clientHeight
      ) {
        width = textarea.clientWidth;
        fitToContent(textarea);
      }
    });
    resized.observe(textarea);

    return () => resized.disconnect();
  }, []);

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
