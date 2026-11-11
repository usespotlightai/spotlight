import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { LineDto } from '@lines/application/dto/line.dto';
import { LineMapper } from '@lines/application/mappers/line.mapper';
import type { LineReaderPort } from '@lines/application/ports/line-reader.port';
import type { ListLinesQuery } from '@lines/application/queries/list-lines.query';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ListLinesHandler implements QueryHandlerPort<
  ListLinesQuery,
  LineDto[] | null
> {
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly lines: LineReaderPort,
  ) {}

  async execute(query: ListLinesQuery): Promise<LineDto[] | null> {
    try {
      const teamId = TeamId.of(query.teamId);

      if (
        !(await this.access.inWorkspaceOfTeam(
          teamId,
          UserId.of(query.viewerId),
        ))
      ) {
        return null;
      }

      return (await this.lines.ofTeam(teamId)).map((each) =>
        LineMapper.detailToDto(each),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
