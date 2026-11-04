import { AlertsSection } from '@/components/features/stations/config/AlertsSection';
import { JudgeSection } from '@/components/features/stations/config/JudgeSection';
import { PromptSection } from '@/components/features/stations/config/PromptSection';
import { StationProperties } from '@/components/features/stations/config/StationProperties';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';

export const CONFIG_LAYOUT =
  'grid w-full gap-x-14 gap-y-10 pt-3 lg:grid-cols-[minmax(0,1fr)_17.5rem]';

export const CONFIG_MAIN = 'flex min-w-0 flex-col gap-10';

type StationConfigProps = {
  slug: string;
  teamId: string;
  line: LineResponseDto;
  station: StationResponseDto;
};

export function StationConfig({
  slug,
  teamId,
  line,
  station,
}: StationConfigProps) {
  return (
    <section aria-label="Config" className={CONFIG_LAYOUT}>
      <div className={CONFIG_MAIN}>
        <PromptSection stationId={station.id} prompt={station.agentPrompt} />
        <JudgeSection
          slug={slug}
          teamId={teamId}
          lineId={line.id}
          stationId={station.id}
          judge={station.judge}
        />
        {station.alerts.length > 0 && (
          <AlertsSection
            alerts={station.alerts}
            currency={station.search?.currency ?? line.search.currency}
          />
        )}
      </div>

      <StationProperties teamId={teamId} line={line} station={station} />
    </section>
  );
}
