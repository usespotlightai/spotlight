import {
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import { Collapsible } from '@/components/shared/Collapsible';
import { ExpandChevron } from '@/components/shared/ExpandChevron';
import { useRowClick } from '@/hooks/useRowClick';
import { transitionMove } from '@/lib/transition';

const NEED = '[data-need]';

type Moving = {
  readonly need: string;
  readonly from: DOMRect;
};

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
  const [open, setOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const details = useId();
  const head = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const moving = useRef<Moving | null>(null);
  const stopTransition = useRef<(() => void) | null>(null);

  const toggle = () => {
    const shown = (open ? body : head).current?.querySelector<HTMLElement>(
      NEED,
    );
    moving.current = shown?.dataset.need
      ? { need: shown.dataset.need, from: shown.getBoundingClientRect() }
      : null;
    setOpen((was) => !was);
  };
  const row = useRef<HTMLLIElement>(null);
  useRowClick(row, toggle, {
    ignore: (target) => body.current?.contains(target) ?? false,
  });

  useLayoutEffect(() => {
    const move = moving.current;
    moving.current = null;
    const target = (open ? body : head).current?.querySelector<HTMLElement>(
      `[data-need="${move?.need}"]`,
    );

    stopTransition.current?.();
    stopTransition.current =
      move && target
        ? transitionMove(
            move.from,
            target,
            body.current?.firstElementChild as HTMLElement | null,
            () => flushSync(() => setTransitioning(false)),
          )
        : null;

    setTransitioning(stopTransition.current !== null);
  }, [open]);

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
        className="flex min-h-12 items-center justify-between gap-4 px-4 py-2"
      >
        <div className="flex min-w-0 items-center gap-3">
          {logo}

          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={details}
                onClick={toggle}
                className="truncate rounded-sm text-left font-medium text-foreground text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {name}
              </button>
              {mark}
            </span>
            <span className="text-muted-foreground text-xs">{summary}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {!open && need}
          <ExpandChevron open={open} className="size-4 text-muted-foreground" />
        </div>
      </div>

      <div id={details} ref={body} className="cursor-auto">
        <Collapsible open={open} appear={false}>
          {children}
        </Collapsible>
      </div>
    </li>
  );
}
