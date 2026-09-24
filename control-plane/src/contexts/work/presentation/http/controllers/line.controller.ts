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
import type { LineDto } from '@work/application/dto/line.dto';
import { ListLinesQuery } from '@work/application/queries/list-lines.query';
import { LineResponseDto } from '@work/presentation/http/dto/line.response.dto';
import { LineHttpMapper } from '@work/presentation/http/mappers/line.http.mapper';

@ApiTags('lines')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('teams/:teamId/lines')
export class LineController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    operationId: 'listTeamLines',
    summary: 'List a team’s lines, each with its stations in order',
  })
  @ApiParam({ name: 'teamId', example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  @ApiOkResponse({ type: LineResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  async list(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LineResponseDto[]> {
    const lines = await this.queryBus.execute<ListLinesQuery, LineDto[] | null>(
      new ListLinesQuery(teamId, user.id),
    );

    if (!lines) {
      throw new NotFoundException();
    }

    return lines.map(LineHttpMapper.toResponse);
  }
}
