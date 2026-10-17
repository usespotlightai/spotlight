import type { TeamProfile } from '@identity/application/ports/team-directory.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import type { StationTalliesPort } from '@work/application/ports/station-tallies.port';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import { LineAlreadyExistsError } from '@work/domain/exceptions/line-already-exists.error';
import { LineInUseError } from '@work/domain/exceptions/line-in-use.error';
import { LineRoleTakenError } from '@work/domain/exceptions/line-role-taken.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import { rolesClaimedTwice } from '@work/domain/services/line-roles';
import {
  createLine,
  reconcileLine,
} from '@work/domain/services/reconcile-line';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import type { LinePlan } from '@work/domain/value-objects/line-plan.vo';

export class ApplyLines {
  constructor(
    private readonly lines: LineRepository,
    private readonly tallies: StationTalliesPort,
    private readonly ids: IdGeneratorPort,
  ) {}

  async create(
    team: TeamProfile,
    plan: LinePlan,
    by: Attribution,
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

    return created;
  }

  async reconcile(line: Line, plan: LinePlan, by: Attribution): Promise<Line> {
    this.guardRoles(
      (await this.lines.ofTeam(line.teamId)).filter(
        (each) => !each.equals(line),
      ),
      plan,
    );

    const reconciled = reconcileLine({
      existing: line,
      plan,
      taskCounts: await this.tallies.lockedTaskCountsAt(
        line.stations.map((each) => each.id),
      ),
      newId: () => this.ids.generate(),
      by,
    });

    if (!reconciled.ok) {
      throw new LineInUseError(line.key.value, reconciled.stranded);
    }

    await this.lines.save(reconciled.line);

    return reconciled.line;
  }

  private guardRoles(existing: readonly Line[], plan: LinePlan): void {
    const [claimed] = rolesClaimedTwice(existing, [plan]);

    if (claimed) {
      throw new LineRoleTakenError(claimed);
    }
  }
}
