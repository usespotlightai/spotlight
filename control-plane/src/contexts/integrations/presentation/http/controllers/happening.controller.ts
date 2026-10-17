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
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';

@ApiTags('happenings')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('workspaces/:slug/happenings')
export class HappeningController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    operationId: 'listHappenings',
    summary: 'The words a station here can be set to wait for',
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
          each.source,
          each.label,
          each.summary,
        ),
    );
  }
}
