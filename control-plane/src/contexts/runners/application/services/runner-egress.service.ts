import type {
  EgressFor,
  RunnerEgressPort,
} from '@runners/application/ports/runner-egress.port';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export class RunnerEgress implements RunnerEgressPort {
  constructor(
    private readonly runners: RunnerRepository,
    private readonly tokens: TokenMintPort,
  ) {}

  async admit(token: string | undefined, at: Date): Promise<EgressFor | null> {
    if (!token) {
      return null;
    }

    const runner = await this.runners.findByEgressTokenHash(
      TokenHash.of(this.tokens.hash(token)),
    );
    const work = runner?.workEgressActsFor(at);

    return runner && work
      ? {
          runnerId: runner.id.value,
          workspaceId: runner.workspaceId.value,
          work: { kind: work.kind, id: work.id },
        }
      : null;
  }
}
