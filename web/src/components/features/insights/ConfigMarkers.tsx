import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useBeforeAfterPanel } from '@/lib/before-after-panel';
import {
  type OutputDay,
  type StationNames,
  stationShown,
} from '@/lib/insights';
import { dayShown } from '@/lib/judge';
import { stationPath } from '@/lib/station';

type ConfigMarkersProps = {
  slug: string;
  teamId: string;
  days: readonly OutputDay[];
  names: StationNames;
  inset: number;
};

export function ConfigMarkers({
  slug,
  teamId,
  days,
  names,
  inset,
}: ConfigMarkersProps) {
  const panel = useBeforeAfterPanel();

  return (
    <ul aria-label="Config changes" className="relative h-5">
      {days.map((day, at) =>
        day.changes.length === 0 ? null : (
          <li
            key={day.day}
            className="absolute top-0 -translate-x-1/2"
            style={{
              left: `calc(${inset}px + ${(at + 0.5) / days.length} * (100% - ${2 * inset}px))`,
            }}
          >
            <Popover>
              <PopoverTrigger
                openOnHover
                aria-label={`Config changed on ${dayShown(day.day)}: ${day.changes
                  .map((change) => stationShown(names, change.stationId))
                  .join(', ')}`}
                className="flex size-5 items-center justify-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <span
                  aria-hidden
                  className="size-2 rotate-45 rounded-[1px] bg-foreground/70"
                />
              </PopoverTrigger>
              <PopoverContent className="flex min-w-48 flex-col gap-1 p-2 text-xs">
                <p className="text-muted-foreground">
                  New config on {dayShown(day.day)}
                </p>
                <ul className="flex flex-col gap-1">
                  {day.changes.map((change) => (
                    <li
                      key={`${change.stationId}:${change.fingerprint}`}
                      className="flex flex-col"
                    >
                      <TrailLink
                        to={stationPath(
                          slug,
                          teamId,
                          change.lineId,
                          change.stationId,
                        )}
                        className="font-medium text-foreground hover:underline"
                      >
                        {stationShown(names, change.stationId)}
                      </TrailLink>
                      <button
                        type="button"
                        onClick={() =>
                          panel.show({
                            stationId: change.stationId,
                            fingerprint: change.fingerprint,
                          })
                        }
                        className="w-fit rounded-sm text-left text-foreground underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        Before and after
                      </button>
                      <InsightsLink
                        tab="runs"
                        filter={{
                          stationId: change.stationId,
                          fingerprint: change.fingerprint,
                        }}
                        className="text-muted-foreground"
                      >
                        Runs with config {change.fingerprint.slice(0, 8)}
                      </InsightsLink>
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
          </li>
        ),
      )}
    </ul>
  );
}
