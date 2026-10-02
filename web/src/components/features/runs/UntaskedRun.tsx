import type { ReactNode } from 'react';
import { TimeMarker } from '@/components/features/inbox/conversation/TimeMarker';
import { ChangesPanel } from '@/components/features/runs/ChangesPanel';
import { RunActivity } from '@/components/features/runs/RunActivity';
import { RunImage } from '@/components/features/runs/RunImage';
import { StepAnchorsProvider } from '@/components/features/runs/StepAnchorsProvider';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { useStickToBottom } from '@/hooks/useStickToBottom';
import type { ReplayRun } from '@/lib/replay';
import { working } from '@/lib/run';
import { TrailContext } from '@/lib/trail';

type UntaskedRunProps = {
  trail: BreadcrumbSegment[];
  forward: BreadcrumbSegment[];
  run: Pick<
    ReplayRun,
    'id' | 'state' | 'startedAt' | 'image' | 'station' | 'journals'
  >;
  banner: ReactNode;
  details: ReactNode;
  idleNote: string;
  footer: ReactNode;
};

export function UntaskedRun({
  trail,
  forward,
  run,
  banner,
  details,
  idleNote,
  footer,
}: UntaskedRunProps) {
  const scroller = useStickToBottom<HTMLDivElement>();
  const busy = working(run);
  const steps = run.journals.some((each) => each.steps.length > 0);

  return (
    <TrailContext value={forward}>
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title={<Breadcrumbs segments={trail} />} />

        <ChangesPanel>
          <StepAnchorsProvider runId={run.id} journals={run.journals}>
            <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto flex w-full max-w-3xl flex-col px-8 py-8">
                <TimeMarker at={run.startedAt} />
                <RunImage image={run.image} />

                <div className="mt-6">{banner}</div>

                <div className="mt-3 flex flex-col gap-3">{details}</div>

                {run.station && (
                  <RunActivity
                    journals={run.journals}
                    working={busy}
                    station={run.station}
                  />
                )}

                {!busy && !steps && (
                  <p className="mt-6 text-center text-muted-foreground text-sm">
                    {idleNote}
                  </p>
                )}
              </div>
            </div>

            {footer}
          </StepAnchorsProvider>
        </ChangesPanel>
      </div>
    </TrailContext>
  );
}
