import { useParams } from 'react-router';
import { StationSection } from '@/components/board/StationSection';
import { InitialAvatar } from '@/components/common/avatar/InitialAvatar';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAssemblyLines } from '@/hooks/api/useAssemblyLines';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useCollapsed } from '@/hooks/useCollapsed';
import { stationPath } from '@/lib/station';
import { teamPath } from '@/lib/team';

const STATIONS_STORAGE_KEY = 'spotlight.collapsed-stations';

export function AssemblyLineBoard() {
  const { slug, teamId, lineId } = useParams();
  const { data: workspace } = useWorkspace(slug);
  const { data: lines, isPending } = useAssemblyLines(teamId);
  const stations = useCollapsed(STATIONS_STORAGE_KEY);

  if (isPending) {
    return null;
  }

  const line = lines?.find((candidate) => candidate.id === lineId);

  if (!line) {
    return (
      <>
        <PageHeader title="Assembly line not found" />
        <div className="flex min-h-0 flex-1 items-center justify-center p-8">
          <p className="text-muted-foreground text-sm">
            This team has no assembly line at that address.
          </p>
        </div>
      </>
    );
  }

  const team = workspace?.teams.find((candidate) => candidate.id === teamId);

  return (
    <>
      <PageHeader
        title={
          <Breadcrumbs
            segments={[
              ...(team
                ? [
                    {
                      label: team.name,
                      icon: (
                        <InitialAvatar name={team.name} className="bg-card" />
                      ),
                      to: slug && teamId ? teamPath(slug, teamId) : undefined,
                    },
                  ]
                : []),
              { label: line.name },
            ]}
          />
        }
      />

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto py-1.5">
        {line.stations.map((station) => (
          <StationSection
            key={station.id}
            name={station.name}
            count={0}
            open={stations.isExpanded(station.id)}
            onToggle={() => stations.toggle(station.id)}
            to={
              slug && teamId
                ? stationPath(slug, teamId, line.id, station.id)
                : undefined
            }
          />
        ))}
      </div>
    </>
  );
}
