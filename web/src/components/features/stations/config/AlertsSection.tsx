import { TabSection } from '@/components/features/stations/TabSection';
import { TABLE_HEAD, TABLE_ROW } from '@/components/shared/table-rows';
import {
  type AlertRule,
  alertPhrase,
  alertRow,
} from '@/lib/station-monitoring';
import { cn } from '@/lib/utils';

const COLUMNS = 'grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_7rem]';

export function AlertsSection({ alerts }: { alerts: readonly AlertRule[] }) {
  return (
    <TabSection title="Alert rules">
      <div className="-mx-3">
        <div aria-hidden className={cn(TABLE_HEAD, COLUMNS)}>
          <span className="truncate">Measure</span>
          <span className="truncate">Condition</span>
          <span className="truncate text-right">Window</span>
        </div>
        <ul aria-label="Alert rules">
          {alerts.map((alert, place) => {
            const row = alertRow(alert);

            return (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: the alerts show in their written order and can repeat
                key={place}
                aria-label={alertPhrase(alert)}
                className={cn(TABLE_ROW, COLUMNS)}
              >
                <span className="truncate text-foreground">{row.measure}</span>
                <span className="truncate text-muted-foreground">
                  {row.change}
                </span>
                <span className="truncate text-right text-muted-foreground tabular-nums">
                  {row.window}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </TabSection>
  );
}
