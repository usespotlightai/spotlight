import { ChevronDown } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { cn } from '@/lib/utils';

type InsightsSectionProps = {
  title: string;
  tooltip?: string;
  children: ReactNode;
};

export function InsightsSection({
  title,
  tooltip,
  children,
}: InsightsSectionProps) {
  const [open, setOpen] = useState(true);
  const contentId = useId();

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
