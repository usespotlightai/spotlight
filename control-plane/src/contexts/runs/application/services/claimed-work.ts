import type { ClaimedWorkDto } from '@runs/application/dto/run.dto';
import type { Run } from '@runs/domain/aggregates/run.aggregate';

export const claimedRun = (run: Run): ClaimedWorkDto => ({
  kind: 'run',
  run: {
    id: run.id.value,
    harness: run.harness.value,
    attempt: run.attempt.number,
    spec: run.spec.value,
    extensions: run.extensions.value,
    workspaceKey: run.workspaceKey?.value ?? null,
  },
});
