import type {
  RunnerResourceDto,
  RunnerTrustResourceDto,
  WorkspaceRunnersResourceDto,
} from '@runners/application/dto/runner-resource.dto';
import type {
  KeptRunner,
  KeptTrust,
  KeptWorkspaceRunners,
} from '@runners/application/ports/runner-resources.port';
import { RunnerProblems } from '@runners/application/rendering/runner-problems';
import {
  driftBetween,
  type Enrolment,
} from '@runners/domain/services/runner-drift';

export const RunnerResourceMapper = {
  runner(runner: KeptRunner): RunnerResourceDto {
    return {
      id: runner.id,
      version: runner.revision,
      address: runner.name,
      workspaceId: runner.workspaceId.value,
      name: runner.name,
      labels: runner.labels,
      trust: runner.trustKey,
      warnings: [],
    };
  },

  trust(trust: KeptTrust): RunnerTrustResourceDto {
    return {
      id: trust.id,
      version: trust.version,
      address: trust.key,
      workspaceId: trust.workspaceId.value,
      key: trust.key,
      issuer: trust.issuer,
      subject: trust.subject,
      audience: trust.audience,
      labels: trust.labels,
      warnings: [],
    };
  },

  workspaceRunners(
    declared: KeptWorkspaceRunners,
    slug: string,
    enrolment: Enrolment,
  ): WorkspaceRunnersResourceDto {
    const drift = driftBetween(declared, enrolment);

    return {
      id: declared.id,
      version: declared.version,
      address: slug,
      workspaceId: declared.workspaceId.value,
      runners: declared.runners,
      trusts: declared.trusts,
      drift: drift.undeclared,
      warnings: [
        ...declared.runners.flatMap((name, at) =>
          drift.unknownRunners.includes(name)
            ? [RunnerProblems.noSuchRunner(name, at)]
            : [],
        ),
        ...declared.trusts.flatMap((key, at) =>
          drift.unknownTrusts.includes(key)
            ? [RunnerProblems.noSuchTrust(key, at)]
            : [],
        ),
        ...drift.undeclared.map(RunnerProblems.drifted),
      ],
    };
  },
};
