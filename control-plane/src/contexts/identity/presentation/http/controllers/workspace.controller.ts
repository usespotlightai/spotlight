import { ChangeMemberRoleCommand } from '@identity/application/commands/change-member-role.command';
import { OpenWorkspaceCommand } from '@identity/application/commands/open-workspace.command';
import type { WorkspaceMemberDto } from '@identity/application/dto/member.dto';
import type {
  WorkspaceDetailDto,
  WorkspaceDto,
  WorkspaceListingDto,
} from '@identity/application/dto/workspace.dto';
import { GetWorkspaceQuery } from '@identity/application/queries/get-workspace.query';
import { ListWorkspaceMembersQuery } from '@identity/application/queries/list-workspace-members.query';
import { ListWorkspacesQuery } from '@identity/application/queries/list-workspaces.query';
import { CreateWorkspaceRequestDto } from '@identity/presentation/http/dto/create-workspace.request.dto';
import { ChangeMemberRoleRequestDto } from '@identity/presentation/http/dto/member.request.dto';
import { WorkspaceMemberResponseDto } from '@identity/presentation/http/dto/member.response.dto';
import {
  CreatedWorkspaceResponseDto,
  WorkspaceListingResponseDto,
  WorkspaceResponseDto,
} from '@identity/presentation/http/dto/workspace.response.dto';
import { WorkspaceHttpMapper } from '@identity/presentation/http/mappers/workspace.http.mapper';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
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
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentActor } from '@platform/http/decorators/current-actor.decorator';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';
import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

@ApiTags('workspaces')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('workspaces')
export class WorkspaceController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @ApiOperation({
    operationId: 'openWorkspace',
    summary: 'Create a workspace, along with the team it starts with',
  })
  @ApiCreatedResponse({ type: CreatedWorkspaceResponseDto })
  @ApiConflictResponse({ description: 'That workspace URL is already taken' })
  @ApiUnprocessableEntityResponse({ description: 'Invalid name or URL' })
  async create(
    @Body() body: CreateWorkspaceRequestDto,
    @CurrentActor() actor: Actor,
  ): Promise<CreatedWorkspaceResponseDto> {
    const workspace = await this.commandBus.execute<
      OpenWorkspaceCommand,
      WorkspaceDto
    >(new OpenWorkspaceCommand(body.name, body.slug, body.teamName, actor));

    return WorkspaceHttpMapper.createdToResponse(workspace);
  }

  @Get()
  @ApiOperation({
    operationId: 'listMemberWorkspaces',
    summary: 'List the workspaces the caller belongs to',
  })
  @ApiOkResponse({ type: WorkspaceListingResponseDto, isArray: true })
  async list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WorkspaceListingResponseDto[]> {
    const workspaces = await this.queryBus.execute<
      ListWorkspacesQuery,
      WorkspaceListingDto[]
    >(new ListWorkspacesQuery(user.id));

    return workspaces.map(WorkspaceHttpMapper.listingToResponse);
  }

  @Get(':slug')
  @ApiOperation({
    operationId: 'getWorkspace',
    summary: 'Read one workspace the caller belongs to',
  })
  @ApiParam({ name: 'slug', example: 'acme-inc' })
  @ApiOkResponse({ type: WorkspaceResponseDto })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  async get(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WorkspaceResponseDto> {
    const workspace = await this.queryBus.execute<
      GetWorkspaceQuery,
      WorkspaceDetailDto | null
    >(new GetWorkspaceQuery(slug, user.id));

    if (!workspace) {
      throw new NotFoundException();
    }

    return WorkspaceHttpMapper.toResponse(workspace);
  }

  @Get(':slug/members')
  @ApiOperation({
    operationId: 'listWorkspaceMembers',
    summary:
      'List everyone in the workspace, with their role, their teams, and what may be set',
  })
  @ApiParam({ name: 'slug', example: 'acme-inc' })
  @ApiOkResponse({ type: WorkspaceMemberResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  async members(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WorkspaceMemberResponseDto[]> {
    const found = await this.queryBus.execute<
      ListWorkspaceMembersQuery,
      WorkspaceMemberDto[] | null
    >(new ListWorkspaceMembersQuery(slug, user.id));

    if (!found) {
      throw new NotFoundException();
    }

    return found;
  }

  @Patch(':slug/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'changeMemberRole',
    summary: 'Set what somebody is in this workspace',
    description:
      'Roles are given downwards: an owner may set anyone’s, an admin only those of people they outrank, and nobody may hand out a rank they do not hold. The last owner keeps the workspace.',
  })
  @ApiParam({ name: 'slug', example: 'acme-inc' })
  @ApiParam({ name: 'userId' })
  @ApiNoContentResponse({ description: 'That is what they are now' })
  @ApiForbiddenResponse({ description: 'Not yours to give' })
  @ApiConflictResponse({ description: 'It would leave nobody who owns it' })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  @ApiUnprocessableEntityResponse({ description: 'No such role' })
  async changeRole(
    @Param('slug') slug: string,
    @Param('userId') userId: string,
    @Body() body: ChangeMemberRoleRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const changed = await this.commandBus.execute<
      ChangeMemberRoleCommand,
      boolean
    >(new ChangeMemberRoleCommand(slug, userId, body.role, user.id));

    if (!changed) {
      throw new NotFoundException();
    }
  }
}
