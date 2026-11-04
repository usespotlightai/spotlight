import { ChevronDown } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';
import { SectionLevel } from '@/components/features/insights/section-level';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import type { TooltipText } from '@/lib/tooltip-note';
import { cn } from '@/lib/utils';

type InsightsSectionProps = {
  title: string;
  tooltip?: TooltipText;
  aside?: ReactNode;
  collapsible?: boolean;
  children: ReactNode;
};

export function InsightsSection({
  title,
  tooltip,
  aside,
  collapsible = true,
  children,
}: InsightsSectionProps) {
  const [open, setOpen] = useState(true);
  const contentId = useId();

  if (!collapsible) {
    return (
      <section
        data-slot="insights-section"
        aria-labelledby={contentId}
        className="flex flex-col gap-3"
      >
        <h2
          id={contentId}
          className="flex min-h-7 items-center gap-1.5 whitespace-nowrap font-medium text-base text-foreground"
        >
          {title}
          {aside && (
            <span className="font-normal text-muted-foreground text-sm tabular-nums">
              {aside}
            </span>
          )}
          {tooltip && <InfoTooltip tooltip={tooltip} />}
        </h2>
        <SectionLevel value={3}>
          <div className="flex flex-col gap-10">{children}</div>
        </SectionLevel>
      </section>
    );
  }

  return (
    <section data-slot="insights-section" className="flex flex-col gap-2">
      <h2 className="flex items-center gap-1.5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 rounded-sm font-medium text-foreground text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <ChevronDown
            aria-hidden
            className={cn(
              'size-3.5 text-muted-foreground transition-transform duration-200',
              !open && '-rotate-90',
            )}
          />
          {title}
        </button>
        {tooltip && <InfoTooltip tooltip={tooltip} />}
      </h2>
      {open && (
        <div id={contentId} className="flex flex-col gap-2">
          {children}
        </div>
      )}
    </section>
  );
}
