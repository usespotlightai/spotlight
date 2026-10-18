import { AcceptInviteCommand } from '@identity/application/commands/accept-invite.command';
import { InviteToWorkspaceCommand } from '@identity/application/commands/invite-to-workspace.command';
import { ResendInviteCommand } from '@identity/application/commands/resend-invite.command';
import { RevokeInviteCommand } from '@identity/application/commands/revoke-invite.command';
import type {
  InviteOutcomesDto,
  InvitePreviewDto,
  JoinedWorkspaceDto,
  WorkspaceInviteDto,
} from '@identity/application/dto/invite.dto';
import { ListWorkspaceInvitesQuery } from '@identity/application/queries/list-workspace-invites.query';
import { ReadInviteQuery } from '@identity/application/queries/read-invite.query';
import { InviteToWorkspaceRequestDto } from '@identity/presentation/http/dto/invite.request.dto';
import {
  InviteOutcomesResponseDto,
  InvitePreviewResponseDto,
  JoinedWorkspaceResponseDto,
  WorkspaceInviteResponseDto,
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
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { AllowAnonymous } from '@platform/http/decorators/allow-anonymous.decorator';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';

const listed = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.map(String) : [];

@ApiTags('invites')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('workspaces/:slug/invites')
export class WorkspaceInviteController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listWorkspaceInvites',
    summary: 'List the invitations this workspace is still waiting on',
  })
  @ApiParam({ name: 'slug', example: 'acme' })
  @ApiOkResponse({ type: WorkspaceInviteResponseDto, isArray: true })
  @ApiNotFoundResponse({
    description: 'No such workspace, or not yours to invite to',
  })
  async list(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WorkspaceInviteResponseDto[]> {
    const found = await this.queryBus.execute<
      ListWorkspaceInvitesQuery,
      WorkspaceInviteDto[] | null
    >(new ListWorkspaceInvitesQuery(slug, user.id));

    if (!found) {
      throw new NotFoundException();
    }

    return found;
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'inviteToWorkspace',
    summary: 'Invite people to this workspace by email, with a role and teams',
    description:
      'One invitation per address. Spotlight resends a pending or run-out invitation with a fresh link. Spotlight reports an address that is already in the workspace and sends it nothing.',
  })
  @ApiParam({ name: 'slug', example: 'acme' })
  @ApiOkResponse({ type: InviteOutcomesResponseDto })
  @ApiForbiddenResponse({ description: 'You cannot assign this role' })
  @ApiConflictResponse({ description: 'Another invitation was just sent' })
  @ApiNotFoundResponse({
    description: 'No such workspace, or not yours to invite to',
  })
  @ApiUnprocessableEntityResponse({
    description: 'An address, role or team that is not valid',
  })
  async invite(
    @Param('slug') slug: string,
    @Body() body: InviteToWorkspaceRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InviteOutcomesResponseDto> {
    const invited = await this.commandBus.execute<
      InviteToWorkspaceCommand,
      InviteOutcomesDto | null
    >(
      new InviteToWorkspaceCommand(
        slug,
        listed(body.emails),
        String(body.role ?? ''),
        listed(body.teamIds),
        user.id,
      ),
    );

    if (!invited) {
      throw new NotFoundException();
    }

    return invited;
  }

  @Post(':inviteId/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'resendInvite',
    summary: 'Resend an invitation, with a fresh link and two more weeks',
  })
  @ApiParam({ name: 'slug', example: 'acme' })
  @ApiParam({ name: 'inviteId' })
  @ApiOkResponse({ type: WorkspaceInviteResponseDto })
  @ApiConflictResponse({ description: 'Already accepted or revoked' })
  @ApiNotFoundResponse({ description: 'No such invitation for this caller' })
  async resend(
    @Param('slug') slug: string,
    @Param('inviteId') inviteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WorkspaceInviteResponseDto> {
    const sent = await this.commandBus.execute<
      ResendInviteCommand,
      WorkspaceInviteDto | null
    >(new ResendInviteCommand(slug, inviteId, user.id));

    if (!sent) {
      throw new NotFoundException();
    }

    return sent;
  }

  @Delete(':inviteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'revokeInvite',
    summary: 'Revoke an invitation',
    description: 'The link of the invitation stops working.',
  })
  @ApiParam({ name: 'slug', example: 'acme' })
  @ApiParam({ name: 'inviteId' })
  @ApiNoContentResponse({ description: 'The link no longer works' })
  @ApiConflictResponse({ description: 'Already accepted' })
  @ApiNotFoundResponse({ description: 'No such invitation for this caller' })
  async revoke(
    @Param('slug') slug: string,
    @Param('inviteId') inviteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const revoked = await this.commandBus.execute<RevokeInviteCommand, boolean>(
      new RevokeInviteCommand(slug, inviteId, user.id),
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
    summary: 'Read the preview of an invitation',
  })
  @ApiParam({ name: 'token' })
  @ApiOkResponse({ type: InvitePreviewResponseDto })
  @ApiNotFoundResponse({ description: 'No invitation by that link' })
  async read(@Param('token') token: string): Promise<InvitePreviewResponseDto> {
    const preview = await this.queryBus.execute<
      ReadInviteQuery,
      InvitePreviewDto | null
    >(new ReadInviteQuery(token));

    if (!preview) {
      throw new NotFoundException();
    }

    return preview;
  }

  @Post(':token/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'acceptInvite',
    summary:
      'Take up an invitation, joining the workspace and the teams it was sent for',
  })
  @ApiParam({ name: 'token' })
  @ApiOkResponse({ type: JoinedWorkspaceResponseDto })
  @ApiUnauthorizedResponse({ description: 'No valid session' })
  @ApiForbiddenResponse({ description: 'Signed in as somebody else' })
  @ApiConflictResponse({ description: 'Already accepted, revoked or run out' })
  @ApiNotFoundResponse({ description: 'No invitation by that link' })
  async accept(
    @Param('token') token: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<JoinedWorkspaceResponseDto> {
    const joined = await this.commandBus.execute<
      AcceptInviteCommand,
      JoinedWorkspaceDto | null
    >(new AcceptInviteCommand(token, user.id, user.email));

    if (!joined) {
      throw new NotFoundException();
    }

    return joined;
  }
}
