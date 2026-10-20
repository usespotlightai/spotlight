import type { ReactNode } from 'react';
import { TimeMarker } from '@/components/features/inbox/conversation/TimeMarker';
import { BriefingCard } from '@/components/features/runs/BriefingCard';
import { RunActions } from '@/components/features/runs/RunActions';
import { RunActivity } from '@/components/features/runs/RunActivity';
import { RunImage } from '@/components/features/runs/RunImage';
import { RunSidePanel } from '@/components/features/runs/RunSidePanel';
import { StepAnchorsProvider } from '@/components/features/runs/StepAnchorsProvider';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useStickToBottom } from '@/hooks/useStickToBottom';
import { lastNoteAt, threadText } from '@/lib/inbox';
import type { ReplayRun } from '@/lib/replay';
import { idleNoteOf, working, workOf } from '@/lib/run';
import { TrailContext } from '@/lib/trail';

type UntaskedRunProps = {
  slug: string;
  teamId: string;
  trail: BreadcrumbSegment[];
  forward: BreadcrumbSegment[];
  run: Pick<
    ReplayRun,
    | 'id'
    | 'state'
    | 'startedAt'
    | 'updatedAt'
    | 'image'
    | 'station'
    | 'journals'
  >;
  banner?: ReactNode;
  threadBriefing: string | null;
  briefing?: string | null;
  failure?: string | null;
  title: string;
  footer: ReactNode;
};

export function UntaskedRun({
  slug,
  teamId,
  trail,
  forward,
  run,
  banner,
  threadBriefing,
  briefing = null,
  failure = null,
  title,
  footer,
}: UntaskedRunProps) {
  const scroller = useStickToBottom<HTMLDivElement>();
  const busy = working(run);
  const steps = run.journals.some((each) => each.steps.length > 0);

  return (
    <TrailContext value={forward}>
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title={<Breadcrumbs segments={trail} />} />

        <RunSidePanel>
          <StepAnchorsProvider runId={run.id} journals={run.journals}>
            <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto flex w-full max-w-3xl flex-col px-8 py-8">
                <TimeMarker at={run.startedAt} />
                <RunImage image={run.image} />

                {banner && <div className="mt-6">{banner}</div>}

                {briefing && (
                  <div className={banner ? 'mt-3' : 'mt-6'}>
                    <BriefingCard briefing={briefing} attachments={[]} />
                  </div>
                )}

                {run.station && (
                  <div className="mt-6 empty:hidden">
                    <RunActivity
                      runId={run.id}
                      journals={run.journals}
                      work={workOf(run)}
                      station={run.station}
                    />
                  </div>
                )}

                {!busy && (
                  <div className="mt-3 flex flex-col gap-6">
                    <RunActions
                      slug={slug}
                      teamId={teamId}
                      runId={run.id}
                      thread={
                        threadText({
                          briefing: threadBriefing,
                          notes: [],
                          ran: run.journals,
                          agent: run.station?.name ?? 'The agent',
                        }) || title
                      }
                      at={lastNoteAt([], run.journals) ?? run.updatedAt}
                    />
                    {(!steps || failure) && (
                      <p className="text-center text-muted-foreground text-sm">
                        {[steps ? null : idleNoteOf(run), failure]
                          .filter(Boolean)
                          .join(' ')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {footer}
          </StepAnchorsProvider>
        </RunSidePanel>
      </div>
    </TrailContext>
  );
}
