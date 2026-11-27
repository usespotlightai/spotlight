import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { NoteDto } from '@work/application/dto/inbox.dto';
import { NoteMapper } from '@work/application/mappers/note.mapper';
import type {
  MovedNote,
  RunReaderPort,
} from '@work/application/ports/run-reader.port';
import type { ListTaskMovesQuery } from '@work/application/queries/list-task-moves.query';
import type { RunAccess } from '@work/application/services/run-access.service';
import { NoteMove } from '@work/domain/value-objects/note-move.vo';

const shownOnTask = (moved: MovedNote): boolean =>
  NoteMove.of(StationId.of(moved.move.to), moved.move.by).madeOutsideARun;

export class ListTaskMovesHandler implements QueryHandlerPort<
  ListTaskMovesQuery,
  NoteDto[] | null
> {
  constructor(
    private readonly runs: RunReaderPort,
    private readonly access: RunAccess,
  ) {}

  async execute(query: ListTaskMovesQuery): Promise<NoteDto[] | null> {
    try {
      const found = await this.access.shownInWorkspace(
        await this.runs.taskMoves(TaskId.of(query.taskId)),
        UserId.of(query.viewerId),
      );

      return (
        found &&
        found.filter(shownOnTask).map((each) => NoteMapper.toDto(each.note))
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
