import type {
  PersonReaderPort,
  PersonSummary,
} from '@identity/application/ports/person-reader.port';
import {
  holds,
  type TeamDirectoryPort,
  type TeamProfile,
} from '@identity/application/ports/team-directory.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { AnalyseTraceCommand } from '@work/application/commands/analyse-trace.command';
import type { TaskDto } from '@work/application/dto/task.dto';
import { TaskMapper } from '@work/application/mappers/task.mapper';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import type { RaiseTask } from '@work/application/services/raise-task';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { Station } from '@work/domain/entities/station.entity';
import { NotATeamMemberError } from '@work/domain/exceptions/not-a-team-member.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { Placement } from '@work/domain/services/placement';
import { LineRole } from '@work/domain/value-objects/line-role.vo';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';

const analysisNote = (trace: string, traceOf: string): string =>
  `Analyse the run trace for **${trace}** (task \`${traceOf}\`).

Write it to a file with \`spotlight trace --task ${traceOf}\` and work from there.`;

export class AnalyseTraceHandler
  implements CommandHandlerPort<AnalyseTraceCommand, TaskDto[]>
{
  constructor(
    private readonly tasks: TaskRepository,
    private readonly placements: TaskPlacementsPort,
    private readonly lines: LineRepository,
    private readonly teams: TeamDirectoryPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly raise: RaiseTask,
    private readonly people: PersonReaderPort,
  ) {}

  async execute(command: AnalyseTraceCommand): Promise<TaskDto[]> {
    try {
      return await this.analyse(command);
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async analyse(command: AnalyseTraceCommand): Promise<TaskDto[]> {
    const requester = UserId.of(command.requesterId);
    const team = await this.teams.find(TeamId.of(command.teamId));

    if (!team || !holds(team, requester)) {
      throw new NotATeamMemberError();
    }

    const line = await this.lines.withRole(team.id, LineRole.IMPROVEMENT);
    const entry = line?.entry ?? null;

    if (!line || !entry) {
      return [];
    }

    const person = await this.people.find(requester);

    const created: TaskDto[] = [];

    for (const id of command.taskIds) {
      const dto = await this.analyseOne({
        traceOf: TaskId.of(id),
        team,
        line,
        entry,
        requester,
        person,
      });

      if (dto) {
        created.push(dto);
      }
    }

    return created;
  }

  private async analyseOne(input: {
    traceOf: TaskId;
    team: TeamProfile;
    line: Line;
    entry: Station;
    requester: UserId;
    person: PersonSummary | null;
  }): Promise<TaskDto | null> {
    const traced = await this.tasks.find(input.traceOf);

    if (!traced?.workspaceId.equals(input.team.workspaceId)) {
      return null;
    }

    const standing = await this.placements.placementsAt(input.entry.id);
    const added = Task.add({
      line: input.line,
      at: input.entry.id,
      title: TaskTitle.of(`Analyse trace: ${traced.title.value}`),
      description: TaskDescription.of(
        analysisNote(traced.title.value, traced.id.value),
      ),
      rank: Placement.atTheBack(standing.map((each) => each.rank)),
      raisedBy: input.requester,
      now: this.clock.now(),
      newId: () => this.ids.generate(),
    }).assignedTo(input.requester);

    const raised = await this.raise.raise({ task: added, line: input.line });

    return TaskMapper.taskToDto(raised, input.person, input.person);
  }
}
