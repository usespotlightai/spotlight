import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { NoteDto } from '@work/application/dto/inbox.dto';
import { NoteMapper } from '@work/application/mappers/note.mapper';
import type { RunReaderPort } from '@work/application/ports/run-reader.port';
import type { ReadTaskNotesQuery } from '@work/application/queries/read-task-notes.query';
import type { RunAccess } from '@work/application/services/run-access.service';

export class ReadTaskNotesHandler implements QueryHandlerPort<
  ReadTaskNotesQuery,
  NoteDto[] | null
> {
  constructor(
    private readonly runs: RunReaderPort,
    private readonly access: RunAccess,
  ) {}

  async execute(query: ReadTaskNotesQuery): Promise<NoteDto[] | null> {
    try {
      const found = await this.access.shownInWorkspace(
        await this.runs.taskNotesBetween(
          TaskId.of(query.taskId),
          query.from,
          query.to,
        ),
        UserId.of(query.viewerId),
      );

      return found && found.map(NoteMapper.toDto);
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
