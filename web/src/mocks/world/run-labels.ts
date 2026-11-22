import type { StationRunOutcomeResponseDto } from '@/lib/api';
import type { LabelSource } from '@/lib/judge';
import {
  type HistoryRun,
  isLastCompletedVisit,
} from '@/mocks/world/insights-history';

const ACTION_LABELS: readonly LabelSource[] = [
  'accepted',
  'sent-back',
  'held-as-wrong',
];

const PASSING_LABELS: readonly LabelSource[] = ['accepted', 'merged'];

const WORK_ENDINGS: readonly string[] = ['completed', 'stopped'];

export const actionLabelOf = (run: HistoryRun): LabelSource | null => {
  const label =
    ACTION_LABELS.find((each) => each === run.humanAction?.kind) ?? null;

  return label === 'accepted' && !WORK_ENDINGS.includes(run.ending)
    ? null
    : label;
};

const mergeLabelOf = (run: HistoryRun): LabelSource | null =>
  run.pullRequestState === 'merged' && isLastCompletedVisit(run)
    ? 'merged'
    : null;

export const labelOf = (run: HistoryRun): LabelSource | null =>
  actionLabelOf(run) ?? mergeLabelOf(run);

export const labelPasses = (label: LabelSource): boolean =>
  PASSING_LABELS.includes(label);

type Resolution = StationRunOutcomeResponseDto['resolution'];

export const runResolutionOf = (run: HistoryRun): Resolution => {
  const label = labelOf(run);
  const movesOn = run.passed !== null || run.humanAction?.kind === 'started';

  if (label && !labelPasses(label)) {
    return 'sent-back';
  }
  if (label && !(label === 'merged' && movesOn)) {
    return 'accepted';
  }
  if (run.ending === 'failed') {
    return 'failed';
  }
  if (run.ending !== 'completed') {
    return 'other';
  }

  return movesOn ? 'moved-on' : 'other';
};
