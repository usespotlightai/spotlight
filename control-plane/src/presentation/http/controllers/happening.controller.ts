import type { HappeningDto } from '@application/dto/happening.dto';
import type { AuthenticatedUser } from '@application/ports/session.port';
import { ListHappeningsQuery } from '@application/queries/list-happenings.query';
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
import { CurrentUser } from '@presentation/http/decorators/current-user.decorator';
import { HappeningResponseDto } from '@presentation/http/dto/happening.response.dto';

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
          each.told,
        ),
    );
  }
}
