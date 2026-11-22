import type { LabelSource } from '@/lib/judge';
import {
  type HistoryRun,
  isLastCompletedVisit,
} from '@/mocks/world/insights-history';

const FIRST_ACT_LABELS: readonly LabelSource[] = [
  'accepted',
  'sent-back',
  'held-as-wrong',
];

const PASSING_LABELS: readonly LabelSource[] = ['accepted', 'merged'];

export const firstActLabelOf = (run: HistoryRun): LabelSource | null =>
  FIRST_ACT_LABELS.find((label) => label === run.firstHumanAction?.kind) ??
  null;

const mergeLabelOf = (run: HistoryRun): LabelSource | null =>
  run.pullRequestState === 'merged' && isLastCompletedVisit(run)
    ? 'merged'
    : null;

export const labelOf = (run: HistoryRun): LabelSource | null =>
  firstActLabelOf(run) ?? mergeLabelOf(run);

export const labelPasses = (label: LabelSource): boolean =>
  PASSING_LABELS.includes(label);
