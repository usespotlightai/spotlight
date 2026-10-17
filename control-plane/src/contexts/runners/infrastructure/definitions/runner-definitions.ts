import {
  madeBy,
  problemsIn,
  refinedBy,
} from '@platform/definitions/definition-schema';
import type {
  ParsedEgress,
  ParsedPool,
  ParsedTrust,
  ParsedWorkspaceRunners,
  RunnerDefinitionsPort,
} from '@runners/application/ports/runner-definitions.port';
import {
  EGRESS,
  RUNNER_POOL,
  RUNNER_TRUST,
  WORKSPACE_RUNNERS,
} from '@runners/application/rendering/runner-problems';
import { EgressKey } from '@runners/domain/value-objects/egress-key.vo';
import { EgressReference } from '@runners/domain/value-objects/egress-reference.vo';
import { EgressToken } from '@runners/domain/value-objects/egress-token.vo';
import {
  EGRESS_TRAFFIC,
  EgressTraffic,
} from '@runners/domain/value-objects/egress-traffic.vo';
import { EgressUrl } from '@runners/domain/value-objects/egress-url.vo';
import { MaxRuns } from '@runners/domain/value-objects/max-runs.vo';
import { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import { PoolToken } from '@runners/domain/value-objects/pool-token.vo';
import { ProvisionSecret } from '@runners/domain/value-objects/provision-secret.vo';
import { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { TrustKey } from '@runners/domain/value-objects/trust-key.vo';
import { TrustedWorkload } from '@runners/domain/value-objects/trusted-workload.vo';
import { z } from 'zod';

const once = (all: readonly string[], context: z.RefinementCtx) => {
  for (const [at, each] of all.entries()) {
    if (all.indexOf(each) !== at) {
      context.addIssue({
        code: 'custom',
        path: [at],
        message: `names ${each} twice`,
      });
    }
  }
};

const labels = z
  .array(madeBy((raw) => RunnerLabels.of([raw])))
  .default([])
  .superRefine(once);

const writeOnlyVersion = z
  .number({ error: 'is a whole number that changes to rotate the value' })
  .int('is a whole number that changes to rotate the value')
  .min(0, 'is a whole number that changes to rotate the value')
  .nullish();

const PULL_ONLY =
  'is only for a pool that is pulled from. A pool that provisions has no token. Spotlight calls it instead';

const poolSchema = z
  .object({
    key: madeBy(PoolKey.of),
    labels,
    maxRuns: z
      .number({ error: 'is a whole number of runs' })
      .superRefine(refinedBy(MaxRuns.of))
      .nullish(),
    token: madeBy(PoolToken.of).nullish(),
    tokenVersion: writeOnlyVersion,
    provision: z
      .object({
        url: madeBy(ProvisionUrl.of),
        secret: madeBy(ProvisionSecret.of).nullish(),
        secretVersion: writeOnlyVersion,
        egress: madeBy(EgressReference.of).nullish(),
        egressTraffic: z
          .enum(EGRESS_TRAFFIC, {
            error: `is ${EGRESS_TRAFFIC.join(' or ')}`,
          })
          .nullish(),
      })
      .nullish(),
  })
  .superRefine((pool, context) => {
    if (!pool.provision) {
      return;
    }

    if (pool.provision.egressTraffic && !pool.provision.egress) {
      context.addIssue({
        code: 'custom',
        path: ['provision', 'egressTraffic'],
        message: 'is only for a pool that names an egress in provision.egress',
      });
    }

    for (const field of ['token', 'tokenVersion'] as const) {
      if (pool[field] !== null && pool[field] !== undefined) {
        context.addIssue({ code: 'custom', path: [field], message: PULL_ONLY });
      }
    }
  });

const egressSchema = z.object({
  key: madeBy(EgressKey.of),
  url: madeBy(EgressUrl.of),
  token: madeBy(EgressToken.of).nullish(),
  tokenVersion: writeOnlyVersion,
});

const trustSchema = z.object({
  key: madeBy(TrustKey.of),
  issuer: madeBy(TrustedWorkload.issuerOf),
  subject: madeBy(TrustedWorkload.subjectOf),
  audience: madeBy(TrustedWorkload.audienceOf).default('spotlight'),
  labels,
});

const workspaceRunnersSchema = z.object({
  trusts: z.array(madeBy(TrustKey.of)).default([]),
  pools: z.array(madeBy(PoolKey.of)).default([]),
});

export class RunnerDefinitions implements RunnerDefinitionsPort {
  trust(input: unknown): ParsedTrust {
    const read = trustSchema.safeParse(input);

    return read.success
      ? {
          ok: true,
          key: TrustKey.of(read.data.key),
          workload: TrustedWorkload.of(read.data),
          labels: RunnerLabels.of(read.data.labels),
        }
      : { ok: false, problems: problemsIn(RUNNER_TRUST, read.error) };
  }

  pool(input: unknown): ParsedPool {
    const read = poolSchema.safeParse(input);

    if (!read.success) {
      return { ok: false, problems: problemsIn(RUNNER_POOL, read.error) };
    }

    const { provision } = read.data;

    return {
      ok: true,
      key: PoolKey.of(read.data.key),
      labels: RunnerLabels.of(read.data.labels),
      maxRuns:
        read.data.maxRuns === null || read.data.maxRuns === undefined
          ? null
          : MaxRuns.of(read.data.maxRuns),
      access: provision
        ? {
            mode: 'push',
            url: ProvisionUrl.of(provision.url),
            secret: provision.secret
              ? ProvisionSecret.of(provision.secret)
              : null,
            secretVersion: provision.secretVersion ?? null,
            egress: provision.egress
              ? EgressReference.of(provision.egress)
              : null,
            egressTraffic: provision.egressTraffic
              ? EgressTraffic.of(provision.egressTraffic)
              : EgressTraffic.all(),
          }
        : {
            mode: 'pull',
            token: read.data.token ? PoolToken.of(read.data.token) : null,
            tokenVersion: read.data.tokenVersion ?? null,
          },
    };
  }

  egress(input: unknown): ParsedEgress {
    const read = egressSchema.safeParse(input);

    return read.success
      ? {
          ok: true,
          key: EgressKey.of(read.data.key),
          url: EgressUrl.of(read.data.url),
          token: read.data.token ? EgressToken.of(read.data.token) : null,
          tokenVersion: read.data.tokenVersion ?? null,
        }
      : { ok: false, problems: problemsIn(EGRESS, read.error) };
  }

  workspaceRunners(input: unknown): ParsedWorkspaceRunners {
    const read = workspaceRunnersSchema.safeParse(input);

    return read.success
      ? {
          ok: true,
          trusts: read.data.trusts.map(TrustKey.of),
          pools: read.data.pools.map(PoolKey.of),
        }
      : { ok: false, problems: problemsIn(WORKSPACE_RUNNERS, read.error) };
  }
}
