import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { LineReaderPort } from '@application/ports/line-reader.port';
import { linePath } from '@domain/aggregates/team-configuration.aggregate';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { reconcileLine } from '@domain/services/reconcile-line';
import type { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';

/**
 * Makes a workspace's lines say what its files say.
 *
 * A line is found by key and reconciled rather than replaced, so a station
 * that is still described is still the same station and the tasks standing
 * at it never move. A plan that would strand somebody's work is refused, and
 * the refusal is written down as a problem with the file: the line that was
 * already running goes on running, and a person is told which stations still
 * have tasks at them.
 *
 * A line the files do not mention is left alone. Configuration says what a
 * workspace has, not what it may not have: this reads files, and deleting a
 * line is not something a missing file should quietly do.
 */
export class ApplyLines {
  constructor(
    private readonly lines: AssemblyLineRepository,
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

    for (const plan of plans) {
      const line = standing.find((each) => each.key.equals(plan.key));

      // A file describing a line nobody opened is not an error, but it is
      // not something to guess at either: a line is opened with a team.
      if (!line) {
        found.push(
          ConfigurationProblem.of({
            path: linePath(plan.key.value),
            at: 'key',
            reason: 'describes a line this workspace does not have',
          }),
        );
        continue;
      }

      const reconciled = reconcileLine({
        standing: line,
        plan,
        tasksStanding: await this.counted(line.stations.map((each) => each.id)),
        newId: () => this.ids.generate(),
      });

      if (!reconciled.ok) {
        found.push(
          ConfigurationProblem.of({
            path: linePath(plan.key.value),
            at: 'stations',
            reason: `would remove ${reconciled.stranded
              .map((each) => `${each.name} (${each.tasks} standing there)`)
              .join(', ')}, so nothing here was changed`,
          }),
        );
        continue;
      }

      await this.lines.save(reconciled.line);
    }

    return found;
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
