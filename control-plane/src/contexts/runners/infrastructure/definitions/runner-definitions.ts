import { madeBy, problemsIn } from '@platform/definitions/definition-schema';
import type {
  CompiledRunner,
  CompiledTrust,
  CompiledWorkspaceRunners,
  RunnerDefinitionsPort,
} from '@runners/application/ports/runner-definitions.port';
import {
  RUNNER,
  RUNNER_TRUST,
  WORKSPACE_RUNNERS,
} from '@runners/application/rendering/runner-problems';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerName } from '@runners/domain/value-objects/runner-name.vo';
import { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import { z } from 'zod';

const TOKEN = /^[A-Za-z0-9._~-]{32,255}$/;

const once = (all: readonly string[], context: z.RefinementCtx) => {
  for (const [at, each] of all.entries()) {
    if (all.indexOf(each) !== at) {
      context.addIssue({
        code: 'custom',
        path: [at],
        message: `gives ${each} a second time`,
      });
    }
  }
};

const labels = z
  .array(madeBy((raw) => RunnerLabels.of([raw])))
  .default([])
  .superRefine(once);

const runnerSchema = z.object({
  name: madeBy(RunnerName.of),
  labels,
  token: z
    .string()
    .regex(
      TOKEN,
      'is 32 to 255 URL-safe characters, as a generated password would be',
    )
    .optional(),
});

const trustSchema = z.object({
  key: madeBy(TrustKey.of),
  issuer: madeBy(TrustedWorkload.issuerOf),
  subject: madeBy(TrustedWorkload.subjectOf),
  audience: madeBy(TrustedWorkload.audienceOf).default('spotlight'),
  labels,
});

const workspaceRunnersSchema = z.object({
  runners: z.array(madeBy(RunnerName.of)).default([]).superRefine(once),
  trusts: z.array(madeBy(TrustKey.of)).default([]).superRefine(once),
});

export class RunnerDefinitions implements RunnerDefinitionsPort {
  runner(held: unknown): CompiledRunner {
    const read = runnerSchema.safeParse(held);

    return read.success
      ? {
          ok: true,
          name: RunnerName.of(read.data.name),
          labels: RunnerLabels.of(read.data.labels),
          token: read.data.token ?? null,
        }
      : { ok: false, problems: problemsIn(RUNNER, read.error) };
  }

  trust(held: unknown): CompiledTrust {
    const read = trustSchema.safeParse(held);

    return read.success
      ? {
          ok: true,
          key: TrustKey.of(read.data.key),
          workload: TrustedWorkload.of(read.data),
          labels: RunnerLabels.of(read.data.labels),
        }
      : { ok: false, problems: problemsIn(RUNNER_TRUST, read.error) };
  }

  workspaceRunners(held: unknown): CompiledWorkspaceRunners {
    const read = workspaceRunnersSchema.safeParse(held);

    return read.success
      ? {
          ok: true,
          runners: read.data.runners.map(RunnerName.of),
          trusts: read.data.trusts.map(TrustKey.of),
        }
      : { ok: false, problems: problemsIn(WORKSPACE_RUNNERS, read.error) };
  }
}
