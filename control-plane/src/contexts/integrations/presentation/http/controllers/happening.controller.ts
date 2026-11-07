import type { HappeningDto } from '@integrations/application/dto/happening.dto';
import { ListHappeningsQuery } from '@integrations/application/queries/list-happenings.query';
import { HappeningResponseDto } from '@integrations/presentation/http/dto/happening.response.dto';
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@platform/http/authenticated-user';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';

@ApiTags('happenings')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('workspaces/:slug/happenings')
export class HappeningController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    operationId: 'listHappenings',
    summary: 'The happenings a station here can wait for',
  })
  @ApiParam({ name: 'slug', example: 'acme' })
  @ApiOkResponse({ type: HappeningResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  async list(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<HappeningResponseDto[]> {
    const raised = await this.queryBus.execute<
      ListHappeningsQuery,
      HappeningDto[] | null
    >(new ListHappeningsQuery(slug, user.id));

    if (!raised) {
      throw new NotFoundException();
    }

    return raised.map(
      (each) =>
        new HappeningResponseDto(
          each.happening,
          each.integration,
          each.label,
          each.summary,
        ),
    );
  }
}
