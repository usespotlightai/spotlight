import type { WorkspaceMemberSummaryDto } from '@identity/application/dto/member.dto';
import { ListWorkspaceMemberSummariesQuery } from '@identity/application/queries/list-workspace-member-summaries.query';
import { WorkspaceMemberSummaryResponseDto } from '@identity/presentation/http/dto/workspace-member-summary.response.dto';
import { Get, NotFoundException, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { AdminController } from '@platform/http/decorators/admin-controller.decorator';

@AdminController('workspaces')
export class WorkspaceMemberSummaryController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':workspaceId/members')
  @ApiOperation({
    operationId: 'listWorkspaceMemberSummaries',
    summary: 'List everyone in a workspace, with their role',
  })
  @ApiParam({
    name: 'workspaceId',
    example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
  })
  @ApiOkResponse({ type: WorkspaceMemberSummaryResponseDto, isArray: true })
  @ApiNotFoundResponse({
    description: 'No such workspace, or no admin token is set',
  })
  async members(
    @Param('workspaceId') workspaceId: string,
  ): Promise<WorkspaceMemberSummaryResponseDto[]> {
    const found = await this.queryBus.execute<
      ListWorkspaceMemberSummariesQuery,
      WorkspaceMemberSummaryDto[] | null
    >(new ListWorkspaceMemberSummariesQuery(workspaceId));

    if (!found) {
      throw new NotFoundException();
    }

    return found.map((member) => new WorkspaceMemberSummaryResponseDto(member));
  }
}
