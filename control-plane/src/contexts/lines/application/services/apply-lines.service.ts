import type { TeamProfile } from '@identity/application/ports/team-directory.port';
import type { StationDeletionGuardPort } from '@lines/application/ports/station-deletion-guard.port';
import type { Line } from '@lines/domain/aggregates/line.aggregate';
import { LineAlreadyExistsError } from '@lines/domain/exceptions/line-already-exists.error';
import { LineRoleTakenError } from '@lines/domain/exceptions/line-role-taken.error';
import type { LineRepository } from '@lines/domain/repositories/line.repository';
import { keyTaken } from '@lines/domain/services/line-keys';
import { rolesClaimedTwice } from '@lines/domain/services/line-roles';
import {
  createLine,
  reconcileLine,
} from '@lines/domain/services/reconcile-line';
import type { LinePlan } from '@lines/domain/value-objects/line-plan.vo';
import { TaskCounts } from '@lines/domain/value-objects/stranded-station';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export class ApplyLines {
  constructor(
    private readonly lines: LineRepository,
    private readonly guard: StationDeletionGuardPort,
    private readonly ids: IdGeneratorPort,
  ) {}

  async create(
    team: TeamProfile,
    plan: LinePlan,
    by: ChangeActor,
  ): Promise<Line> {
    const existing = await this.lines.ofTeam(team.id);

    if (keyTaken(existing, plan.key)) {
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
      taskCounts: await this.lockedTaskCounts(line),
      newId: () => this.ids.generate(),
      by,
    });

    await this.release(line.removedIn(reconciled));
    await this.lines.save(reconciled);

    return reconciled;
  }

  async delete(line: Line, by: ChangeActor): Promise<void> {
    const deleted = line.delete(await this.lockedTaskCounts(line), by);

    await this.release(line.stations.map((each) => each.id));
    await this.lines.save(deleted);
  }

  private async lockedTaskCounts(line: Line): Promise<TaskCounts> {
    return TaskCounts.of(
      await this.guard.lockedTaskCountsAt(
        { lineId: line.id, version: line.nextVersion },
        line.stations.map((each) => each.id),
      ),
    );
  }

  private async release(stationIds: readonly StationId[]): Promise<void> {
    if (stationIds.length > 0) {
      await this.guard.release(stationIds);
    }
  }

  private guardRoles(existing: readonly Line[], plan: LinePlan): void {
    const [claimed] = rolesClaimedTwice(existing, [plan]);

    if (claimed) {
      throw new LineRoleTakenError(claimed);
    }
  }
}
