type TooltipRow = readonly [label: string, value: string];

type TooltipList = {
  readonly title: string;
  readonly items: readonly string[];
};

export type TooltipNote = {
  readonly title?: string;
  readonly body?: string;
  readonly rows?: readonly TooltipRow[];
  readonly list?: TooltipList;
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
        tooltip.list &&
          tooltip.list.items.length > 0 &&
          `${tooltip.list.title}: ${tooltip.list.items.join(', ')}`,
      ]
        .filter(Boolean)
        .join('. ')}.`;
