import { heldLineOf } from '@lines/application/mappers/held-line.mapper';
import type { StationHoldersPort } from '@lines/application/ports/station-holders.port';
import { Line } from '@lines/domain/aggregates/line.aggregate';
import { LineAlreadyExistsError } from '@lines/domain/exceptions/line-already-exists.error';
import type { LineRepository } from '@lines/domain/repositories/line.repository';
import { BUILT_IN_LINES } from '@lines/domain/services/built-in-lines';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const SEED_LINES = 'lines.seed-lines';

export interface SeededTeam {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
}

export class SeedLines {
  constructor(
    private readonly lines: LineRepository,
    private readonly holders: StationHoldersPort,
    private readonly transaction: TransactionPort,
    private readonly ids: IdGeneratorPort,
    private readonly harness: HarnessId,
  ) {}

  async seed(team: SeededTeam): Promise<void> {
    const existing = await this.lines.ofTeam(team.teamId);

    for (const opening of BUILT_IN_LINES) {
      if (existing.some((each) => each.key.equals(opening.key))) {
        continue;
      }

      try {
        const created = Line.create({
          workspaceId: team.workspaceId,
          teamId: team.teamId,
          line: opening,
          harness: this.harness,
          newId: () => this.ids.generate(),
          by: ChangeActor.spotlight(team.workspaceId),
        });

        await this.transaction.inTransaction(async () => {
          await this.lines.add(created);
          await this.holders.hold(heldLineOf(created));
        });
      } catch (error) {
        if (!(error instanceof LineAlreadyExistsError)) {
          throw error;
        }
      }
    }
  }
}
