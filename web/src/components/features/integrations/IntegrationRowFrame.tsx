import { type ReactNode, useId, useRef } from 'react';

import { Collapsible } from '@/components/shared/Collapsible';
import { ExpandChevron } from '@/components/shared/ExpandChevron';
import { useNeedMove } from '@/hooks/useNeedMove';
import { useRowClick } from '@/hooks/useRowClick';

type IntegrationRowFrameProps = {
  slot: string;
  logo: ReactNode;
  name: string;
  mark?: ReactNode;
  summary: ReactNode;
  need?: ReactNode;
  children: ReactNode;
};

export function IntegrationRowFrame({
  slot,
  logo,
  name,
  mark,
  summary,
  need,
  children,
}: IntegrationRowFrameProps) {
  const details = useId();
  const head = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const { open, transitioning, toggle } = useNeedMove(head, body);
  const row = useRef<HTMLLIElement>(null);
  useRowClick(row, toggle, {
    ignore: (target) => body.current?.contains(target) ?? false,
  });

  return (
    <li
      ref={row}
      data-slot={slot}
      data-open={open || undefined}
      data-transitioning={transitioning || undefined}
      className="cursor-pointer [&[data-transitioning]_[data-need]]:invisible [&_[data-need]]:transition-[color,background-color,border-color,box-shadow,opacity,translate]"
    >
      <div
        ref={head}
        data-slot="integration-head"
        className="relative flex min-h-12 items-center gap-3 px-4 py-2"
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-1 basis-40 items-center gap-3">
            {logo}

            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex min-w-0 items-center gap-1.5">
                <button
                  type="button"
                  title={name}
                  aria-expanded={open}
                  aria-controls={details}
                  onClick={toggle}
                  className="truncate rounded-sm text-left font-medium text-foreground text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:after:absolute pointer-coarse:after:inset-0"
                >
                  {name}
                </button>
                {mark}
              </span>
              <span className="text-muted-foreground text-xs">{summary}</span>
            </div>
          </div>

          {!open && (
            <div className="relative flex shrink-0 items-center empty:hidden pointer-coarse:[&_[data-need]]:h-7 @max-md/pane:basis-full @max-md/pane:pl-8 @md/pane:ml-auto">
              {need}
            </div>
          )}
        </div>

        <ExpandChevron
          open={open}
          className="size-4 shrink-0 text-muted-foreground"
        />
      </div>

      <div id={details} ref={body} className="cursor-auto">
        <Collapsible open={open} appear={false}>
          {children}
        </Collapsible>
      </div>
    </li>
  );
}
