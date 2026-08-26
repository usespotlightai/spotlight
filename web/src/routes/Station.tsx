import { useParams } from 'react-router';
import { InitialAvatar } from '@/components/common/avatar/InitialAvatar';
import { AutoGrowTextarea } from '@/components/common/form/AutoGrowTextarea';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { AgentPromptField } from '@/components/stations/AgentPromptField';
import { StationProperties } from '@/components/stations/StationProperties';
import { useStation } from '@/hooks/api/useStation';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useStationDraft } from '@/hooks/useStationDraft';
import { assemblyLinePath, teamPath } from '@/lib/team';

export function Station() {
  const { slug, teamId, lineId, stationId } = useParams();
  const { data: workspace } = useWorkspace(slug);
  const { line, station, isPending } = useStation(teamId, lineId, stationId);
  const { draft, update } = useStationDraft(station);

  if (isPending) {
    return null;
  }

  if (!line || !station) {
    return (
      <>
        <PageHeader title="Station not found" />
        <div className="flex min-h-0 flex-1 items-center justify-center p-8">
          <p className="text-muted-foreground text-sm">
            This assembly line has no station at that address.
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
              {
                label: line.name,
                to:
                  slug && teamId && lineId
                    ? assemblyLinePath(slug, teamId, lineId)
                    : undefined,
              },
              { label: draft.name || station.name },
            ]}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl gap-10 px-8 py-8">
          <main className="flex min-w-0 flex-1 flex-col gap-8">
            <div className="flex flex-col gap-3">
              <AutoGrowTextarea
                value={draft.name}
                onChange={(event) => update({ name: event.target.value })}
                aria-label="Station name"
                placeholder="Station name"
                maxLength={100}
                className="font-semibold text-2xl text-foreground leading-8 tracking-tight"
              />

              <AutoGrowTextarea
                value={draft.description}
                onChange={(event) =>
                  update({ description: event.target.value })
                }
                aria-label="Description"
                placeholder="Add description…"
                className="text-foreground text-sm leading-6"
              />
            </div>

            <AgentPromptField
              key={station.id}
              value={draft.agentPrompt}
              onChange={(agentPrompt) => update({ agentPrompt })}
            />
          </main>

          <StationProperties
            pool={draft.pool}
            onPool={(pool) => update({ pool })}
          />
        </div>
      </div>
    </>
  );
}
