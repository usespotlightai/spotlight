import { RunSpecContract } from '@work/application/contracts/run-spec.contract';
import type { ClaimedWorkDto } from '@work/application/dto/run.dto';
import type { Run } from '@work/domain/aggregates/run.aggregate';

export const claimedRun = (run: Run): ClaimedWorkDto => ({
  kind: 'run',
  run: {
    id: run.id.value,
    harness: run.harness.value,
    attempt: run.attempt,
    spec: RunSpecContract.toWire(run.spec),
  },
});
