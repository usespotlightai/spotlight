import type {
  TeamDirectoryPort,
  TeamProfile,
} from '@identity/application/ports/team-directory.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { StationTalliesPort } from '@work/application/ports/station-tallies.port';
import {
  LineProblems,
  lineAt,
} from '@work/application/rendering/line-problems';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import { rolesClaimedTwice } from '@work/domain/services/line-roles';
import { openLine, reconcileLine } from '@work/domain/services/reconcile-line';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import type { LinePlan } from '@work/domain/value-objects/line-plan.vo';

type Applying =
  | { readonly ok: true; readonly line: Line }
  | { readonly ok: false; readonly problem: ConfigurationProblem };

export interface AppliedLines {
  readonly lines: readonly Line[];
  readonly problems: readonly ConfigurationProblem[];
}

export class ApplyLines {
  constructor(
    private readonly lines: LineRepository,
    private readonly teams: TeamDirectoryPort,
    private readonly tallies: StationTalliesPort,
    private readonly ids: IdGeneratorPort,
    private readonly transaction: TransactionPort,
  ) {}

  async apply(
    teamId: TeamId,
    plans: readonly LinePlan[],
  ): Promise<AppliedLines> {
    const standing = await this.lines.ofTeam(teamId);
    const team = await this.teams.find(teamId);

    const claimedTwice = rolesClaimedTwice(standing, plans);
    const problems = claimedTwice.map((claim) =>
      LineProblems.roleClaimedTwice(lineAt(claim.line.value), claim),
    );
    const lines: Line[] = [];

    for (const plan of plans) {
      if (claimedTwice.some((each) => each.line.equals(plan.key))) {
        continue;
      }

      const line = standing.find((each) => each.key.equals(plan.key));

      const applied = line
        ? await this.reconcile(line, plan)
        : await this.open(plan, team);

      if (applied.ok) {
        lines.push(applied.line);
      } else {
        problems.push(applied.problem);
      }
    }

    return { lines, problems };
  }

  private async reconcile(line: Line, plan: LinePlan): Promise<Applying> {
    try {
      return await this.transaction.run(async (): Promise<Applying> => {
        const reconciled = reconcileLine({
          standing: line,
          plan,
          tasksStanding: await this.tallies.lockedStandingAt(
            line.stations.map((each) => each.id),
          ),
          newId: () => this.ids.generate(),
        });

        if (!reconciled.ok) {
          return {
            ok: false,
            problem: LineProblems.stranded(
              lineAt(plan.key.value),
              reconciled.stranded,
            ),
          };
        }

        await this.lines.save(reconciled.line);

        return { ok: true, line: reconciled.line };
      });
    } catch (error) {
      return {
        ok: false,
        problem: LineProblems.unapplied(lineAt(plan.key.value), error),
      };
    }
  }

  private async open(
    plan: LinePlan,
    team: TeamProfile | null,
  ): Promise<Applying> {
    if (!team) {
      return {
        ok: false,
        problem: LineProblems.nowhereToOpen(lineAt(plan.key.value)),
      };
    }

    try {
      const opened = openLine({
        identity: {
          id: LineId.of(this.ids.generate()),
          workspaceId: team.workspaceId,
          teamId: team.id,
        },
        plan,
        newId: () => this.ids.generate(),
      });

      await this.transaction.run(() => this.lines.add(opened));

      return { ok: true, line: opened };
    } catch (error) {
      return {
        ok: false,
        problem: LineProblems.unapplied(lineAt(plan.key.value), error),
      };
    }
  }
}
