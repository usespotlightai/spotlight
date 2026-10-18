import { RunActivity } from '@/components/features/runs/RunActivity';
import { RunBriefing } from '@/components/features/runs/RunBriefing';
import { RunClosing } from '@/components/features/runs/RunClosing';
import { RunConversation } from '@/components/features/runs/RunConversation';
import { RunEmpty } from '@/components/features/runs/RunEmpty';
import { RunFooter } from '@/components/features/runs/RunFooter';
import { RunSidePanel } from '@/components/features/runs/RunSidePanel';
import { StepAnchorsProvider } from '@/components/features/runs/StepAnchorsProvider';
import { Breadcrumbs } from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useRunDeciding } from '@/hooks/useRunDeciding';
import { useRunTrail } from '@/hooks/useRunTrail';
import { decisionPending, type RunJournal, workedOn } from '@/lib/inbox';
import { type TeamRun, working } from '@/lib/run';
import {
  type RunNotes as ConversationData,
  stayedQuiet,
} from '@/lib/run-notes';
import { TrailContext, useTrail } from '@/lib/trail';

type RunPageProps = {
  slug: string;
  teamId: string;
  run: TeamRun;
  conversation: ConversationData | undefined;
  worked: readonly RunJournal[];
  journalFailed: boolean;
};

export function RunPage({
  slug,
  teamId,
  run,
  conversation,
  worked,
  journalFailed,
}: RunPageProps) {
  const base = useRunTrail({ slug, teamId, run, title: conversation?.title });
  const { trail, forward } = useTrail(base, 2);

  const notes = conversation?.notes ?? [];
  const deciding = decisionPending(notes);
  const decide = useRunDeciding(slug, run);
  const ran = workedOn(worked, notes, run.id);

  const footer = (
    <RunFooter
      slug={slug}
      teamId={teamId}
      run={run}
      conversation={conversation}
      deciding={deciding}
    />
  );

  const closing = working(run) ? undefined : (
    <RunClosing
      slug={slug}
      teamId={teamId}
      run={run}
      conversation={conversation}
      ran={ran}
      deciding={deciding}
    />
  );

  const activity = run.station ? (
    <RunActivity journals={ran} working={working(run)} station={run.station} />
  ) : null;

  return (
    <TrailContext value={forward}>
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title={<Breadcrumbs segments={trail} />} />

        <RunSidePanel>
          <StepAnchorsProvider runId={run.id} journals={worked}>
            {conversation && notes.length > 0 ? (
              <RunConversation
                teamId={teamId}
                conversation={conversation}
                worked={worked}
                live={run.state === 'claimed' ? activity : undefined}
                closing={closing}
                footer={footer}
                deciding={decide}
              />
            ) : (
              <RunBriefing
                run={run}
                briefing={conversation?.briefing ?? null}
                attachments={conversation?.attachments ?? []}
                closing={closing}
                activity={
                  stayedQuiet(run, ran, journalFailed) ? (
                    <RunEmpty slug={slug} teamId={teamId} run={run} />
                  ) : (
                    activity
                  )
                }
                footer={footer}
              />
            )}
          </StepAnchorsProvider>
        </RunSidePanel>
      </div>
    </TrailContext>
  );
}
