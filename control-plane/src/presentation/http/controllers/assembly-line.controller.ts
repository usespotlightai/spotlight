import type { AssemblyLineDto } from '@application/dto/assembly-line.dto';
import type { AuthenticatedUser } from '@application/ports/session.port';
import { ListAssemblyLinesQuery } from '@application/queries/list-assembly-lines.query';
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
import { AssemblyLineResponseDto } from '@presentation/http/dto/assembly-line.response.dto';
import { AssemblyLineHttpMapper } from '@presentation/http/mappers/assembly-line.http.mapper';

@ApiTags('assembly-lines')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('teams/:teamId/assembly-lines')
export class AssemblyLineController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    operationId: 'listAssemblyLines',
    summary: 'List a team’s assembly lines, each with its stations in order',
  })
  @ApiParam({ name: 'teamId', example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  @ApiOkResponse({ type: AssemblyLineResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  async list(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AssemblyLineResponseDto[]> {
    const lines = await this.queryBus.execute<
      ListAssemblyLinesQuery,
      AssemblyLineDto[] | null
    >(new ListAssemblyLinesQuery(teamId, user.id));

    if (!lines) {
      throw new NotFoundException();
    }

    return lines.map(AssemblyLineHttpMapper.toResponse);
  }
}
