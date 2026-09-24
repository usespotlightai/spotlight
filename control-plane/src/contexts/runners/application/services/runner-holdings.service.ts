import type { WorkspaceHolder } from '@identity/application/ports/workspace-holdings.port';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { RunnerTrustRepository } from '@runners/domain/repositories/runner-trust.repository';
import type { WorkspaceRunnersRepository } from '@runners/domain/repositories/workspace-runners.repository';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunnerHoldings implements WorkspaceHolder {
  constructor(
    private readonly runners: RunnerRepository,
    private readonly trusts: RunnerTrustRepository,
    private readonly declarations: WorkspaceRunnersRepository,
  ) {}

  async heldBy(workspaceId: WorkspaceId): Promise<readonly string[]> {
    const [runners, trusts, declared] = await Promise.all([
      this.runners.standingIn(workspaceId),
      this.trusts.inWorkspace(workspaceId),
      this.declarations.declaredIn(workspaceId),
    ]);

    return [
      ...runners
        .filter((each) => each.holdsWorkspace)
        .map((each) => `runner ${each.name.value}`),
      ...trusts.map((each) => `runner trust ${each.key.value}`),
      ...(declared ? ['workspace runners'] : []),
    ];
  }
}
