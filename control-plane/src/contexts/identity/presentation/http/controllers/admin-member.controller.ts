import type { WorkspaceMemberDto } from '@identity/application/dto/member.dto';
import { ListDirectoryMembersQuery } from '@identity/application/queries/list-directory-members.query';
import { AdminMemberResponseDto } from '@identity/presentation/http/dto/admin-member.response.dto';
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminOnly } from '@platform/http/decorators/admin-only.decorator';
import { ADMIN } from '@platform/http/routes';

@ApiTags('admin')
@ApiUnauthorizedResponse({
  description:
    'The request does not have the admin token (SPOTLIGHT_ADMIN_TOKEN) as its bearer token',
})
@AdminOnly()
@Controller(`${ADMIN}/workspaces`)
export class AdminMemberController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':workspaceId/members')
  @ApiOperation({
    operationId: 'listDirectoryMembers',
    summary: 'List everyone in a workspace, with their role',
  })
  @ApiParam({
    name: 'workspaceId',
    example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
  })
  @ApiOkResponse({ type: AdminMemberResponseDto, isArray: true })
  @ApiNotFoundResponse({
    description: 'No such workspace, or no admin token is set',
  })
  async members(
    @Param('workspaceId') workspaceId: string,
  ): Promise<AdminMemberResponseDto[]> {
    const found = await this.queryBus.execute<
      ListDirectoryMembersQuery,
      | Pick<
          WorkspaceMemberDto,
          'id' | 'email' | 'name' | 'role' | 'joinedAt'
        >[]
      | null
    >(new ListDirectoryMembersQuery(workspaceId));

    if (!found) {
      throw new NotFoundException();
    }

    return found.map((member) => new AdminMemberResponseDto(member));
  }
}
