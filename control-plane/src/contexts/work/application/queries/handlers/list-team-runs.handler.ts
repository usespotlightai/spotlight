import { mapPage, type Page } from '@shared-kernel/application/dto/page.dto';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { TeamRunDto } from '@work/application/dto/task-run.dto';
import { TaskRunMapper } from '@work/application/mappers/task-run.mapper';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { RunReaderPort } from '@work/application/ports/run-reader.port';
import type {
  ListTeamRunsQuery,
  ReadTeamRunQuery,
} from '@work/application/queries/list-team-runs.query';
import { messageReadingOn } from '@work/application/services/message-reading';
import type { RunAccess } from '@work/application/services/run-access.service';

export class ListTeamRunsHandler implements QueryHandlerPort<
  ListTeamRunsQuery,
  Page<TeamRunDto>
> {
  constructor(
    private readonly runs: RunReaderPort,
    private readonly access: RunAccess,
    private readonly lines: LineMapsPort,
  ) {}

  async execute(query: ListTeamRunsQuery): Promise<Page<TeamRunDto>> {
    try {
      const teamId = TeamId.of(query.teamId);
      const person = UserId.of(query.viewerId);

      if (!(await this.access.seesTeamRuns(teamId, person))) {
        return { items: [], next: null };
      }

      const found = await this.runs.listForTeam(teamId, query.page);
      const reading = await messageReadingOn(
        this.access.viewerOn(teamId, person),
        this.lines,
        teamId,
      );

      return mapPage(found, (each) =>
        TaskRunMapper.teamSummaryToDto(each, reading),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}

export class ReadTeamRunHandler implements QueryHandlerPort<
  ReadTeamRunQuery,
  TeamRunDto | null
> {
  constructor(
    private readonly runs: RunReaderPort,
    private readonly access: RunAccess,
    private readonly lines: LineMapsPort,
  ) {}

  async execute(query: ReadTeamRunQuery): Promise<TeamRunDto | null> {
    try {
      const teamId = TeamId.of(query.teamId);
      const person = UserId.of(query.viewerId);

      if (!(await this.access.seesTeamRuns(teamId, person))) {
        return null;
      }

      const found = await this.runs.findForTeam(teamId, RunId.of(query.runId));

      return found
        ? TaskRunMapper.teamSummaryToDto(
            found,
            await messageReadingOn(
              this.access.viewerOn(teamId, person),
              this.lines,
              teamId,
            ),
          )
        : null;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
