import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useParams } from 'react-router';
import { Conversation } from '@/components/features/inbox/conversation/Conversation';
import { ChangesPanel } from '@/components/features/runs/ChangesPanel';
import { RunActivity } from '@/components/features/runs/RunActivity';
import { RunBriefing } from '@/components/features/runs/RunBriefing';
import { RunComposer } from '@/components/features/runs/RunComposer';
import { RunOpening } from '@/components/features/runs/RunOpening';
import { ComposerFooter } from '@/components/shared/ComposerFooter';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import {
  runConversationKeys,
  useRunConversation,
} from '@/hooks/api/useRunConversation';
import { useRunStream } from '@/hooks/api/useRunStream';
import { useSession } from '@/hooks/api/useSession';
import { journalKeys, useTaskJournal } from '@/hooks/api/useTaskJournal';
import { teamRunKeys, useTeamRuns } from '@/hooks/api/useTeamRuns';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { working } from '@/lib/run';
import { taskPath } from '@/lib/task';
import { teamPath } from '@/lib/team';
import { TrailContext, useTrail } from '@/lib/trail';

export function Run() {
  const { slug, teamId, runId } = useParams();
  const { data: runs, isPending } = useTeamRuns(teamId);
  const run = runs?.find((each) => each.id === runId);
  const { data: said } = useRunConversation(teamId, runId);
  const { data: worked } = useTaskJournal(slug, said?.taskId);
  const { data: session } = useSession();
  const { data: workspace } = useWorkspace(slug);

  const queryClient = useQueryClient();

  const bump = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: journalKeys.forTask(said?.taskId),
    });
    void queryClient.invalidateQueries({
      queryKey: runConversationKeys.forRun(runId),
    });
    void queryClient.invalidateQueries({
      queryKey: teamRunKeys.forTeam(teamId),
    });
  }, [queryClient, said?.taskId, runId, teamId]);

  useRunStream(runId, run?.state === 'claimed', bump);

  const team = workspace?.teams.find((candidate) => candidate.id === teamId);

  const base: BreadcrumbSegment[] = [
    ...(team && slug
      ? [
          {
            label: team.name,
            avatar: team.name,
            to: teamPath(slug, team.id),
          },
        ]
      : []),
    ...(run
      ? [
          {
            label: said?.title ?? run.taskTitle ?? 'Run',
            to:
              run.taskId && slug && teamId
                ? taskPath(slug, teamId, run.taskId)
                : undefined,
          },
          { label: run.station?.name ?? 'Run' },
        ]
      : []),
  ];
  const { trail, forward } = useTrail(base, 2);

  if (isPending || !slug || !teamId) {
    return null;
  }

  if (!run) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground text-sm">
          There is no such run for this team.
        </p>
      </div>
    );
  }

  const here = run.station?.name === said?.station?.name;

  const item = said && {
    id: said.runId,
    teamId,
    createdAt: said.createdAt,
    station: {
      name: said.station?.name ?? '',
      color: said.station?.color ?? '#a3a8b0',
      position: said.station?.position ?? 0,
      count: said.station?.count ?? 1,
    },
    working: said.working,
    notes: said.notes,
  };

  const footer = here ? (
    <RunComposer
      slug={slug}
      teamId={teamId}
      runId={run.id}
      taskId={said?.taskId}
      station={run.station?.name ?? 'the agent'}
      running={run.state === 'claimed'}
    />
  ) : (
    <p className="text-center text-muted-foreground text-xs">
      This moved on. There is nobody left to tell here.
    </p>
  );

  const activity = run.station ? (
    <RunActivity
      journals={(worked ?? []).filter((each) => each.runId === run.id)}
      working={working(run)}
      station={run.station}
    />
  ) : null;

  return (
    <TrailContext value={forward}>
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title={<Breadcrumbs segments={trail} />} />

        <ChangesPanel>
          {item && item.notes.length > 0 ? (
            <Conversation
              item={item}
              worked={worked ?? []}
              viewerId={session?.user.id}
              opening={
                said?.briefing ? (
                  <RunBriefing
                    briefing={said.briefing}
                    attachments={said.attachments}
                  />
                ) : undefined
              }
              live={run.state === 'claimed' ? activity : undefined}
              footer={footer}
            />
          ) : (
            <>
              <RunOpening
                run={run}
                briefing={said?.briefing ?? null}
                attachments={said?.attachments ?? []}
                activity={activity}
              />

              <ComposerFooter>{footer}</ComposerFooter>
            </>
          )}
        </ChangesPanel>
      </div>
    </TrailContext>
  );
}
