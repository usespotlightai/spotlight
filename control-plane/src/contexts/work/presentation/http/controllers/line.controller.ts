import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import { ConfigurationProblemsResponseDto } from '@platform/http/dto/configuration-problems.response.dto';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';
import { DefineLineCommand } from '@work/application/commands/define-line.command';
import type { LineDto } from '@work/application/dto/line.dto';
import type { DefinedLineDto } from '@work/application/dto/line-resource.dto';
import { ListLinesQuery } from '@work/application/queries/list-lines.query';
import { LineResponseDto } from '@work/presentation/http/dto/line.response.dto';
import { LineResourceResponseDto } from '@work/presentation/http/dto/line-resource.response.dto';
import { LineHttpMapper } from '@work/presentation/http/mappers/line.http.mapper';

@ApiTags('lines')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('teams/:teamId/lines')
export class LineController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listLines',
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

  @Post()
  @ApiOperation({
    operationId: 'defineLine',
    summary:
      'Define a line: open it, or reconcile the line with its key to match',
  })
  @ApiParam({ name: 'teamId', example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: true,
      example: {
        key: 'delivery',
        name: 'Delivery',
        stations: [
          {
            key: 'backlog',
            name: 'Backlog',
            kind: 'backlog',
            passesTo: ['implementation'],
          },
          {
            key: 'implementation',
            name: 'Implementation',
            harness: 'claude-code',
            prompt: 'Implement the task.',
            passesTo: ['completed'],
          },
          { key: 'completed', name: 'Completed', kind: 'completed' },
        ],
      },
    },
  })
  @ApiCreatedResponse({ type: LineResourceResponseDto })
  @ApiNotFoundResponse({ description: 'No such team this caller administers' })
  @ApiUnprocessableEntityResponse({
    type: ConfigurationProblemsResponseDto,
    description: 'What is wrong with the definition, field by field',
  })
  async define(
    @Param('teamId') teamId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LineResourceResponseDto> {
    const defined = await this.commandBus.execute<
      DefineLineCommand,
      DefinedLineDto | null
    >(new DefineLineCommand(teamId, user.id, body));

    if (!defined) {
      throw new NotFoundException();
    }

    if (!defined.ok) {
      throw new UnprocessableEntityException(
        new ConfigurationProblemsResponseDto(defined.problems),
      );
    }

    return new LineResourceResponseDto(defined.line);
  }
}
