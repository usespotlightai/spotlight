import {
  type JudgeRepairHandlers,
  judgeRepairSubscribers,
} from '@insights/presentation/events/judge-repair.subscribers';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { describe, expect, it } from 'vitest';

const OUTSIDE_THE_DELIVERY = [
  'insights.disagree-with-judge-after-score',
  'insights.disagree-with-judge-after-run-ended',
  'insights.disagree-with-judge-after-run-outcome-changed',
  'insights.disagree-with-judge-after-closed-pull-request',
  'insights.withdraw-judge-disagreements-after-line-changed',
  'insights.rejudge-labelled-runs-after-line-changed',
  'insights.propose-picked-claims-revision',
  'insights.record-claims-source-after-line-changed',
];

describe('judgeRepairSubscribers', () => {
  it('runs each subscriber that saves several aggregates, or asks another context to, outside the delivery transaction', () => {
    const subscribers = judgeRepairSubscribers(
      partial<JudgeRepairHandlers>({}),
    );

    expect(
      subscribers
        .filter((each) => each.callsOut)
        .map((each) => each.name)
        .sort(),
    ).toEqual([...OUTSIDE_THE_DELIVERY].sort());
  });
});
