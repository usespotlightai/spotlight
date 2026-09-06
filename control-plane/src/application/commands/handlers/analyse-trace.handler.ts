import type { AnalyseTraceCommand } from '@application/commands/analyse-trace.command';
import type { TaskDto } from '@application/dto/task.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { TaskMapper } from '@application/mappers/task.mapper';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type {
  PersonReaderPort,
  PersonSummary,
} from '@application/ports/person-reader.port';
import type { RaiseTask } from '@application/services/raise-task';
import { Task } from '@domain/aggregates/task.aggregate';
import type { Team } from '@domain/aggregates/team.aggregate';
import { NotATeamMemberError } from '@domain/exceptions/not-a-team-member.error';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { BUILT_IN_ANALYSIS } from '@domain/services/built-in-stations';
import { Placement } from '@domain/services/placement';
import type { Repository } from '@domain/value-objects/repository.vo';
import { TaskDescription } from '@domain/value-objects/task-description.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export class AnalyseTraceHandler
  implements CommandHandlerPort<AnalyseTraceCommand, TaskDto[]>
{
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: AssemblyLineRepository,
    private readonly teams: TeamRepository,
    private readonly configurations: TeamConfigurationRepository,
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

    if (!team?.holds(requester)) {
      throw new NotATeamMemberError();
    }

    const configured = await this.configurations.findFor(team.id);
    const repository = configured?.repository ?? null;
    const person = await this.people.find(requester);

    const created: TaskDto[] = [];

    for (const id of command.taskIds) {
      const dto = await this.analyseOne({
        traceOf: TaskId.of(id),
        team,
        requester,
        person,
        repository,
      });

      if (dto) {
        created.push(dto);
      }
    }

    return created;
  }

  private async analyseOne(input: {
    traceOf: TaskId;
    team: Team;
    requester: UserId;
    person: PersonSummary | null;
    repository: Repository | null;
  }): Promise<TaskDto | null> {
    const traced = await this.tasks.find(input.traceOf);

    // Only a trace of this team's own work, and only one still on a line.
    if (!traced?.workspaceId.equals(input.team.workspaceId)) {
      return null;
    }

    const line = await this.lines.holding(traced.stationId);
    const triage = line?.entry ?? null;

    if (!line || !triage) {
      return null;
    }

    const analysis = (line.analysis ?? BUILT_IN_ANALYSIS).render({
      trace: traced.title.value,
      task: traced.id.value,
    });

    const standing = await this.tasks.placementsAt(triage.id);
    const added = Task.add({
      workspaceId: line.workspaceId,
      stationId: triage.id,
      title: TaskTitle.of(analysis.title),
      description: TaskDescription.of(analysis.note),
      rank: Placement.atTheBack(standing),
      raisedBy: input.requester,
      now: this.clock.now(),
      newId: () => this.ids.generate(),
      repository: input.repository,
    }).assignedTo(input.requester);

    const raised = await this.raise.raise({ task: added, line });

    return TaskMapper.taskToDto(raised, input.person, input.person);
  }
}
