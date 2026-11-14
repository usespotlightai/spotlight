import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { WorkAccess } from '@work/application/services/work-access.service';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskTakenError } from '@work/domain/exceptions/task-taken.error';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import {
  ConversationAudience,
  type ConversationStanding,
} from '@work/domain/services/conversation-audience';
import { ConversationId } from '@work/domain/value-objects/conversation-id.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import type { TeamStanding } from '@work/domain/value-objects/team-standing.vo';

export interface Conversing {
  readonly item: ConversationId;
  readonly task: Task;
  readonly standing: ConversationStanding;
}

export interface ActedOnConversation extends Conversing {
  readonly line: LineMap;
  readonly members: TeamMembers;
}

interface OnTeam {
  readonly line: LineMap;
  readonly members: TeamMembers;
  readonly standing: TeamStanding;
  readonly joined: boolean;
}

interface Seen extends Conversing {
  readonly team: OnTeam | null;
}

export class ConversationLoader {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly lines: LineMapsPort,
    private readonly access: WorkAccess,
  ) {}

  async putTo(itemId: string, them: string): Promise<ActedOnConversation> {
    const { item, task, standing, team } = await this.seen(itemId, them);
    const unknown = () => new UnknownTaskError(task.id.value);

    if (!team) {
      throw unknown();
    }

    team.standing.assertActsOnTasks(unknown);

    if (!ConversationAudience.answers(standing)) {
      throw new TaskTakenError(task.id.value);
    }

    return { item, task, standing, line: team.line, members: team.members };
  }

  async seenBy(itemId: string, them: string): Promise<Conversing> {
    const { item, task, standing } = await this.seen(itemId, them);

    return { item, task, standing };
  }

  private async seen(itemId: string, them: string): Promise<Seen> {
    const item = ConversationId.parse(itemId);
    const person = UserId.of(them);
    const task = await this.tasks.find(item.taskId);
    const line = task ? await this.lines.findByStation(task.stationId) : null;
    const team = line ? await this.teamOf(line, person) : null;
    const standing = task?.conversationStandingOf({
      person,
      onTeam: team?.joined ?? false,
    });

    if (!task || !standing) {
      throw new UnknownTaskError(item.taskId.value);
    }

    return { item, task, standing, team };
  }

  private async teamOf(line: LineMap, person: UserId): Promise<OnTeam> {
    const standing = await this.access.standingOn(line.teamId, person);
    const members = await this.access.membersOf(line.teamId);
    const joined = await this.access.joinsTeam(line.teamId, person);

    return { line, standing, joined, members: members ?? TeamMembers.of([]) };
  }
}
