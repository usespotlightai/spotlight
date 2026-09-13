import { useParams } from 'react-router';
import { StationIcon } from '@/components/features/board/column/StationIcon';
import { AgentPromptField } from '@/components/features/stations/AgentPromptField';
import { StationColorPicker } from '@/components/features/stations/StationColorPicker';
import { StationProperties } from '@/components/features/stations/StationProperties';
import { AutoGrowTextarea } from '@/components/shared/form/AutoGrowTextarea';
import { ProposedPullRequest } from '@/components/shared/ProposedPullRequest';
import { RereadConfigurationButton } from '@/components/shared/RereadConfigurationButton';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useCustomiseStation } from '@/hooks/api/useCustomiseStation';
import { useSetLineRepositories } from '@/hooks/api/useSetLineRepositories';
import { useStation } from '@/hooks/api/useStation';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { useReseeded } from '@/hooks/useReseeded';
import { useStationEdits } from '@/hooks/useStationEdits';
import { sameMembers } from '@/lib/members';
import { stationShare } from '@/lib/station';
import { linePath, teamPath } from '@/lib/team';
import { useTrail } from '@/lib/trail';

export function Station() {
  const { slug, teamId, lineId, stationId } = useParams();
  const { data: workspace } = useWorkspace(slug);
  const { line, station, isPending } = useStation(teamId, lineId, stationId);
  const { edits, change } = useStationEdits(station);
  const customise = useCustomiseStation();
  const setRepositories = useSetLineRepositories();

  const [repos, setRepos] = useReseeded(line?.id, () =>
    line ? [...line.repositories] : [],
  );

  const [skills, setSkills] = useReseeded(station?.id, () =>
    station ? [...station.skills] : [],
  );

  const team = workspace?.teams.find((candidate) => candidate.id === teamId);

  const base: BreadcrumbSegment[] = [
    ...(team
      ? [
          {
            label: team.name,
            avatar: team.name,
            to: slug && teamId ? teamPath(slug, teamId) : undefined,
          },
        ]
      : []),
    ...(line
      ? [
          {
            label: line.name,
            to:
              slug && teamId && lineId
                ? linePath(slug, teamId, lineId)
                : undefined,
          },
        ]
      : []),
    ...(station ? [{ label: edits.name || station.name }] : []),
  ];
  const { trail } = useTrail(base);

  if (isPending) {
    return null;
  }

  if (!line || !station) {
    return (
      <>
        <PageHeader title="Station not found" />
        <div className="flex min-h-0 flex-1 items-center justify-center p-8">
          <p className="text-muted-foreground text-sm">
            This line has no station at that address.
          </p>
        </div>
      </>
    );
  }

  const ends = station.kind !== 'work';

  const changed: NonNullable<
    Parameters<typeof customise.mutate>[0]
  >['changes'] = {};
  if (edits.name !== station.name) {
    changed.name = edits.name;
  }
  if (edits.color !== station.color) {
    changed.color = edits.color;
  }
  if (edits.description !== (station.description ?? '')) {
    changed.description = edits.description || null;
  }
  if (!ends && edits.harness !== (station.harness ?? '')) {
    changed.harness = edits.harness || null;
  }
  if (!ends && edits.model !== (station.model ?? '')) {
    changed.model = edits.model || null;
  }
  if (!ends && edits.effort !== (station.effort ?? '')) {
    changed.effort = edits.effort || null;
  }
  if (!ends && edits.agentPrompt !== (station.agentPrompt ?? '')) {
    changed.agentPrompt = edits.agentPrompt || null;
  }
  if (!ends && !sameMembers(skills, station.skills)) {
    changed.skills = skills;
  }

  const reposChanged = !sameMembers(repos, line.repositories);

  const stationChanged = Object.keys(changed).length > 0;
  const dirty = stationChanged || reposChanged;
  const proposable = dirty && edits.name.trim().length > 0;

  const proposing = customise.isPending || setRepositories.isPending;
  const proposedUrl = customise.data?.url ?? setRepositories.data?.url;
  const proposeError = customise.error ?? setRepositories.error;

  const propose = async () => {
    if (!teamId || !proposable) {
      return;
    }
    if (stationChanged) {
      await customise.mutateAsync({
        teamId,
        lineId: line.id,
        stationId: station.id,
        changes: changed,
      });
    }
    if (reposChanged) {
      await setRepositories.mutateAsync({
        teamId,
        lineId: line.id,
        repositories: repos,
      });
    }
  };

  return (
    <>
      <PageHeader
        title={<Breadcrumbs segments={trail} />}
        actions={
          <>
            <RereadConfigurationButton teamId={teamId} />

            <Button
              size="sm"
              onClick={propose}
              disabled={!proposable || proposing}
              className="rounded-full shadow-none"
            >
              {proposing ? 'Proposing…' : 'Propose changes'}
            </Button>
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-8 py-8">
          {proposedUrl && !dirty && (
            <ProposedPullRequest url={proposedUrl}>
              Changes proposed. The board updates once this pull request is
              merged.
            </ProposedPullRequest>
          )}

          {proposeError && (
            <p className="text-destructive text-sm">{proposeError.message}</p>
          )}

          <div className="flex gap-10">
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
                        onChange={(color) => change({ color })}
                      />
                    </PopoverContent>
                  </Popover>

                  <AutoGrowTextarea
                    value={edits.name}
                    onChange={(event) => change({ name: event.target.value })}
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
                  aria-label="Description"
                  placeholder="Add description…"
                  className="text-foreground text-sm leading-6"
                />
              </div>

              {!ends && (
                <AgentPromptField
                  key={station.id}
                  value={edits.agentPrompt}
                  onChange={(agentPrompt) => change({ agentPrompt })}
                />
              )}
            </main>

            <StationProperties
              slug={slug}
              teamId={teamId}
              repositories={repos}
              onRepositories={setRepos}
              {...(ends
                ? {
                    note:
                      station.kind === 'backlog'
                        ? 'Tasks wait here until someone starts them. Nothing runs at a backlog, so it has no harness and nothing to instruct.'
                        : 'Tasks land here once the line is done with them. Nothing runs at it.',
                  }
                : {
                    harness: edits.harness,
                    onHarness: (harness: string) =>
                      change({ harness, model: '', effort: '' }),
                    model: edits.model,
                    onModel: (model: string) => change({ model }),
                    effort: edits.effort,
                    onEffort: (effort: string) => change({ effort }),
                    skills,
                    onSkills: setSkills,
                  })}
            />
          </div>
        </div>
      </div>
    </>
  );
}
