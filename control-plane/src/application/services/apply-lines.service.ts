import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { LineConfigReaderPort } from '@application/ports/line-config-reader.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import { LineProblems } from '@application/rendering/line-problems';
import type { Factory } from '@domain/aggregates/factory.aggregate';
import type { Line } from '@domain/aggregates/line.aggregate';
import type { FactoryRepository } from '@domain/repositories/factory.repository';
import type { LineRepository } from '@domain/repositories/line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { rolesClaimedTwice } from '@domain/services/line-roles';
import { openLine, reconcileLine } from '@domain/services/reconcile-line';
import type { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import type { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';
import { LineId } from '@domain/value-objects/line-id.vo';
import type { LinePlan } from '@domain/value-objects/line-plan.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';

interface AppliedLines {
  readonly plans: readonly LinePlan[];
  readonly problems: readonly ConfigurationProblem[];
}

export class ApplyLines {
  constructor(
    private readonly lines: LineRepository,
    private readonly factories: FactoryRepository,
    private readonly tasks: TaskRepository,
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
    const factory = await this.factories.ofTeam(teamId);

    const claimedTwice = rolesClaimedTwice(standing, plans);
    const found = [
      ...problems,
      ...claimedTwice.map(LineProblems.roleClaimedTwice),
    ];

    for (const plan of plans) {
      if (claimedTwice.some((each) => each.line.equals(plan.key))) {
        continue;
      }

      const line = standing.find((each) => each.key.equals(plan.key));

      found.push(
        ...(line
          ? await this.reconcile(line, plan)
          : await this.open(plan, factory)),
      );
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
          tasksStanding: await this.tasks.countsAt(
            line.stations.map((each) => each.id),
          ),
          newId: () => this.ids.generate(),
        });

        if (!reconciled.ok) {
          return [LineProblems.stranded(plan.key, reconciled.stranded)];
        }

        await this.lines.save(reconciled.line);

        return [];
      });
    } catch (error) {
      return [LineProblems.unapplied(plan.key, error)];
    }
  }

  private async open(
    plan: LinePlan,
    factory: Factory | null,
  ): Promise<readonly ConfigurationProblem[]> {
    if (!factory) {
      return [LineProblems.nowhereToOpen(plan.key)];
    }

    try {
      const opened = openLine({
        identity: {
          id: LineId.of(this.ids.generate()),
          workspaceId: factory.workspaceId,
          factoryId: factory.id,
        },
        plan,
        newId: () => this.ids.generate(),
      });

      await this.transaction.run(() => this.lines.add(opened));

      return [];
    } catch (error) {
      return [LineProblems.unapplied(plan.key, error)];
    }
  }
}
