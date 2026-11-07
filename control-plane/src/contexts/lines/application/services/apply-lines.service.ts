import type { TeamProfile } from '@identity/application/ports/team-directory.port';
import { heldLineOf } from '@lines/application/mappers/held-line.mapper';
import type { StationHoldersPort } from '@lines/application/ports/station-holders.port';
import type { Line } from '@lines/domain/aggregates/line.aggregate';
import { LineAlreadyExistsError } from '@lines/domain/exceptions/line-already-exists.error';
import { LineRoleTakenError } from '@lines/domain/exceptions/line-role-taken.error';
import { StationNotEmptyError } from '@lines/domain/exceptions/station-not-empty.error';
import type { LineRepository } from '@lines/domain/repositories/line.repository';
import { rolesClaimedTwice } from '@lines/domain/services/line-roles';
import {
  createLine,
  reconcileLine,
} from '@lines/domain/services/reconcile-line';
import type { LinePlan } from '@lines/domain/value-objects/line-plan.vo';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export class ApplyLines {
  constructor(
    private readonly lines: LineRepository,
    private readonly holders: StationHoldersPort,
    private readonly ids: IdGeneratorPort,
  ) {}

  async create(
    team: TeamProfile,
    plan: LinePlan,
    by: ChangeActor,
  ): Promise<Line> {
    const existing = await this.lines.ofTeam(team.id);

    if (existing.some((each) => each.key.equals(plan.key))) {
      throw new LineAlreadyExistsError(plan.key.value);
    }

    this.guardRoles(existing, plan);

    const created = createLine({
      identity: {
        id: LineId.of(this.ids.generate()),
        workspaceId: team.workspaceId,
        teamId: team.id,
      },
      plan,
      newId: () => this.ids.generate(),
      by,
    });

    await this.lines.add(created);
    await this.holders.hold(heldLineOf(created));

    return created;
  }

  async reconcile(line: Line, plan: LinePlan, by: ChangeActor): Promise<Line> {
    this.guardRoles(
      (await this.lines.ofTeam(line.teamId)).filter(
        (each) => !each.equals(line),
      ),
      plan,
    );

    const reconciled = reconcileLine({
      existing: line,
      plan,
      taskCounts: await this.holders.lockedTaskCountsAt(
        line.stations.map((each) => each.id),
      ),
      newId: () => this.ids.generate(),
      by,
    });

    await this.release(line.removedIn(reconciled));
    await this.lines.save(reconciled);
    await this.holders.hold(heldLineOf(reconciled));

    return reconciled;
  }

  async delete(line: Line, by: ChangeActor): Promise<void> {
    const stationIds = line.stations.map((each) => each.id);
    const deleted = line.delete(
      await this.holders.lockedTaskCountsAt(stationIds),
      by,
    );

    await this.release(stationIds);
    await this.lines.save(deleted);
  }

  private async release(stationIds: readonly StationId[]): Promise<void> {
    if (
      stationIds.length > 0 &&
      (await this.holders.release(stationIds)) === 'held'
    ) {
      throw new StationNotEmptyError(stationIds.map((each) => each.value));
    }
  }

  private guardRoles(existing: readonly Line[], plan: LinePlan): void {
    const [claimed] = rolesClaimedTwice(existing, [plan]);

    if (claimed) {
      throw new LineRoleTakenError(claimed);
    }
  }
}
