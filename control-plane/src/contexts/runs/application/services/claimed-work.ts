import type { ClaimedWorkDto } from '@runs/application/dto/run.dto';
import type { Run } from '@runs/domain/aggregates/run.aggregate';

const wireSpecOf = (run: Run): Readonly<Record<string, unknown>> => {
  const spec = run.spec.value;

  return {
    ...run.extensions.value,
    ...spec,
    resume: { key: run.workspaceKey?.value ?? '', ...spec.resume },
  };
};

export const claimedRun = (run: Run): ClaimedWorkDto => ({
  kind: 'run',
  run: {
    id: run.id.value,
    harness: run.harness.value,
    attempt: run.attempt,
    spec: wireSpecOf(run),
  },
});
