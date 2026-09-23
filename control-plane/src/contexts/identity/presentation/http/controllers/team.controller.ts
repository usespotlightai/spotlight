import type { MemberDto } from '@identity/application/dto/member.dto';
import { ListMembersQuery } from '@identity/application/queries/list-members.query';
import { MemberResponseDto } from '@identity/presentation/http/dto/member.response.dto';
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';

@ApiTags('teams')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('teams/:teamId')
export class TeamController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('members')
  @ApiOperation({
    operationId: 'listMembers',
    summary: 'List the team’s members, what each is, and what may be set',
  })
  @ApiOkResponse({ type: MemberResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  async members(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MemberResponseDto[]> {
    const found = await this.queryBus.execute<
      ListMembersQuery,
      MemberDto[] | null
    >(new ListMembersQuery(teamId, user.id));

    if (!found) {
      throw new NotFoundException();
    }

    return found;
  }
}
