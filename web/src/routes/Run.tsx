import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useParams } from 'react-router';
import { Conversation } from '@/components/features/inbox/conversation/Conversation';
import { ChangesPanel } from '@/components/features/runs/ChangesPanel';
import { RunActivity } from '@/components/features/runs/RunActivity';
import { RunBriefing } from '@/components/features/runs/RunBriefing';
import { RunComposer } from '@/components/features/runs/RunComposer';
import { RunEmpty } from '@/components/features/runs/RunEmpty';
import { RunOpening } from '@/components/features/runs/RunOpening';
import { RunSkeleton } from '@/components/features/runs/RunSkeleton';
import { ComposerFooter } from '@/components/shared/ComposerFooter';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { PageNotice } from '@/components/shared/PageNotice';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { changeStackKeys } from '@/hooks/api/useRunChangeStacks';
import {
  runConversationKeys,
  useRunConversation,
} from '@/hooks/api/useRunConversation';
import { useRunStream } from '@/hooks/api/useRunStream';
import { useSession } from '@/hooks/api/useSession';
import { journalKeys, useTaskJournal } from '@/hooks/api/useTaskJournal';
import { teamRunKeys, useTeamRuns } from '@/hooks/api/useTeamRuns';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { failed, loading } from '@/lib/query';
import { working } from '@/lib/run';
import { taskPath } from '@/lib/task';
import { teamPath } from '@/lib/team';
import { TrailContext, useTrail } from '@/lib/trail';

export function Run() {
  const { slug, teamId, runId } = useParams();
  const runs = useTeamRuns(teamId);
  const run = runs.data?.find((each) => each.id === runId);
  const conversation = useRunConversation(teamId, runId);
  const said = conversation.data;
  const journal = useTaskJournal(slug, said?.taskId);
  const worked = journal.data;
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
    void queryClient.invalidateQueries({
      queryKey: changeStackKeys.forRun(runId),
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

  if (!slug || !teamId) {
    return null;
  }

  if (
    loading(runs) ||
    (run && (loading(conversation) || (said && loading(journal))))
  ) {
    return <RunSkeleton />;
  }

  const lost = failed(runs)
    ? runs
    : run && failed(conversation)
      ? conversation
      : null;

  if (lost) {
    return (
      <PageNotice>
        <CouldNotLoad
          what="The run"
          retrying={lost.isFetching}
          onRetry={() => void lost.refetch()}
        />
      </PageNotice>
    );
  }

  if (!run) {
    return (
      <PageNotice>
        <p className="text-muted-foreground text-sm">
          There is no such run for this team.
        </p>
      </PageNotice>
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

  const ran = (worked ?? []).filter((each) => each.runId === run.id);

  const quiet =
    !working(run) &&
    !failed(journal) &&
    ran.every((each) => each.steps.length === 0);

  const activity = run.station ? (
    <RunActivity journals={ran} working={working(run)} station={run.station} />
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
                activity={
                  quiet ? (
                    <RunEmpty slug={slug} teamId={teamId} run={run} />
                  ) : (
                    activity
                  )
                }
              />

              <ComposerFooter>{footer}</ComposerFooter>
            </>
          )}
        </ChangesPanel>
      </div>
    </TrailContext>
  );
}
