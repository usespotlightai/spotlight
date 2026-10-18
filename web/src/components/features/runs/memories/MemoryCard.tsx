import { Fragment, type ReactNode, useState } from 'react';
import { RetireReply } from '@/components/features/memory/RetireReply';
import { ThisWasWrong } from '@/components/features/runs/memories/ThisWasWrong';

const BELOW = 'mt-3 text-muted-foreground text-xs leading-5';

type MemoryCardProps = {
  slot: string;
  body: string;
  about: readonly ReactNode[];
  retirable?: { readonly teamId: string; readonly memoryId: string } | null;
  action?: ReactNode;
  footer?: ReactNode;
};

export function MemoryCard({
  slot,
  body,
  about,
  retirable,
  action,
  footer,
}: MemoryCardProps) {
  const [retiring, setRetiring] = useState(false);
  return (
    <li
      data-slot={slot}
      className="flex flex-col rounded-xl border border-border/70 bg-card px-4 py-3.5 shadow-[0_1px_2px_#00000005,0_6px_16px_-10px_#0000000c]"
    >
      <div className="flex flex-col gap-3">
        <p className="whitespace-pre-wrap break-words text-foreground text-sm leading-5">
          {body}
        </p>
        <div className="flex min-h-6 min-w-0 items-center gap-3">
          <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 text-muted-foreground text-xs leading-5">
            {about.map((each, at) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the details of a card have a fixed order
              <Fragment key={at}>
                {at > 0 && <span aria-hidden>·</span>}
                <span>{each}</span>
              </Fragment>
            ))}
          </p>

          {retirable && !retiring && (
            <div className="flex shrink-0">
              <ThisWasWrong onClick={() => setRetiring(true)} />
            </div>
          )}

          {action && <div className="flex shrink-0">{action}</div>}
        </div>
      </div>

      <RetireReply
        open={retiring}
        retirable={retirable ?? null}
        onCancel={() => setRetiring(false)}
        className={BELOW}
      />

      {footer && <div className={BELOW}>{footer}</div>}
    </li>
  );
}
