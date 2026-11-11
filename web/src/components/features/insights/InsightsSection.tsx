import { type ReactNode, useId } from 'react';

import { SectionLevel } from '@/components/features/insights/section-level';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import type { TooltipText } from '@/lib/tooltip-note';

type InsightsSectionProps = {
  title: string;
  tooltip?: TooltipText;
  aside?: ReactNode;
  children: ReactNode;
};

export function InsightsSection({
  title,
  tooltip,
  aside,
  children,
}: InsightsSectionProps) {
  const contentId = useId();

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
