import {
  DeleteWorkspacePlanCommand,
  SetWorkspacePlanCommand,
} from '@catalog/application/commands/workspace-plan.commands';
import type { PlanTermDto } from '@catalog/application/dto/plan-term.dto';
import type {
  WorkspaceSummaryDto,
  WorkspaceSummaryPageDto,
} from '@catalog/application/dto/workspace-summary.dto';
import { ListWorkspaceSummariesQuery } from '@catalog/application/queries/list-workspace-summaries.query';
import { ReadWorkspaceSummaryQuery } from '@catalog/application/queries/read-workspace-summary.query';
import { PLANS } from '@catalog/domain/value-objects/plan.vo';
import { PlanTermResponseDto } from '@catalog/presentation/http/dto/plan-term.response.dto';
import { SetWorkspacePlanRequestDto } from '@catalog/presentation/http/dto/set-workspace-plan.request.dto';
import {
  WorkspaceSummaryPageResponseDto,
  WorkspaceSummaryResponseDto,
} from '@catalog/presentation/http/dto/workspace-summary.response.dto';
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
import { pageLimitOf } from '@platform/http/page-limit';
import { ADMIN } from '@platform/http/routes';
import {
  LONGEST_PAGE,
  PAGE_LIMIT,
} from '@shared-kernel/application/dto/page-limits.dto';

// An ISO 8601 date and time, with seconds and a time zone where given.
const ISO_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

const WORKSPACE = ApiParam({
  name: 'workspaceId',
  example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
});

const NOT_FOUND = ApiNotFoundResponse({
  description: 'No such workspace, or no admin token is set',
});

const timeOf = (field: string, raw: string): Date => {
  const time = new Date(raw);

  if (!ISO_TIME.test(raw) || Number.isNaN(time.getTime())) {
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

const planOf = (raw: unknown): string => {
  if (typeof raw !== 'string') {
    throw new BadRequestException(
      `Sorry, the body must name a plan: ${PLANS.join(', ')}.`,
    );
  }

  return raw;
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
    operationId: 'listWorkspaceSummaries',
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
  @ApiOkResponse({ type: WorkspaceSummaryPageResponseDto })
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
  ): Promise<WorkspaceSummaryPageResponseDto> {
    const page = await this.queryBus.execute<
      ListWorkspaceSummariesQuery,
      WorkspaceSummaryPageDto
    >(
      new ListWorkspaceSummariesQuery(
        after || null,
        pageLimitOf(limit),
        createdAfter ? timeOf('createdAfter', createdAfter) : null,
      ),
    );

    return new WorkspaceSummaryPageResponseDto(page);
  }

  @Get(':workspaceId')
  @ApiOperation({
    operationId: 'readWorkspaceSummary',
    summary: 'Read one workspace, with its member count and plan',
  })
  @WORKSPACE
  @ApiOkResponse({ type: WorkspaceSummaryResponseDto })
  @NOT_FOUND
  async read(
    @Param('workspaceId') workspaceId: string,
  ): Promise<WorkspaceSummaryResponseDto> {
    const found = await this.queryBus.execute<
      ReadWorkspaceSummaryQuery,
      WorkspaceSummaryDto | null
    >(new ReadWorkspaceSummaryQuery(workspaceId));

    if (!found) {
      throw new NotFoundException();
    }

    return new WorkspaceSummaryResponseDto(found);
  }

  @Put(':workspaceId/plan')
  @ApiOperation({
    operationId: 'setWorkspacePlan',
    summary: 'Set the plan of a workspace',
    description:
      'The workspace’s configuration changes record the change, made by Spotlight. The free plan is the same as no plan. An end must be in the future.',
  })
  @WORKSPACE
  @ApiBody({ type: SetWorkspacePlanRequestDto })
  @ApiOkResponse({ type: PlanTermResponseDto })
  @ApiBadRequestResponse({
    description: 'A body without a plan, or an expiresAt that is not a time',
  })
  @ApiUnprocessableEntityResponse({
    description: 'No such plan, or an end that is not in the future',
  })
  @ApiConflictResponse({
    description: 'The plan changed at the same time; try again',
  })
  @NOT_FOUND
  async setPlan(
    @Param('workspaceId') workspaceId: string,
    @Body() body: SetWorkspacePlanRequestDto | undefined,
  ): Promise<PlanTermResponseDto> {
    const set = await this.commandBus.execute<
      SetWorkspacePlanCommand,
      PlanTermDto | null
    >(
      new SetWorkspacePlanCommand(
        workspaceId,
        planOf(body?.plan),
        expiryOf(body?.expiresAt),
      ),
    );

    if (!set) {
      throw new NotFoundException();
    }

    return new PlanTermResponseDto(set);
  }

  @Delete(':workspaceId/plan')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'deleteWorkspacePlan',
    summary: 'Put a workspace back on the free plan',
    description:
      'Deletes the plan set for the workspace. The workspace’s configuration changes record the change, made by Spotlight.',
  })
  @WORKSPACE
  @ApiNoContentResponse({ description: 'The workspace has the free plan' })
  @ApiConflictResponse({
    description: 'The plan changed at the same time; try again',
  })
  @NOT_FOUND
  async deletePlan(@Param('workspaceId') workspaceId: string): Promise<void> {
    const deleted = await this.commandBus.execute<
      DeleteWorkspacePlanCommand,
      boolean
    >(new DeleteWorkspacePlanCommand(workspaceId));

    if (!deleted) {
      throw new NotFoundException();
    }
  }
}
