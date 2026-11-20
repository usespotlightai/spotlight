import { Minus } from 'lucide-react';
import { type Ref, useState } from 'react';

import { DecisionPager } from '@/components/shared/decision-tray/DecisionPager';
import { FadingScroll } from '@/components/shared/FadingScroll';
import { IconAction } from '@/components/shared/IconAction';
import { type DecisionTray, DockedContext } from '@/lib/decision-tray';

type DecisionTrayCardProps = {
  ref: Ref<HTMLElement>;
  tray: DecisionTray;
  onCollapse: () => void;
};

export function DecisionTrayCard({
  ref,
  tray,
  onCollapse,
}: DecisionTrayCardProps) {
  const { decisions, shown, open } = tray;
  const [slots, setSlots] = useState<Readonly<Record<string, HTMLElement>>>({});

  const slotFor = (id: string) => (node: HTMLDivElement | null) => {
    if (node && slots[id] !== node) {
      setSlots((was) => ({ ...was, [id]: node }));
    }
  };

  if (!shown) {
    return null;
  }

  return (
    <section
      ref={ref}
      data-slot="decision-tray"
      aria-label={shown.label}
      hidden={!open}
      className="absolute inset-x-0 bottom-1 z-10 flex max-h-[min(32rem,55vh)] flex-col rounded-2xl border border-border bg-card shadow-xs"
    >
      <header className="flex h-9 shrink-0 items-center justify-between gap-2 pr-1.5 pl-3">
        <span className="truncate font-medium text-muted-foreground text-xs">
          {shown.kind}
        </span>
        <IconAction label="Collapse" onClick={onCollapse}>
          <Minus />
        </IconAction>
      </header>

      <FadingScroll className="min-h-0" contentClassName="px-3 pb-3">
        {decisions.map((decision) => (
          <div key={decision.id} hidden={decision !== shown}>
            <DockedContext
              value={{
                controls: slots[decision.id] ?? null,
                active: open && decision === shown,
              }}
            >
              {decision.content}
            </DockedContext>
          </div>
        ))}
      </FadingScroll>

      <footer className="hidden shrink-0 items-center gap-2 px-3 pb-3 has-[[data-shown]>*]:flex">
        {decisions.length > 1 && (
          <span data-shown className="-ml-1.5 flex">
            <DecisionPager
              place={decisions.indexOf(shown)}
              count={decisions.length}
              onStep={tray.step}
            />
          </span>
        )}
        {decisions.map((decision) => (
          <div
            key={decision.id}
            ref={slotFor(decision.id)}
            data-slot="decision-tray-controls"
            data-shown={decision === shown || undefined}
            hidden={decision !== shown}
            className="ml-auto"
          />
        ))}
      </footer>
    </section>
  );
}
