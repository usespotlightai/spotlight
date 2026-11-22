import type { RunUsageReaderPort } from '@runs/application/ports/run-usage-reader.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { RunNotesDto } from '@work/application/dto/run-notes.dto';
import { NoteMapper } from '@work/application/mappers/note.mapper';
import { RunSpendMapper } from '@work/application/mappers/run-spend.mapper';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { RunReaderPort } from '@work/application/ports/run-reader.port';
import type { ReadRunNotesQuery } from '@work/application/queries/read-run-notes.query';
import {
  messageReadingOn,
  stoppableIn,
  waitingIn,
} from '@work/application/services/message-reading';
import type { RunAccess } from '@work/application/services/run-access.service';

export class ReadRunNotesHandler implements QueryHandlerPort<
  ReadRunNotesQuery,
  RunNotesDto | null
> {
  constructor(
    private readonly runs: RunReaderPort,
    private readonly usages: RunUsageReaderPort,
    private readonly access: RunAccess,
    private readonly lines: LineMapsPort,
  ) {}

  async execute(query: ReadRunNotesQuery): Promise<RunNotesDto | null> {
    try {
      const runId = RunId.of(query.runId);
      const person = UserId.of(query.viewerId);
      const found = await this.access.shownInWorkspace(
        await this.runs.notesFor(runId),
        person,
      );

      if (!found) {
        return null;
      }

      const usage = (await this.usages.forRuns([runId])).get(runId.value);
      const { audience, ...latestRun } = found.latestRun;
      const reading = await messageReadingOn(
        this.access.viewerOn(audience.teamId, person),
        this.lines,
        audience.teamId,
      );

      return {
        ...found,
        latestRun: {
          ...latestRun,
          ...waitingIn(audience, reading),
          stoppableByYou: stoppableIn(audience, reading),
        },
        createdAt: found.createdAt.toISOString(),
        notes: found.notes.map(NoteMapper.toDto),
        folded: found.folded.map(NoteMapper.foldedToDto),
        spend: usage ? RunSpendMapper.toDto(usage) : null,
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
