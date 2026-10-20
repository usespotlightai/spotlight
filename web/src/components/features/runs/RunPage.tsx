import { useState } from 'react';
import { RunActivityOf } from '@/components/features/runs/RunActivityOf';
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
import { useRunThread } from '@/hooks/useRunThread';
import { useRunTrail } from '@/hooks/useRunTrail';
import { decisionPending, type RunJournal, workedOn } from '@/lib/inbox';
import { queued, type TeamRun, working } from '@/lib/run';
import {
  type RunNotes as ConversationData,
  followedOnAfter,
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
  conversation: reported,
  worked,
  journalFailed,
}: RunPageProps) {
  const base = useRunTrail({ slug, teamId, run, title: reported?.title });
  const { trail, forward } = useTrail(base, 2);
  const { latest, conversation } = useRunThread(run, reported);

  const notes = conversation?.notes ?? [];
  const deciding = decisionPending(notes);
  const decide = useRunDeciding(slug, run);
  const ran = workedOn(worked, notes, run.id);
  const [openAt, setOpenAt] = useState(() => followedOnAfter(notes, run.id));
  const followedOn = followedOnAfter(notes, run.id) !== null;

  const footer = (
    <RunFooter
      slug={slug}
      teamId={teamId}
      run={run}
      latest={latest}
      conversation={conversation}
      deciding={deciding}
      onSent={() => setOpenAt(null)}
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

  const stoppingHere = latest.id === run.id && latest.stopping;

  const activity = run.station ? (
    <RunActivityOf
      run={run}
      stopping={stoppingHere}
      journals={ran}
      station={run.station}
    />
  ) : null;

  const live =
    working(latest) && !latest.stopping && run.station ? (
      <RunActivityOf
        run={latest}
        stopping={latest.stopping}
        journals={workedOn(worked, notes, latest.id)}
        station={run.station}
      />
    ) : undefined;

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
                queued={queued(latest) && !latest.stopping}
                openAt={openAt}
                live={live}
                closing={followedOn ? undefined : closing}
                afterRun={(ranId) =>
                  followedOn && ranId === run.id ? closing : null
                }
                footer={footer}
                deciding={decide}
              />
            ) : (
              <RunBriefing
                run={run}
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
