import { AddTeamMemberCommand } from '@identity/application/commands/add-team-member.command';
import type { MemberDto } from '@identity/application/dto/member.dto';
import { ListMembersQuery } from '@identity/application/queries/list-members.query';
import { AddTeamMemberRequestDto } from '@identity/presentation/http/dto/member.request.dto';
import { MemberResponseDto } from '@identity/presentation/http/dto/member.response.dto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
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

  @Post('members')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'addTeamMember',
    summary: 'Put somebody already in the workspace on this team',
  })
  @ApiNoContentResponse({ description: 'They are on the team now' })
  @ApiConflictResponse({ description: 'They are already on the team' })
  @ApiNotFoundResponse({
    description: 'No such team, or not yours to add people to',
  })
  @ApiUnprocessableEntityResponse({
    description: 'They are not in the workspace',
  })
  async addMember(
    @Param('teamId') teamId: string,
    @Body() body: AddTeamMemberRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const added = await this.commandBus.execute<AddTeamMemberCommand, boolean>(
      new AddTeamMemberCommand(teamId, String(body.userId ?? ''), user.id),
    );

    if (!added) {
      throw new NotFoundException();
    }
  }
}
