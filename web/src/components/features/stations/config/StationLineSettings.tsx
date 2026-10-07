import { ReplayCheckThreshold } from '@/components/features/replays/ReplayCheckThreshold';
import { LineSource } from '@/components/features/searches/station/LineSource';
import { SettingRows } from '@/components/features/stations/config/SettingRows';
import { StationSection } from '@/components/features/stations/StationSection';
import { SectionLink } from '@/components/shared/SectionLink';
import type { LineResponseDto } from '@/lib/api';
import { linePath } from '@/lib/team';

type StationLineSettingsProps = {
  slug: string;
  teamId: string;
  line: LineResponseDto;
};

export function StationLineSettings({
  slug,
  teamId,
  line,
}: StationLineSettingsProps) {
  return (
    <StationSection
      title="From the line"
      action={
        <SectionLink to={linePath(slug, teamId, line.id)}>
          {line.name}
        </SectionLink>
      }
    >
      <SettingRows
        rows={[
          {
            label: 'Repositories',
            value:
              line.repositories.length > 0 ? (
                <ul className="flex flex-col">
                  {line.repositories.map((repository) => (
                    <li key={repository} className="font-mono text-[0.8rem]">
                      {repository}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-muted-foreground">None</span>
              ),
          },
          { label: 'Source', value: <LineSource source={line.source} /> },
          {
            label: 'Replay check',
            value: <ReplayCheckThreshold replayCheck={line.replayCheck} />,
          },
        ]}
      />
    </StationSection>
  );
}
