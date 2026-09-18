import { AcceptInviteCommand } from '@identity/application/commands/accept-invite.command';
import { InviteToTeamCommand } from '@identity/application/commands/invite-to-team.command';
import { RevokeInviteCommand } from '@identity/application/commands/revoke-invite.command';
import type {
  InviteDto,
  InviteOfferDto,
  JoinedTeamDto,
} from '@identity/application/dto/invite.dto';
import { ListInvitesQuery } from '@identity/application/queries/list-invites.query';
import { ReadInviteQuery } from '@identity/application/queries/read-invite.query';
import { InviteToTeamRequestDto } from '@identity/presentation/http/dto/invite.request.dto';
import {
  InviteOfferResponseDto,
  InviteResponseDto,
  JoinedTeamResponseDto,
} from '@identity/presentation/http/dto/invite.response.dto';
import {
  Body,
  Controller,
  Delete,
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
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AllowAnonymous } from '@platform/http/decorators/allow-anonymous.decorator';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';

@ApiTags('invites')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('teams/:teamId/invites')
export class TeamInviteController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listInvites',
    summary: 'List the invitations this team is still waiting on',
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiOkResponse({ type: InviteResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  async list(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InviteResponseDto[]> {
    const found = await this.queryBus.execute<
      ListInvitesQuery,
      InviteDto[] | null
    >(new ListInvitesQuery(teamId, user.id));

    if (!found) {
      throw new NotFoundException();
    }

    return found;
  }

  @Post()
  @ApiOperation({
    operationId: 'inviteToTeam',
    summary: 'Invite somebody onto this team by email',
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiCreatedResponse({ type: InviteResponseDto })
  @ApiConflictResponse({ description: 'They are already on this team' })
  @ApiNotFoundResponse({
    description: 'No such team, or not yours to invite to',
  })
  async invite(
    @Param('teamId') teamId: string,
    @Body() body: InviteToTeamRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InviteResponseDto> {
    const invited = await this.commandBus.execute<
      InviteToTeamCommand,
      InviteDto | null
    >(new InviteToTeamCommand(teamId, body.email, user.id));

    if (!invited) {
      throw new NotFoundException();
    }

    return invited;
  }

  @Delete(':inviteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'revokeInvite',
    summary: 'Take an invitation back, so its link stops working',
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiParam({ name: 'inviteId' })
  @ApiNoContentResponse({ description: 'The link no longer works' })
  @ApiNotFoundResponse({ description: 'No such invitation for this caller' })
  async revoke(
    @Param('teamId') teamId: string,
    @Param('inviteId') inviteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const revoked = await this.commandBus.execute<RevokeInviteCommand, boolean>(
      new RevokeInviteCommand(teamId, inviteId, user.id),
    );

    if (!revoked) {
      throw new NotFoundException();
    }
  }
}

@ApiTags('invites')
@Controller('invites')
export class InviteController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get(':token')
  @AllowAnonymous()
  @ApiOperation({
    operationId: 'readInvite',
    summary: 'Read what an invitation link offers',
  })
  @ApiParam({ name: 'token' })
  @ApiOkResponse({ type: InviteOfferResponseDto })
  @ApiNotFoundResponse({ description: 'No invitation by that link' })
  async read(@Param('token') token: string): Promise<InviteOfferResponseDto> {
    const offer = await this.queryBus.execute<
      ReadInviteQuery,
      InviteOfferDto | null
    >(new ReadInviteQuery(token));

    if (!offer) {
      throw new NotFoundException();
    }

    return offer;
  }

  @Post(':token/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'acceptInvite',
    summary: 'Take up an invitation, joining the team it was sent for',
  })
  @ApiParam({ name: 'token' })
  @ApiOkResponse({ type: JoinedTeamResponseDto })
  @ApiUnauthorizedResponse({ description: 'No valid session' })
  @ApiForbiddenResponse({ description: 'Signed in as somebody else' })
  @ApiConflictResponse({ description: 'Already accepted, revoked or run out' })
  @ApiNotFoundResponse({ description: 'No invitation by that link' })
  async accept(
    @Param('token') token: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<JoinedTeamResponseDto> {
    const joined = await this.commandBus.execute<
      AcceptInviteCommand,
      JoinedTeamDto | null
    >(new AcceptInviteCommand(token, user.id, user.email));

    if (!joined) {
      throw new NotFoundException();
    }

    return joined;
  }
}
