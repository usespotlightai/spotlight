import { useParams } from 'react-router';
import { StationLane } from '@/components/board/StationLane';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAssemblyLines } from '@/hooks/api/useAssemblyLines';
import { useWorkspace } from '@/hooks/api/useWorkspace';

export function AssemblyLineBoard() {
  const { slug, teamId, lineId } = useParams();
  const { data: workspace } = useWorkspace(slug);
  const { data: lines, isPending } = useAssemblyLines(teamId);

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
          <Breadcrumbs segments={team ? [team.name, line.name] : [line.name]} />
        }
      />

      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-3">
        {line.stations.map((station) => (
          <StationLane key={station.id} name={station.name} count={0} />
        ))}
      </div>
    </>
  );
}
