import { useParams } from 'react-router';
import { InitialAvatar } from '@/components/common/avatar/InitialAvatar';
import { Conversation } from '@/components/inbox/Conversation';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { PageHeader } from '@/components/layout/PageHeader';
import { RunBriefing } from '@/components/runs/RunBriefing';
import { RunComposer } from '@/components/runs/RunComposer';
import { RunOpening } from '@/components/runs/RunOpening';
import { useRunConversation } from '@/hooks/api/useRunConversation';
import { useRunStream } from '@/hooks/api/useRunStream';
import { useSession } from '@/hooks/api/useSession';
import { useTaskJournal } from '@/hooks/api/useTaskJournal';
import { useTeamRuns } from '@/hooks/api/useTeamRuns';
import { useWorkspace } from '@/hooks/api/useWorkspace';
import { taskPath } from '@/lib/task';
import { teamPath } from '@/lib/team';

export function Run() {
  const { slug, teamId, runId } = useParams();
  const { data: runs, isPending } = useTeamRuns(teamId);
  const run = runs?.find((each) => each.id === runId);
  const { data: said } = useRunConversation(teamId, runId);
  const { data: worked } = useTaskJournal(slug, said?.taskId);
  const { data: session } = useSession();
  const { data: workspace } = useWorkspace(slug);

  useRunStream(runId, run?.state === 'claimed');

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

  const team = workspace?.teams.find((candidate) => candidate.id === teamId);
  // Only while the task is still where this run was dispatched from.
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
      teamId={teamId}
      runId={run.id}
      station={run.station?.name ?? 'the agent'}
    />
  ) : (
    <p className="text-center text-muted-foreground text-xs">
      This moved on. There is nobody left to tell here.
    </p>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
                      to: teamPath(slug, team.id),
                    },
                  ]
                : []),
              {
                label: said?.title ?? run.taskTitle ?? 'Run',
                ...(run.taskId
                  ? { to: taskPath(slug, teamId, run.taskId) }
                  : {}),
              },
              { label: run.station?.name ?? 'Run' },
            ]}
          />
        }
      />

      {item && item.notes.length > 0 ? (
        <Conversation
          item={item}
          worked={worked ?? []}
          viewerId={session?.user.id}
          opening={
            said?.briefing ? (
              <RunBriefing briefing={said.briefing} />
            ) : undefined
          }
          footer={footer}
        />
      ) : (
        <>
          <RunOpening run={run} briefing={said?.briefing ?? null} />

          <div className="relative shrink-0 bg-card">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-full h-10 bg-gradient-to-t from-card to-transparent"
            />

            <div className="mx-auto w-full max-w-3xl px-8 pt-2 pb-6">
              <div className="-mx-3">{footer}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
