import {
  RemoveWorkspacePlanCommand,
  SetWorkspacePlanCommand,
} from '@catalog/application/commands/workspace-plan.commands';
import type {
  PlanTermDto,
  WorkspaceSummaryDto,
  WorkspaceSummaryPageDto,
} from '@catalog/application/dto/workspace-summary.dto';
import { ListWorkspaceSummariesQuery } from '@catalog/application/queries/list-workspace-summaries.query';
import { ReadWorkspaceSummaryQuery } from '@catalog/application/queries/read-workspace-summary.query';
import {
  AdminWorkspacePageResponseDto,
  AdminWorkspaceResponseDto,
  WorkspacePlanResponseDto,
} from '@catalog/presentation/http/dto/admin-workspace.response.dto';
import { SetWorkspacePlanRequestDto } from '@catalog/presentation/http/dto/set-workspace-plan.request.dto';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { AdminOnly } from '@platform/http/decorators/admin-only.decorator';
import { ADMIN } from '@platform/http/routes';

const PAGE_LIMIT = 50;

const LONGEST_PAGE = 200;

const WORKSPACE = ApiParam({
  name: 'workspaceId',
  example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
});

const NOT_FOUND = ApiNotFoundResponse({
  description: 'No such workspace, or no admin token is set',
});

const limitOf = (raw: string | undefined): number => {
  const asked = raw === undefined ? PAGE_LIMIT : Number(raw);

  if (!Number.isInteger(asked) || asked < 1) {
    throw new BadRequestException(
      'Sorry, the page limit must be a whole number above 0.',
    );
  }

  return Math.min(asked, LONGEST_PAGE);
};

const timeOf = (field: string, raw: string): Date => {
  const time = new Date(raw);

  if (Number.isNaN(time.getTime())) {
    throw new BadRequestException(
      `Sorry, ${field} must be an ISO 8601 time, such as 2027-01-01T00:00:00Z.`,
    );
  }

  return time;
};

const expiryOf = (raw: unknown): Date | null => {
  if (raw === undefined || raw === null) {
    return null;
  }

  if (typeof raw !== 'string') {
    throw new BadRequestException(
      'Sorry, expiresAt must be an ISO 8601 time or null.',
    );
  }

  return timeOf('expiresAt', raw);
};

@ApiTags('admin')
@ApiUnauthorizedResponse({
  description:
    'The request does not have the admin token (SPOTLIGHT_ADMIN_TOKEN) as its bearer token',
})
@AdminOnly()
@Controller(`${ADMIN}/workspaces`)
export class AdminWorkspaceController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listAdminWorkspaces',
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
    name: 'createdAfter',
    required: false,
    type: String,
    example: '2026-09-01T00:00:00Z',
    description: 'Only the workspaces created after this time',
  })
  @ApiOkResponse({ type: AdminWorkspacePageResponseDto })
  @ApiBadRequestResponse({
    description:
      'A page limit that is not a whole number above 0, or a createdAfter that is not a time',
  })
  @ApiUnprocessableEntityResponse({
    description: 'A page cursor that this list did not give',
  })
  @ApiNotFoundResponse({ description: 'No admin token is set' })
  async list(
    @Query('after') after: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('createdAfter') createdAfter: string | undefined,
  ): Promise<AdminWorkspacePageResponseDto> {
    const page = await this.queryBus.execute<
      ListWorkspaceSummariesQuery,
      WorkspaceSummaryPageDto
    >(
      new ListWorkspaceSummariesQuery(
        after || null,
        limitOf(limit),
        createdAfter ? timeOf('createdAfter', createdAfter) : null,
      ),
    );

    return new AdminWorkspacePageResponseDto(page);
  }

  @Get(':workspaceId')
  @ApiOperation({
    operationId: 'getAdminWorkspace',
    summary: 'Read one workspace, with its member count and plan',
  })
  @WORKSPACE
  @ApiOkResponse({ type: AdminWorkspaceResponseDto })
  @NOT_FOUND
  async get(
    @Param('workspaceId') workspaceId: string,
  ): Promise<AdminWorkspaceResponseDto> {
    const found = await this.queryBus.execute<
      ReadWorkspaceSummaryQuery,
      WorkspaceSummaryDto | null
    >(new ReadWorkspaceSummaryQuery(workspaceId));

    if (!found) {
      throw new NotFoundException();
    }

    return new AdminWorkspaceResponseDto(found);
  }

  @Put(':workspaceId/plan')
  @ApiOperation({
    operationId: 'setAdminWorkspacePlan',
    summary: 'Set the plan of a workspace',
    description:
      'The workspace’s configuration changes record the change, made by Spotlight. The free plan with no end is the same as no plan.',
  })
  @WORKSPACE
  @ApiBody({ type: SetWorkspacePlanRequestDto })
  @ApiOkResponse({ type: WorkspacePlanResponseDto })
  @ApiBadRequestResponse({ description: 'An expiresAt that is not a time' })
  @ApiUnprocessableEntityResponse({ description: 'No such plan' })
  @ApiConflictResponse({
    description: 'The plan changed at the same time; try again',
  })
  @NOT_FOUND
  async setPlan(
    @Param('workspaceId') workspaceId: string,
    @Body() body: SetWorkspacePlanRequestDto | undefined,
  ): Promise<WorkspacePlanResponseDto> {
    const set = await this.commandBus.execute<
      SetWorkspacePlanCommand,
      PlanTermDto | null
    >(
      new SetWorkspacePlanCommand(
        workspaceId,
        typeof body?.plan === 'string' ? body.plan : '',
        expiryOf(body?.expiresAt),
      ),
    );

    if (!set) {
      throw new NotFoundException();
    }

    return new WorkspacePlanResponseDto(set);
  }

  @Delete(':workspaceId/plan')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'removeAdminWorkspacePlan',
    summary: 'Put a workspace back on the free plan',
    description:
      'Removes the plan set for the workspace. The workspace’s configuration changes record the change, made by Spotlight.',
  })
  @WORKSPACE
  @ApiNoContentResponse({ description: 'The workspace has the free plan' })
  @ApiConflictResponse({
    description: 'The plan changed at the same time; try again',
  })
  @NOT_FOUND
  async removePlan(@Param('workspaceId') workspaceId: string): Promise<void> {
    const removed = await this.commandBus.execute<
      RemoveWorkspacePlanCommand,
      boolean
    >(new RemoveWorkspacePlanCommand(workspaceId));

    if (!removed) {
      throw new NotFoundException();
    }
  }
}
