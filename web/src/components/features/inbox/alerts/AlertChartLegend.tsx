import { AlertLegendMark } from '@/components/features/inbox/alerts/AlertLegendMark';
import {
  ALERT_LEVEL,
  BEFORE_LEVEL,
  FIRING_RUN,
  formatMeasureValue,
  type StationAlertFiring,
  thresholdLine,
} from '@/lib/station-alert';

export function AlertChartLegend({ alert }: { alert: StationAlertFiring }) {
  const level = thresholdLine(alert);
  const shown = (value: number) =>
    formatMeasureValue(alert.rule.measure, value, alert.currency);

  return (
    <ul
      aria-label="Legend"
      className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs tabular-nums"
    >
      {level !== null && (
        <AlertLegendMark
          label={`${ALERT_LEVEL}, ${shown(level)}`}
          stroke="var(--destructive)"
          dash="4 3"
        />
      )}
      {alert.baseline !== null && (
        <AlertLegendMark
          label={`${BEFORE_LEVEL}, ${shown(alert.baseline)}`}
          stroke="var(--faint)"
          dash="3 3"
        />
      )}
      <AlertLegendMark
        label={FIRING_RUN}
        stroke="var(--destructive)"
        opacity={0.4}
      />
    </ul>
  );
}
