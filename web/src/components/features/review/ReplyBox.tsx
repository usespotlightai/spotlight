import { useLayoutEffect, useRef, useState } from 'react';
import { ReviewComposer } from '@/components/features/review/ReviewComposer';
import { ReviewerAvatar } from '@/components/features/review/ReviewerAvatar';

const PROMPT = 'Reply…';

type ReplyBoxProps = {
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  failed: boolean;
  onSubmit: (body: string) => void;
};

export function ReplyBox({
  label,
  open,
  onOpenChange,
  pending,
  failed,
  onSubmit,
}: ReplyBoxProps) {
  const content = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const measured = content.current;

    if (!measured) {
      return;
    }

    const observer = new ResizeObserver(() => setHeight(measured.offsetHeight));
    observer.observe(measured);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      style={height === null ? undefined : { height }}
      className="overflow-hidden transition-[height] duration-200 ease-out-quad motion-reduce:transition-none"
    >
      <div ref={content}>
        {open ? (
          <ReviewComposer
            label={label}
            placeholder={PROMPT}
            submitLabel="Reply"
            avatar={<ReviewerAvatar />}
            pending={pending}
            failed={failed}
            onCancel={() => onOpenChange(false)}
            onSubmit={onSubmit}
          />
        ) : (
          <button
            type="button"
            onClick={() => onOpenChange(true)}
            className="flex w-full gap-2 rounded-lg border-[0.5px] border-border bg-card px-2 py-1.5 text-left font-sans text-muted-foreground text-xs leading-5 shadow-xs outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70"
          >
            <span
              aria-hidden
              className="flex size-5 shrink-0 items-center justify-center *:size-5!"
            >
              <ReviewerAvatar />
            </span>
            {PROMPT}
          </button>
        )}
      </div>
    </div>
  );
}
