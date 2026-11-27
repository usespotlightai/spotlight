import { type ReactNode, useState } from 'react';

import { TaskPullRequestPills } from '@/components/features/board/task/TaskPullRequestPills';
import type { AfterRun } from '@/components/features/inbox/conversation/Conversation';
import { RunActivity } from '@/components/features/runs/RunActivity';
import { RunBriefing } from '@/components/features/runs/RunBriefing';
import { RunCitationTargets } from '@/components/features/runs/RunCitationTargets';
import { RunClosing } from '@/components/features/runs/RunClosing';
import { RunConversation } from '@/components/features/runs/RunConversation';
import { RunEmpty } from '@/components/features/runs/RunEmpty';
import { RunFooter } from '@/components/features/runs/RunFooter';
import { RunHeader } from '@/components/features/runs/RunHeader';
import { RunRunnerNotice } from '@/components/features/runs/RunRunnerNotice';
import { RunSidePanel } from '@/components/features/runs/RunSidePanel';
import { StepAnchorsProvider } from '@/components/features/runs/StepAnchorsProvider';
import { FileDropZone } from '@/components/shared/attachment/FileDropZone';
import { useTaskPullRequests } from '@/hooks/api/useTaskPullRequests';
import { useRunDeciding } from '@/hooks/useRunDeciding';
import { useRunThread } from '@/hooks/useRunThread';
import { useRunTrail } from '@/hooks/useRunTrail';
import { type RunJournal, workedOn } from '@/lib/inbox';
import { shownProgress, type TeamRun, underway } from '@/lib/run';
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

const placeClosing = (
  closing: ReactNode,
  followedOn: boolean,
  runId: string,
): { closing?: ReactNode; afterRun?: AfterRun } => {
  if (!followedOn) {
    return { closing };
  }
  const closed = Boolean(closing);
  return closed ? { afterRun: { runId, content: closing } } : {};
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
  const {
    latest,
    conversation,
    progress: reportedProgress,
  } = useRunThread(run, reported);

  const notes = conversation?.notes ?? [];
  const progress = shownProgress(reportedProgress, latest.id, worked);
  const decide = useRunDeciding(slug, run);
  const ran = workedOn(worked, notes, run.id);
  const [openAt, setOpenAt] = useState(() => followedOnAfter(notes, run.id));
  const followedOn = followedOnAfter(notes, run.id) !== null;

  const { data: pullRequests = [] } = useTaskPullRequests(teamId, run.taskId);
  const pills = pullRequests.length > 0 && (
    <TaskPullRequestPills pullRequests={pullRequests} />
  );

  const footer = (
    <>
      <RunRunnerNotice run={run} />
      <RunFooter
        slug={slug}
        teamId={teamId}
        run={run}
        latest={latest}
        conversation={conversation}
        onSent={() => setOpenAt(null)}
      />
    </>
  );

  const closing = underway(run) ? undefined : (
    <RunClosing
      slug={slug}
      teamId={teamId}
      run={run}
      conversation={conversation}
      ran={ran}
    />
  );

  const activity = run.station ? (
    <RunActivity
      runId={run.id}
      journals={ran}
      progress={latest.id === run.id ? progress : null}
      station={run.station}
      harness={run.harness}
    />
  ) : null;

  const live =
    progress && run.station ? (
      <RunActivity
        runId={latest.id}
        journals={workedOn(worked, notes, latest.id)}
        progress={progress}
        station={run.station}
        harness={run.harness}
      />
    ) : undefined;

  return (
    <TrailContext value={forward}>
      <FileDropZone className="flex min-h-0 flex-1 flex-col rounded-lg">
        <RunHeader slug={slug} teamId={teamId} run={run} trail={trail} />

        <RunSidePanel>
          <StepAnchorsProvider runId={run.id} journals={worked}>
            <RunCitationTargets runId={run.id} journals={worked}>
              {conversation && notes.length > 0 ? (
                <RunConversation
                  teamId={teamId}
                  conversation={conversation}
                  worked={worked}
                  progress={progress}
                  openAt={openAt}
                  live={live}
                  {...placeClosing(closing, followedOn, run.id)}
                  footer={footer}
                  pills={pills}
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
                  pills={pills}
                />
              )}
            </RunCitationTargets>
          </StepAnchorsProvider>
        </RunSidePanel>
      </FileDropZone>
    </TrailContext>
  );
}
