import type { ClaimedWorkDto } from '@runs/application/dto/run.dto';
import type { ClaimedReviewWork } from '@runs/application/ports/review-work.port';
import type { Run } from '@runs/domain/aggregates/run.aggregate';

export const claimedRun = (run: Run): ClaimedWorkDto => ({
  kind: 'run',
  run: {
    id: run.id.value,
    harness: run.harness.value,
    attempt: run.attempt.number,
    line: run.line?.value ?? null,
    spec: run.spec.value,
    extensions: run.extensions.value,
    workingCopyKey: run.workingCopyKey?.value ?? null,
  },
});

export const claimedReviewWork = (work: ClaimedReviewWork): ClaimedWorkDto =>
  work.kind === 'check'
    ? { kind: 'check', check: work }
    : { kind: 'diff', diff: work };
