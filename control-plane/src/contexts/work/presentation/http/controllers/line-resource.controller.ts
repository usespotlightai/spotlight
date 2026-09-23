import { Body, Param, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBody, ApiParam } from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import { IdempotencyKeyHeader } from '@platform/http/resources/idempotency-key.decorator';
import { IfMatch } from '@platform/http/resources/if-match.decorator';
import {
  answerCreated,
  answerDeleted,
  answerUpdated,
  found,
} from '@platform/http/resources/resource-answers';
import { resourceApi } from '@platform/http/resources/resource-api';
import type {
  ResourceCreated,
  ResourceDeleted,
  ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';
import { CreateLineCommand } from '@work/application/commands/create-line.command';
import { DeleteLineCommand } from '@work/application/commands/delete-line.command';
import { UpdateLineCommand } from '@work/application/commands/update-line.command';
import type { LineResourceDto } from '@work/application/dto/line-resource.dto';
import { ImportLineQuery } from '@work/application/queries/import-line.query';
import { ReadLineQuery } from '@work/application/queries/read-line.query';
import { LineResourceResponseDto } from '@work/presentation/http/dto/line-resource.response.dto';

const KIND = 'line';

const LineResource = resourceApi({
  kind: KIND,
  tag: 'lines',
  representation: LineResourceResponseDto,
  addressExample: 'core/delivery',
});

const DEFINITION = ApiBody({
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
});

const ID = ApiParam({
  name: 'id',
  example: '3f7a2c9e-5d18-4b6a-8e2f-1c9d7b4a6e03',
});

const representation = (line: LineResourceDto) =>
  new LineResourceResponseDto(line);

@LineResource.Controller()
export class LineResourceController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @LineResource.Create('teams/:teamId/lines', 'Open a line for a team')
  @ApiParam({ name: 'teamId', example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  @DEFINITION
  async create(
    @Param('teamId') teamId: string,
    @IdempotencyKeyHeader() key: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LineResourceResponseDto> {
    return answerCreated(
      KIND,
      await this.commandBus.execute<CreateLineCommand, ResourceCreated | null>(
        new CreateLineCommand(teamId, user.id, key, body),
      ),
      (id) => this.answer(id, user),
    );
  }

  @LineResource.Read('lines/:id', 'Read a line as it stands')
  @ID
  read(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LineResourceResponseDto> {
    return this.answer(id, user);
  }

  @LineResource.Update(
    'lines/:id',
    'Reconcile a line with its definition, keeping each station it keeps',
  )
  @ID
  @DEFINITION
  async update(
    @Param('id') id: string,
    @IfMatch() version: number,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LineResourceResponseDto> {
    return answerUpdated(
      KIND,
      await this.commandBus.execute<UpdateLineCommand, ResourceUpdated | null>(
        new UpdateLineCommand(id, user.id, version, body),
      ),
      (updated) => this.answer(updated, user),
    );
  }

  @LineResource.Delete('lines/:id', 'Delete a line no task stands on')
  @ID
  async delete(
    @Param('id') id: string,
    @IfMatch() version: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    answerDeleted(
      KIND,
      await this.commandBus.execute<DeleteLineCommand, ResourceDeleted | null>(
        new DeleteLineCommand(id, user.id, version),
      ),
    );
  }

  @LineResource.Import(
    'workspaces/:workspaceId/lines/import',
    'Find the line at an address in a workspace, to import it',
  )
  @ApiParam({
    name: 'workspaceId',
    example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
  })
  async import(
    @Param('workspaceId') workspaceId: string,
    @Query('address') address: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LineResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<ImportLineQuery, LineResourceDto | null>(
        new ImportLineQuery(workspaceId, address ?? '', user.id),
      ),
      representation,
    );
  }

  private async answer(
    id: string,
    user: AuthenticatedUser,
  ): Promise<LineResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<ReadLineQuery, LineResourceDto | null>(
        new ReadLineQuery(id, user.id),
      ),
      representation,
    );
  }
}
