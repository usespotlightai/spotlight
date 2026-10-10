import {
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { FoldChevron } from '@/components/shared/FoldChevron';
import { Unfold } from '@/components/shared/Unfold';
import { useRowClick } from '@/hooks/useRowClick';
import { travel } from '@/lib/travel';

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
  const details = useId();
  const head = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const moving = useRef<Moving | null>(null);

  const flip = () => {
    const shown = (open ? body : head).current?.querySelector<HTMLElement>(
      NEED,
    );
    moving.current = shown?.dataset.need
      ? { need: shown.dataset.need, from: shown.getBoundingClientRect() }
      : null;
    setOpen((was) => !was);
  };
  const row = useRef<HTMLLIElement>(null);
  useRowClick(row, flip, {
    ignore: (target) => body.current?.contains(target) ?? false,
  });

  useLayoutEffect(() => {
    const move = moving.current;
    moving.current = null;
    const target = (open ? body : head).current?.querySelector<HTMLElement>(
      `[data-need="${move?.need}"]`,
    );

    if (move && target) {
      travel(move.from, target);
    }
  }, [open]);

  return (
    <li
      ref={row}
      data-slot={slot}
      data-open={open || undefined}
      className="cursor-pointer"
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
                onClick={flip}
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
          <FoldChevron open={open} className="size-4 text-muted-foreground" />
        </div>
      </div>

      <div id={details} ref={body} className="cursor-auto">
        <Unfold open={open} appear={false}>
          {children}
        </Unfold>
      </div>
    </li>
  );
}
