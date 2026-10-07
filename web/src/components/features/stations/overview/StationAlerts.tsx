import { BellRing } from 'lucide-react';
import { StationSection } from '@/components/features/stations/StationSection';
import { type AlertThreshold, alertPhrase } from '@/lib/station-watch';

export function StationAlerts({
  alerts,
}: {
  alerts: readonly AlertThreshold[];
}) {
  return (
    <StationSection title="Alerts you when">
      <ul aria-label="Alerts" className="flex flex-col gap-1.5">
        {alerts.map((alert, place) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: alerts are listed as written and may repeat
            key={place}
            className="flex items-start gap-2 text-foreground text-sm leading-6"
          >
            <BellRing
              aria-hidden
              className="mt-1 size-3.5 shrink-0 text-muted-foreground"
            />
            {alertPhrase(alert)}
          </li>
        ))}
      </ul>
    </StationSection>
  );
}
