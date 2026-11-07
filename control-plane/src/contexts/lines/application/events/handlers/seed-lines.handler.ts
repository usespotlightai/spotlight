import { Line } from '@lines/domain/aggregates/line.aggregate';
import { LineAlreadyExistsError } from '@lines/domain/exceptions/line-already-exists.error';
import type { LineRepository } from '@lines/domain/repositories/line.repository';
import {
  BUILT_IN_LINES,
  getsBuiltInLines,
  type TeamOrigin,
} from '@lines/domain/services/built-in-lines';
import { keyTaken } from '@lines/domain/services/line-keys';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const SEED_LINES = 'lines.seed-lines';

export interface SeededTeam {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly origin: TeamOrigin;
}

export class SeedLines {
  constructor(
    private readonly lines: LineRepository,
    private readonly ids: IdGeneratorPort,
    private readonly harness: HarnessId,
  ) {}

  async seed(team: SeededTeam): Promise<void> {
    if (!getsBuiltInLines(team.origin)) {
      return;
    }

    const existing = await this.lines.ofTeam(team.teamId);

    for (const opening of BUILT_IN_LINES) {
      if (keyTaken(existing, opening.key)) {
        continue;
      }

      try {
        await this.lines.add(
          Line.create({
            workspaceId: team.workspaceId,
            teamId: team.teamId,
            line: opening,
            harness: this.harness,
            newId: () => this.ids.generate(),
            by: ChangeActor.spotlight(team.workspaceId),
          }),
        );
      } catch (error) {
        if (!(error instanceof LineAlreadyExistsError)) {
          throw error;
        }
      }
    }
  }
}
