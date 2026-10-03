import { RunActivity } from '@/components/features/runs/RunActivity';
import { RunClosing } from '@/components/features/runs/RunClosing';
import { RunConversation } from '@/components/features/runs/RunConversation';
import { RunEmpty } from '@/components/features/runs/RunEmpty';
import { RunFooter } from '@/components/features/runs/RunFooter';
import { RunOpening } from '@/components/features/runs/RunOpening';
import { RunSidePanel } from '@/components/features/runs/RunSidePanel';
import { StepAnchorsProvider } from '@/components/features/runs/StepAnchorsProvider';
import { ComposerFooter } from '@/components/shared/ComposerFooter';
import { Breadcrumbs } from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useRunTrail } from '@/hooks/useRunTrail';
import { decisionOwed, type RunJournal, workedOn } from '@/lib/inbox';
import { type TeamRun, working } from '@/lib/run';
import {
  type RunConversation as Said,
  stayedQuiet,
} from '@/lib/run-conversation';
import { TrailContext, useTrail } from '@/lib/trail';

type RunPageProps = {
  slug: string;
  teamId: string;
  run: TeamRun;
  said: Said | undefined;
  worked: readonly RunJournal[];
  journalFailed: boolean;
};

export function RunPage({
  slug,
  teamId,
  run,
  said,
  worked,
  journalFailed,
}: RunPageProps) {
  const base = useRunTrail({ slug, teamId, run, title: said?.title });
  const { trail, forward } = useTrail(base, 2);

  const notes = said?.notes ?? [];
  const deciding = decisionOwed(notes);
  const ran = workedOn(worked, notes, run.id);

  const footer = (
    <RunFooter
      slug={slug}
      teamId={teamId}
      run={run}
      said={said}
      deciding={deciding}
    />
  );

  const closing = working(run) ? undefined : (
    <RunClosing
      slug={slug}
      teamId={teamId}
      run={run}
      said={said}
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
            {said && notes.length > 0 ? (
              <RunConversation
                teamId={teamId}
                run={run}
                said={said}
                worked={worked}
                activity={activity}
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
                    stayedQuiet(run, ran, journalFailed) ? (
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
