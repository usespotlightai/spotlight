import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { TaskDto } from '@work/application/dto/task.dto';
import { TaskMapper } from '@work/application/mappers/task.mapper';
import type { TaskReaderPort } from '@work/application/ports/task-reader.port';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';

export const taskAsRead = async (
  reader: TaskReaderPort,
  at: { readonly teamId: string },
  taskId: TaskId,
): Promise<TaskDto> => {
  const found = await reader.findInTeam(TeamId.of(at.teamId), taskId);

  if (!found) {
    throw new UnknownTaskError(taskId.value);
  }

  return TaskMapper.summaryToDto(found);
};
