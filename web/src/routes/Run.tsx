import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router';
import { Conversation } from '@/components/features/inbox/conversation/Conversation';
import { RunActions } from '@/components/features/runs/RunActions';
import { RunActivity } from '@/components/features/runs/RunActivity';
import { RunBriefing } from '@/components/features/runs/RunBriefing';
import { RunComposer } from '@/components/features/runs/RunComposer';
import { RunEmpty } from '@/components/features/runs/RunEmpty';
import { RunOpening } from '@/components/features/runs/RunOpening';
import { RunSidePanel } from '@/components/features/runs/RunSidePanel';
import { RunSkeleton } from '@/components/features/runs/RunSkeleton';
import { RunWaiting } from '@/components/features/runs/RunWaiting';
import { StepAnchorsProvider } from '@/components/features/runs/StepAnchorsProvider';
import { UntaskedRunOf } from '@/components/features/runs/UntaskedRunOf';
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
import { runMemoryKeys } from '@/hooks/api/useRunMemories';
import { runScoreKeys } from '@/hooks/api/useRunScores';
import { useRunStream } from '@/hooks/api/useRunStream';
import { journalKeys, useTaskJournal } from '@/hooks/api/useTaskJournal';
import { teamRunKeys, useTeamRuns } from '@/hooks/api/useTeamRuns';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { decisionOwed, lastSpokenAt, threadText, workedOn } from '@/lib/inbox';
import { failed, loading } from '@/lib/query';
import { waitsOnPerson, working } from '@/lib/run';
import { taskPath } from '@/lib/task';
import { teamPath } from '@/lib/team';
import { TrailContext, useTrail } from '@/lib/trail';

export function Run() {
  const { slug, teamId, runId } = useParams();
  const runs = useTeamRuns(teamId);
  const run = runs.data?.find((each) => each.id === runId);
  const conversation = useRunConversation(
    teamId,
    runs.data && !run ? undefined : runId,
  );
  const said = conversation.data;
  const journal = useTaskJournal(slug, said?.taskId);
  const worked = journal.data;
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
    if (teamId && runId) {
      void queryClient.invalidateQueries({
        queryKey: runMemoryKeys.forRun(teamId, runId),
      });
    }
  }, [queryClient, said?.taskId, runId, teamId]);

  useRunStream(runId, run?.state === 'claimed', bump);

  const state = run?.state;
  const stood = useRef(state);

  useEffect(() => {
    if (stood.current && state && stood.current !== state) {
      bump();
      void queryClient.invalidateQueries({
        queryKey: runScoreKeys.forRun(runId),
      });
    }
    stood.current = state;
  }, [state, bump, queryClient, runId]);

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
    return <UntaskedRunOf slug={slug} teamId={teamId} runId={runId} />;
  }

  const here = run.station?.name === said?.station?.name;
  const deciding = decisionOwed(said?.notes ?? []);

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
      stationId={run.station?.id}
      running={run.state === 'claimed'}
      answering={waitsOnPerson(run) && !deciding}
    />
  ) : (
    <p className="pb-5 text-center text-muted-foreground text-xs">
      This moved on. There is nobody left to tell here.
    </p>
  );

  const ran = workedOn(worked ?? [], said?.notes ?? [], run.id);

  const waiting = waitsOnPerson(run) ? (
    <RunWaiting slug={slug} run={run} deciding={deciding} />
  ) : undefined;

  const quiet =
    !working(run) &&
    !waiting &&
    !failed(journal) &&
    ran.every((each) => each.steps.length === 0);

  const actions = working(run) ? undefined : (
    <RunActions
      slug={slug}
      teamId={teamId}
      runId={run.id}
      thread={threadText({
        opening:
          said?.briefing ||
          [
            said?.title ?? run.taskTitle,
            said?.description ?? run.taskDescription,
          ]
            .filter(Boolean)
            .join('\n\n'),
        notes: said?.notes ?? [],
        ran,
        agent: run.station?.name ?? 'The agent',
      })}
      at={lastSpokenAt(said?.notes ?? [], ran) ?? run.updatedAt}
    />
  );

  const closing =
    actions || waiting ? (
      <div className="flex flex-col gap-6">
        {actions}
        {waiting}
      </div>
    ) : undefined;

  const activity = run.station ? (
    <RunActivity journals={ran} working={working(run)} station={run.station} />
  ) : null;

  return (
    <TrailContext value={forward}>
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title={<Breadcrumbs segments={trail} />} />

        <RunSidePanel>
          <StepAnchorsProvider runId={run.id} journals={worked ?? []}>
            {item && item.notes.length > 0 ? (
              <Conversation
                item={item}
                worked={worked ?? []}
                opening={
                  said?.briefing ? (
                    <RunBriefing
                      briefing={said.briefing}
                      attachments={said.attachments}
                    />
                  ) : undefined
                }
                live={run.state === 'claimed' ? activity : undefined}
                closing={closing}
                footer={footer}
              />
            ) : (
              <>
                <RunOpening
                  run={run}
                  briefing={said?.briefing ?? null}
                  attachments={said?.attachments ?? []}
                  closing={closing}
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
          </StepAnchorsProvider>
        </RunSidePanel>
      </div>
    </TrailContext>
  );
}
