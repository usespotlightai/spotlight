import { TabSection } from '@/components/features/stations/TabSection';
import { TABLE_HEAD, TABLE_ROW } from '@/components/shared/table-rows';
import {
  type AlertRule,
  alertPhrase,
  alertRow,
} from '@/lib/station-monitoring';
import { cn } from '@/lib/utils';

const COLUMNS = '@md/pane:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_7rem]';

type AlertsSectionProps = {
  alerts: readonly AlertRule[];
  currency: string | null;
};

export function AlertsSection({ alerts, currency }: AlertsSectionProps) {
  return (
    <TabSection title="Alert rules">
      <div className="-mx-2">
        <div
          aria-hidden
          className={cn(TABLE_HEAD, COLUMNS, 'hidden @md/pane:grid')}
        >
          <span className="truncate">Measure</span>
          <span className="truncate">Condition</span>
          <span className="truncate">Window</span>
        </div>
        <ul aria-label="Alert rules">
          {alerts.map((alert, place) => {
            const row = alertRow(alert, currency);

            return (
              <li
                // oxlint-disable-next-line react/no-array-index-key -- the alerts show in their written order and can repeat
                key={place}
                aria-label={alertPhrase(alert, currency)}
                className={cn(
                  TABLE_ROW,
                  COLUMNS,
                  'h-auto grid-cols-[minmax(0,1fr)_auto] gap-y-0.5 py-2 @md/pane:h-9 @md/pane:py-0',
                )}
              >
                <span title={row.measure} className="truncate text-foreground">
                  {row.measure}
                </span>
                <span
                  title={row.change}
                  className="col-span-2 row-start-2 truncate text-muted-foreground @md/pane:col-span-1 @md/pane:row-start-auto"
                >
                  {row.change}
                </span>
                <span
                  title={row.window}
                  className="truncate text-muted-foreground"
                >
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
