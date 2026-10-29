type TooltipRow = readonly [label: string, value: string];

export type TooltipNote = {
  readonly title?: string;
  readonly body?: string;
  readonly rows?: readonly TooltipRow[];
};

export type TooltipText = string | TooltipNote;

const withoutStop = (text: string): string => text.replace(/\.$/, '');

export const tooltipText = (
  tooltip: TooltipText,
  named: string | null = null,
): string =>
  typeof tooltip === 'string'
    ? tooltip
    : `${[
        tooltip.title !== named && tooltip.title,
        tooltip.body && withoutStop(tooltip.body),
        ...(tooltip.rows ?? []).map(([label, value]) => `${label}: ${value}`),
      ]
        .filter(Boolean)
        .join('. ')}.`;
