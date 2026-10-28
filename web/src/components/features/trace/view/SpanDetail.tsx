import type { Ref } from 'react';
import { RunJudgeScore } from '@/components/features/runs/judge/RunJudgeScore';
import { RunNetwork } from '@/components/features/runs/network/RunNetwork';
import { DetailDescription } from '@/components/features/trace/view/detail/DetailDescription';
import { DetailFields } from '@/components/features/trace/view/detail/DetailFields';
import { DetailHeader } from '@/components/features/trace/view/detail/DetailHeader';
import { DetailSection } from '@/components/features/trace/view/detail/DetailSection';
import { CodeDiff } from '@/components/shared/CodeDiff';
import { type PaneConfig, SidePane } from '@/components/shared/SidePane';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  answeredBy,
  contentsOf,
  type Field,
  inputOf,
  restOf,
} from '@/lib/detail';
import { describeConnection } from '@/lib/run-network';
import { runIdOf, type TraceNode } from '@/lib/trace';

const DETAIL_PANE: PaneConfig = {
  storageKey: 'spotlight.trace-detail-width',
  min: 288,
  max: 960,
  initial: 520,
  label: 'Resize the details',
};

export function SpanDetail({
  node,
  teamId,
  open,
  duration,
  ref,
}: {
  node: TraceNode;
  teamId: string;
  open: boolean;
  duration?: number;
  ref?: Ref<HTMLElement>;
}) {
  const { step } = node;
  const runId = runIdOf(node);

  const cause = describeConnection(node);
  const input = inputOf(node);
  const answered = answeredBy(node);
  const contents = contentsOf(node);
  const rest = restOf(node);

  const contentFields: Field[] = [...contents.kinds].map(([path, count]) => ({
    path,
    value: String(count),
    kind: 'number',
  }));

  const reported: Field[] = rest.map((each) => ({
    path: each.name,
    value: `"${each.value}"`,
    kind: 'string',
  }));

  return (
    <SidePane pane={DETAIL_PANE} open={open} duration={duration} ref={ref}>
      <ScrollArea
        className="h-full"
        contentClassName="min-h-full flex flex-col gap-5 px-4 py-4"
      >
        <DetailHeader node={node} />

        {runId && <RunJudgeScore teamId={teamId} runId={runId} />}
        {runId && <RunNetwork teamId={teamId} runId={runId} />}

        {cause && <DetailDescription description={cause} />}
        {input && <DetailDescription description={input} />}
        {answered && <DetailDescription description={answered} />}

        {step?.change && (
          <DetailSection title="Diff" copy={step.change.after}>
            <p className="flex gap-2 text-muted-foreground text-xs">
              {step.change.path && (
                <span className="truncate">{step.change.path}</span>
              )}
              {step.locations.length > 0 && (
                <span className="shrink-0">
                  {step.locations
                    .flatMap((where) =>
                      where.line === null ? [] : [where.line],
                    )
                    .join(', ')}
                </span>
              )}
            </p>
            <CodeDiff
              path={step.change.path}
              before={step.change.before}
              after={step.change.after}
            />
          </DetailSection>
        )}

        {contentFields.length > 0 && (
          <DetailSection title="Contents">
            <DetailFields fields={contentFields} />
          </DetailSection>
        )}

        {reported.length > 0 && (
          <DetailSection title="Attributes">
            <DetailFields fields={reported} />
          </DetailSection>
        )}
      </ScrollArea>
    </SidePane>
  );
}
