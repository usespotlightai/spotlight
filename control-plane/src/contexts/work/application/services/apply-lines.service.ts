import type {
  TeamDirectoryPort,
  TeamProfile,
} from '@identity/application/ports/team-directory.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { LineConfigReaderPort } from '@work/application/ports/line-config-reader.port';
import type { StationTalliesPort } from '@work/application/ports/station-tallies.port';
import { LineProblems } from '@work/application/rendering/line-problems';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import { rolesClaimedTwice } from '@work/domain/services/line-roles';
import { openLine, reconcileLine } from '@work/domain/services/reconcile-line';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import type { LinePlan } from '@work/domain/value-objects/line-plan.vo';

interface AppliedLines {
  readonly plans: readonly LinePlan[];
  readonly problems: readonly ConfigurationProblem[];
}

export class ApplyLines {
  constructor(
    private readonly lines: LineRepository,
    private readonly teams: TeamDirectoryPort,
    private readonly tallies: StationTalliesPort,
    private readonly reader: LineConfigReaderPort,
    private readonly ids: IdGeneratorPort,
    private readonly transaction: TransactionPort,
  ) {}

  async apply(
    teamId: TeamId,
    files: readonly ConfigurationFile[],
  ): Promise<AppliedLines> {
    const { plans, problems } = this.reader.read(files);
    const standing = await this.lines.ofTeam(teamId);
    const team = await this.teams.find(teamId);

    const claimedTwice = rolesClaimedTwice(standing, plans);
    const found = [
      ...problems,
      ...claimedTwice.map((claim) =>
        LineProblems.roleClaimedTwice(this.reader.definedAt(claim.line), claim),
      ),
    ];

    for (const plan of plans) {
      if (claimedTwice.some((each) => each.line.equals(plan.key))) {
        continue;
      }

      const line = standing.find((each) => each.key.equals(plan.key));

      found.push(
        ...(line
          ? await this.reconcile(line, plan)
          : await this.open(plan, team)),
      );
    }

    return { plans, problems: found };
  }

  async plan(
    teamId: TeamId,
    files: readonly ConfigurationFile[],
  ): Promise<AppliedLines> {
    const { plans, problems } = this.reader.read(files);
    const standing = await this.lines.ofTeam(teamId);
    const team = await this.teams.find(teamId);

    const claimedTwice = rolesClaimedTwice(standing, plans);
    const found = [
      ...problems,
      ...claimedTwice.map((claim) =>
        LineProblems.roleClaimedTwice(this.reader.definedAt(claim.line), claim),
      ),
    ];

    for (const plan of plans) {
      if (claimedTwice.some((each) => each.line.equals(plan.key))) {
        continue;
      }

      const line = standing.find((each) => each.key.equals(plan.key));

      if (!line) {
        if (!team) {
          found.push(
            LineProblems.nowhereToOpen(this.reader.definedAt(plan.key)),
          );
        }
        continue;
      }

      try {
        const reconciled = reconcileLine({
          standing: line,
          plan,
          tasksStanding: await this.tallies.standingAt(
            line.stations.map((each) => each.id),
          ),
          newId: () => this.ids.generate(),
        });

        if (!reconciled.ok) {
          found.push(
            LineProblems.stranded(
              this.reader.definedAt(plan.key),
              reconciled.stranded,
            ),
          );
        }
      } catch (error) {
        found.push(
          LineProblems.unapplied(this.reader.definedAt(plan.key), error),
        );
      }
    }

    return { plans, problems: found };
  }

  private async reconcile(
    line: Line,
    plan: LinePlan,
  ): Promise<readonly ConfigurationProblem[]> {
    try {
      return await this.transaction.run(async () => {
        const reconciled = reconcileLine({
          standing: line,
          plan,
          tasksStanding: await this.tallies.lockedStandingAt(
            line.stations.map((each) => each.id),
          ),
          newId: () => this.ids.generate(),
        });

        if (!reconciled.ok) {
          return [
            LineProblems.stranded(
              this.reader.definedAt(plan.key),
              reconciled.stranded,
            ),
          ];
        }

        await this.lines.save(reconciled.line);

        return [];
      });
    } catch (error) {
      return [LineProblems.unapplied(this.reader.definedAt(plan.key), error)];
    }
  }

  private async open(
    plan: LinePlan,
    team: TeamProfile | null,
  ): Promise<readonly ConfigurationProblem[]> {
    if (!team) {
      return [LineProblems.nowhereToOpen(this.reader.definedAt(plan.key))];
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

      return [];
    } catch (error) {
      return [LineProblems.unapplied(this.reader.definedAt(plan.key), error)];
    }
  }
}
