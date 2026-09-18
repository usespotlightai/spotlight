import { RenameTeamCommand } from '@identity/application/commands/rename-team.command';
import type { MemberDto } from '@identity/application/dto/member.dto';
import { ListMembersQuery } from '@identity/application/queries/list-members.query';
import { MemberResponseDto } from '@identity/presentation/http/dto/member.response.dto';
import { RenameTeamRequestDto } from '@identity/presentation/http/dto/team.request.dto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';

@ApiTags('teams')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('teams/:teamId')
export class TeamController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Patch()
  @ApiOperation({ operationId: 'renameTeam', summary: 'Rename a team' })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiNoContentResponse({ description: 'Renamed' })
  @ApiNotFoundResponse({ description: 'No such team, or not yours to rename' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async rename(
    @Param('teamId') teamId: string,
    @Body() body: RenameTeamRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const renamed = await this.commandBus.execute<RenameTeamCommand, boolean>(
      new RenameTeamCommand(teamId, body.name, user.id),
    );

    if (!renamed) {
      throw new NotFoundException();
    }
  }

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
