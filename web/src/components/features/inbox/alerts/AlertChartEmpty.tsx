import { ALERT_CHART_HEIGHT } from '@/components/features/inbox/alerts/AlertChart';

export function AlertChartEmpty() {
  return (
    <p
      data-slot="alert-chart-empty"
      style={{ height: ALERT_CHART_HEIGHT }}
      className="flex items-center justify-center rounded-lg bg-muted/50 px-4 text-center text-muted-foreground text-sm"
    >
      There is no chart to show. The runs behind this alert are deleted.
    </p>
  );
}
