import type { TeamProfile } from '@identity/application/ports/team-directory.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import type { StationTalliesPort } from '@work/application/ports/station-tallies.port';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import { LineAlreadyOpenedError } from '@work/domain/exceptions/line-already-opened.error';
import { LineInUseError } from '@work/domain/exceptions/line-in-use.error';
import { LineRoleTakenError } from '@work/domain/exceptions/line-role-taken.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import { rolesClaimedTwice } from '@work/domain/services/line-roles';
import { openLine, reconcileLine } from '@work/domain/services/reconcile-line';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import type { LinePlan } from '@work/domain/value-objects/line-plan.vo';

export class ApplyLines {
  constructor(
    private readonly lines: LineRepository,
    private readonly tallies: StationTalliesPort,
    private readonly ids: IdGeneratorPort,
  ) {}

  async open(
    team: TeamProfile,
    plan: LinePlan,
    by: Attribution,
  ): Promise<Line> {
    const standing = await this.lines.ofTeam(team.id);

    if (standing.some((each) => each.key.equals(plan.key))) {
      throw new LineAlreadyOpenedError(plan.key.value);
    }

    this.guardRoles(standing, plan);

    const opened = openLine({
      identity: {
        id: LineId.of(this.ids.generate()),
        workspaceId: team.workspaceId,
        teamId: team.id,
      },
      plan,
      newId: () => this.ids.generate(),
      by,
    });

    await this.lines.add(opened);

    return opened;
  }

  async reconcile(line: Line, plan: LinePlan, by: Attribution): Promise<Line> {
    this.guardRoles(
      (await this.lines.ofTeam(line.teamId)).filter(
        (each) => !each.equals(line),
      ),
      plan,
    );

    const reconciled = reconcileLine({
      standing: line,
      plan,
      tasksStanding: await this.tallies.lockedStandingAt(
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

  private guardRoles(standing: readonly Line[], plan: LinePlan): void {
    const [claimed] = rolesClaimedTwice(standing, [plan]);

    if (claimed) {
      throw new LineRoleTakenError(claimed);
    }
  }
}
