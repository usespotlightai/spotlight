import type { WorkspaceSummaryDto } from '@identity/application/dto/workspace-summary.dto';
import { ListWorkspaceSummariesQuery } from '@identity/application/queries/list-workspace-summaries.query';
import { ReadWorkspaceSummaryQuery } from '@identity/application/queries/read-workspace-summary.query';
import {
  WorkspaceSummaryPageResponseDto,
  WorkspaceSummaryResponseDto,
} from '@identity/presentation/http/dto/workspace-summary.response.dto';
import { Get, NotFoundException, Param, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { AdminController } from '@platform/http/decorators/admin-controller.decorator';
import { isoTimeOf } from '@platform/http/iso-time';
import { pageLimitOf } from '@platform/http/page-limit';
import type { Page } from '@shared-kernel/application/dto/page.dto';
import {
  LONGEST_PAGE,
  PAGE_LIMIT,
} from '@shared-kernel/application/dto/page.dto';

const WORKSPACE = ApiParam({
  name: 'workspaceId',
  example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
});

const NOT_FOUND = ApiNotFoundResponse({
  description: 'No such workspace, or no admin token is set',
});

@AdminController('workspaces')
export class WorkspaceSummaryController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    operationId: 'listWorkspaceSummaries',
    summary: 'List every workspace of this Spotlight, oldest first',
  })
  @ApiQuery({
    name: 'after',
    required: false,
    type: String,
    description: 'The `next` cursor of the page before',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: `At most this many, ${PAGE_LIMIT} by default, up to ${LONGEST_PAGE}`,
  })
  @ApiQuery({
    name: 'since',
    required: false,
    type: String,
    example: '2026-09-01T00:00:00Z',
    description:
      'Only the workspaces created at or after this time, as an ISO 8601 time',
  })
  @ApiOkResponse({ type: WorkspaceSummaryPageResponseDto })
  @ApiBadRequestResponse({
    description:
      'A page limit that is not a whole number above 0, or a since that is not an ISO 8601 time',
  })
  @ApiUnprocessableEntityResponse({
    description: 'A page cursor that this list did not give',
  })
  @ApiNotFoundResponse({ description: 'No admin token is set' })
  async list(
    @Query('after') after: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('since') since: string | undefined,
  ): Promise<WorkspaceSummaryPageResponseDto> {
    const page = await this.queryBus.execute<
      ListWorkspaceSummariesQuery,
      Page<WorkspaceSummaryDto>
    >(
      new ListWorkspaceSummariesQuery(
        after !== undefined && after !== '' ? after : null,
        pageLimitOf(limit),
        since !== undefined && since !== '' ? isoTimeOf('since', since) : null,
      ),
    );

    return new WorkspaceSummaryPageResponseDto(page);
  }

  @Get(':workspaceId')
  @ApiOperation({
    operationId: 'readWorkspaceSummary',
    summary: 'Read one workspace, with its member count',
  })
  @WORKSPACE
  @ApiOkResponse({ type: WorkspaceSummaryResponseDto })
  @NOT_FOUND
  async read(
    @Param('workspaceId') workspaceId: string,
  ): Promise<WorkspaceSummaryResponseDto> {
    const found = await this.queryBus.execute<
      ReadWorkspaceSummaryQuery,
      WorkspaceSummaryDto | null
    >(new ReadWorkspaceSummaryQuery(workspaceId));

    if (!found) {
      throw new NotFoundException();
    }

    return new WorkspaceSummaryResponseDto(found);
  }
}
