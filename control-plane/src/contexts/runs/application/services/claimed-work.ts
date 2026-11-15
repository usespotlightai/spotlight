import type { ClaimedWorkDto } from '@runs/application/dto/run.dto';
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
