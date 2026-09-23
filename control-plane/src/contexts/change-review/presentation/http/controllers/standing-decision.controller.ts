import type { StandingDecisionsDto } from '@change-review/application/dto/decision.dto';
import { ListStandingDecisionsQuery } from '@change-review/application/queries/list-standing-decisions.query';
import { StandingDecisionListResponseDto } from '@change-review/presentation/http/dto/decision.response.dto';
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';

const listed = (value: string | string[] | undefined): string[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

@ApiTags('decisions')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@ApiParam({ name: 'slug', type: String })
@Controller('workspaces/:slug/decisions')
export class StandingDecisionController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    operationId: 'listStandingDecisions',
    summary:
      'The decisions that shipped in merged pull requests, for incident handling',
  })
  @ApiQuery({ name: 'repository', required: false, example: 'acme/api' })
  @ApiQuery({
    name: 'path',
    required: false,
    isArray: true,
    type: String,
    description:
      'A file or directory in the repository; repeat it to ask about several',
  })
  @ApiQuery({
    name: 'since',
    required: false,
    description: 'Merged at or after, as an ISO date',
  })
  @ApiQuery({
    name: 'until',
    required: false,
    description: 'Merged at or before, as an ISO date',
  })
  @ApiOkResponse({ type: StandingDecisionListResponseDto })
  @ApiBadRequestResponse({
    description: 'Paths without their repository, or a time that is no date',
  })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  async standing(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('repository') repository?: string,
    @Query('path') path?: string | string[],
    @Query('since') since?: string,
    @Query('until') until?: string,
  ): Promise<StandingDecisionListResponseDto> {
    const found = await this.queryBus.execute<
      ListStandingDecisionsQuery,
      StandingDecisionsDto[] | null
    >(
      new ListStandingDecisionsQuery(
        slug,
        user.id,
        repository ?? null,
        listed(path),
        since ?? null,
        until ?? null,
      ),
    );

    if (!found) {
      throw new NotFoundException();
    }

    return new StandingDecisionListResponseDto(found);
  }
}
