import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { LineReaderPort } from '@application/ports/line-reader.port';
import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Factory } from '@domain/aggregates/factory.aggregate';
import { linePath } from '@domain/aggregates/team-configuration.aggregate';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { FactoryRepository } from '@domain/repositories/factory.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { openLine, reconcileLine } from '@domain/services/reconcile-line';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import type { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';
import type { LinePlan } from '@domain/value-objects/line-plan.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';

/**
 * Makes a team's lines say what its files say. Reconciled rather than
 * replaced, so a station still described keeps its tasks; a plan that would
 * strand work is refused and written down as a problem instead.
 *
 * A line no file mentions is left alone: deleting one is not something a
 * missing file should quietly do.
 */
export class ApplyLines {
  constructor(
    private readonly lines: AssemblyLineRepository,
    private readonly factories: FactoryRepository,
    private readonly tasks: TaskRepository,
    private readonly reader: LineReaderPort,
    private readonly ids: IdGeneratorPort,
  ) {}

  async apply(
    teamId: TeamId,
    files: readonly ConfigurationFile[],
  ): Promise<readonly ConfigurationProblem[]> {
    const { plans, problems } = this.reader.read(files);
    const found = [...problems];
    const standing = await this.lines.ofTeam(teamId);
    const factory = await this.factories.ofTeam(teamId);

    // A role names one line, so what two lines would both claim is applied to
    // neither: the files have to settle it first.
    const conflicting = this.rolesConflicting(standing, plans, found);

    for (const plan of plans) {
      if (conflicting.has(plan.key.value)) {
        continue;
      }

      const line = standing.find((each) => each.key.equals(plan.key));

      if (!line) {
        found.push(...(await this.open(plan, factory)));
        continue;
      }

      found.push(...(await this.reconcile(line, plan)));
    }

    return found;
  }

  private async reconcile(
    line: AssemblyLine,
    plan: LinePlan,
  ): Promise<readonly ConfigurationProblem[]> {
    try {
      const reconciled = reconcileLine({
        standing: line,
        plan,
        tasksStanding: await this.counted(line.stations.map((each) => each.id)),
        newId: () => this.ids.generate(),
      });

      if (!reconciled.ok) {
        return [
          ConfigurationProblem.of({
            path: linePath(plan.key.value),
            at: 'stations',
            reason: `would remove ${reconciled.stranded
              .map((each) => `${each.name} (${each.tasks} standing there)`)
              .join(', ')}, so nothing here was changed`,
          }),
        ];
      }

      await this.lines.save(reconciled.line);

      return [];
    } catch (error) {
      return [problemWith(plan, error)];
    }
  }

  private async open(
    plan: LinePlan,
    factory: Factory | null,
  ): Promise<readonly ConfigurationProblem[]> {
    // No factory is no team to open a line in.
    if (!factory) {
      return [
        ConfigurationProblem.of({
          path: linePath(plan.key.value),
          at: 'key',
          reason: 'describes a line this workspace has nowhere to open',
        }),
      ];
    }

    try {
      await this.lines.add(
        openLine({
          identity: {
            id: AssemblyLineId.of(this.ids.generate()),
            workspaceId: factory.workspaceId,
            factoryId: factory.id,
          },
          plan,
          newId: () => this.ids.generate(),
        }),
      );

      return [];
    } catch (error) {
      return [problemWith(plan, error)];
    }
  }

  /**
   * The keys of the plans that would leave two lines claiming one role. The
   * standing set a plan does not describe still counts, so a file cannot take a
   * role another line quietly keeps.
   */
  private rolesConflicting(
    standing: readonly AssemblyLine[],
    plans: readonly LinePlan[],
    found: ConfigurationProblem[],
  ): ReadonlySet<string> {
    const planned = new Set(plans.map((each) => each.key.value));
    const roleOf = new Map<string, string[]>();

    const claim = (role: string | undefined, key: string): void => {
      if (role) {
        roleOf.set(role, [...(roleOf.get(role) ?? []), key]);
      }
    };

    for (const line of standing) {
      if (!planned.has(line.key.value)) {
        claim(line.role?.value, line.key.value);
      }
    }
    for (const plan of plans) {
      claim(plan.role?.value, plan.key.value);
    }

    const conflicting = new Set<string>();

    for (const [role, keys] of roleOf) {
      if (keys.length < 2) {
        continue;
      }
      for (const key of keys.filter((each) => planned.has(each))) {
        conflicting.add(key);
        found.push(
          ConfigurationProblem.of({
            path: linePath(key),
            at: 'role',
            reason: `claims the role "${role}", which ${keys
              .filter((each) => each !== key)
              .join(', ')} already does, and a role names one line`,
          }),
        );
      }
    }

    return conflicting;
  }

  /** Asked once for the whole line rather than per station going away. */
  private async counted(
    stations: readonly StationId[],
  ): Promise<Map<string, number>> {
    const counted = new Map<string, number>();

    for (const stationId of stations) {
      counted.set(
        stationId.value,
        (await this.tasks.standingAt(stationId)).length,
      );
    }

    return counted;
  }
}

const problemWith = (plan: LinePlan, error: unknown): ConfigurationProblem =>
  ConfigurationProblem.of({
    path: linePath(plan.key.value),
    at: 'stations',
    reason: error instanceof Error ? error.message : String(error),
  });
