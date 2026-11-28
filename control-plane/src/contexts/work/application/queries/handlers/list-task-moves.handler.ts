import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { TaskMoveDto } from '@work/application/dto/task-move.dto';
import type {
  RunReaderPort,
  TaskMoveSummary,
} from '@work/application/ports/run-reader.port';
import type { ListTaskMovesQuery } from '@work/application/queries/list-task-moves.query';
import type { RunAccess } from '@work/application/services/run-access.service';
import { NoteMove } from '@work/domain/value-objects/note-move.vo';

const shownOnTask = (summary: TaskMoveSummary): TaskMoveDto[] => {
  const move = NoteMove.rehydrate(summary.move);

  return move.madeOutsideARun
    ? [
        {
          position: summary.position,
          at: summary.at.toISOString(),
          station: summary.station,
          by: move.by,
          person: move.who ? summary.person : null,
          why: move.why,
        },
      ]
    : [];
};

export class ListTaskMovesHandler implements QueryHandlerPort<
  ListTaskMovesQuery,
  TaskMoveDto[] | null
> {
  constructor(
    private readonly runs: RunReaderPort,
    private readonly access: RunAccess,
  ) {}

  async execute(query: ListTaskMovesQuery): Promise<TaskMoveDto[] | null> {
    try {
      const found = await this.access.shownInWorkspace(
        await this.runs.taskMoves(TaskId.of(query.taskId)),
        UserId.of(query.viewerId),
      );

      return found && found.flatMap(shownOnTask);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
