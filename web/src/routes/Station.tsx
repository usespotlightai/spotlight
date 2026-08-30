import { useParams } from 'react-router';
import { StationIcon } from '@/components/board/StationIcon';
import { InitialAvatar } from '@/components/common/avatar/InitialAvatar';
import { AutoGrowTextarea } from '@/components/common/form/AutoGrowTextarea';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { AgentPromptField } from '@/components/stations/AgentPromptField';
import { StationColorPicker } from '@/components/stations/StationColorPicker';
import { StationProperties } from '@/components/stations/StationProperties';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useCustomiseStation } from '@/hooks/api/useCustomiseStation';
import { useStation } from '@/hooks/api/useStation';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useStationEdits } from '@/hooks/useStationEdits';
import { stationShare } from '@/lib/station';
import { assemblyLinePath, teamPath } from '@/lib/team';

export function Station() {
  const { slug, teamId, lineId, stationId } = useParams();
  const { data: workspace } = useWorkspace(slug);
  const { line, station, isPending } = useStation(teamId, lineId, stationId);
  const { edits, change } = useStationEdits(station);
  const customise = useCustomiseStation();

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
  const isBacklog = station.kind === 'backlog';

  const save = (changes: Parameters<typeof customise.mutate>[0]['changes']) => {
    if (teamId && lineId && station) {
      customise.mutate({ teamId, lineId, stationId: station.id, changes });
    }
  };

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
              { label: edits.name || station.name },
            ]}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl gap-10 px-8 py-8">
          <main className="flex min-w-0 flex-1 flex-col gap-8">
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <Popover>
                  <PopoverTrigger
                    aria-label="Station colour"
                    className="mt-1 rounded-md p-0.5 outline-none transition-colors hover:bg-accent data-[popup-open]:bg-accent"
                  >
                    <StationIcon
                      share={stationShare(
                        line.stations.findIndex(
                          (each) => each.id === station.id,
                        ),
                        line.stations.length,
                      )}
                      color={edits.color}
                      className="size-5"
                    />
                  </PopoverTrigger>

                  <PopoverContent align="start" sideOffset={6}>
                    <StationColorPicker
                      value={edits.color}
                      onChange={(color) => {
                        change({ color });
                        save({ color });
                      }}
                    />
                  </PopoverContent>
                </Popover>

                <AutoGrowTextarea
                  value={edits.name}
                  onChange={(event) => change({ name: event.target.value })}
                  onBlur={() => edits.name.trim() && save({ name: edits.name })}
                  aria-label="Station name"
                  placeholder="Station name"
                  maxLength={100}
                  className="font-semibold text-2xl text-foreground leading-8 tracking-tight"
                />
              </div>

              <AutoGrowTextarea
                value={edits.description}
                onChange={(event) =>
                  change({ description: event.target.value })
                }
                onBlur={() => save({ description: edits.description })}
                aria-label="Description"
                placeholder="Add description…"
                className="text-foreground text-sm leading-6"
              />
            </div>

            {!isBacklog && (
              <AgentPromptField
                key={station.id}
                value={edits.agentPrompt}
                onChange={(agentPrompt) => change({ agentPrompt })}
                onBlur={() => save({ agentPrompt: edits.agentPrompt })}
              />
            )}
          </main>

          {customise.isError && (
            <p className="text-destructive text-xs">
              {customise.error.message}
            </p>
          )}

          {isBacklog ? (
            <aside className="w-56 shrink-0">
              <p className="px-2 text-muted-foreground text-xs leading-5">
                Tasks wait here until someone starts them. Nothing runs at a
                backlog, so it has no harness and nothing to instruct.
              </p>
            </aside>
          ) : (
            <StationProperties
              harness={edits.harness}
              onHarness={(harness) => {
                change({ harness });
                save({ harness });
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}
