import { CreateWorkspaceCommand } from '@application/commands/create-workspace.command';
import type {
  WorkspaceDto,
  WorkspaceListingDto,
} from '@application/dto/workspace.dto';
import type { AuthenticatedUser } from '@application/ports/session.port';
import { GetWorkspaceQuery } from '@application/queries/get-workspace.query';
import { ListWorkspacesQuery } from '@application/queries/list-workspaces.query';
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@presentation/http/decorators/current-user.decorator';
import { CreateWorkspaceRequestDto } from '@presentation/http/dto/create-workspace.request.dto';
import {
  WorkspaceListingResponseDto,
  WorkspaceResponseDto,
} from '@presentation/http/dto/workspace.response.dto';
import { WorkspaceHttpMapper } from '@presentation/http/mappers/workspace.http.mapper';

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
    operationId: 'createWorkspace',
    summary: 'Create a workspace, along with the team it starts with',
  })
  @ApiCreatedResponse({ type: WorkspaceResponseDto })
  @ApiConflictResponse({ description: 'That workspace URL is already taken' })
  @ApiUnprocessableEntityResponse({ description: 'Invalid name or URL' })
  async create(
    @Body() body: CreateWorkspaceRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WorkspaceResponseDto> {
    const workspace = await this.commandBus.execute<
      CreateWorkspaceCommand,
      WorkspaceDto
    >(new CreateWorkspaceCommand(body.name, body.slug, user.id));

    return WorkspaceHttpMapper.toResponse(workspace);
  }

  @Get()
  @ApiOperation({
    operationId: 'listWorkspaces',
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
      WorkspaceDto | null
    >(new GetWorkspaceQuery(slug, user.id));

    if (!workspace) {
      throw new NotFoundException();
    }

    return WorkspaceHttpMapper.toResponse(workspace);
  }
}
