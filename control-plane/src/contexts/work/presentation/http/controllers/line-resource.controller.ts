import { Body, Param, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBody, ApiParam } from '@nestjs/swagger';
import { CurrentActor } from '@platform/http/decorators/current-actor.decorator';
import { CurrentPrincipal } from '@platform/http/decorators/current-principal.decorator';
import type { ResourceList } from '@platform/http/dto/resource-list.response.dto';
import { IdempotencyKeyHeader } from '@platform/http/resources/idempotency-key.decorator';
import { IfMatch } from '@platform/http/resources/if-match.decorator';
import {
  answerCreated,
  answerDeleted,
  answerUpdated,
  found,
  listed,
} from '@platform/http/resources/resource-answers';
import { resourceApi } from '@platform/http/resources/resource-api';
import type {
  ResourceCreated,
  ResourceDeleted,
  ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';
import { CreateLineCommand } from '@work/application/commands/create-line.command';
import { DeleteLineCommand } from '@work/application/commands/delete-line.command';
import { UpdateLineCommand } from '@work/application/commands/update-line.command';
import type { LineResourceDto } from '@work/application/dto/line-resource.dto';
import { ImportLineQuery } from '@work/application/queries/import-line.query';
import { ListLineResourcesQuery } from '@work/application/queries/list-line-resources.query';
import { ReadLineQuery } from '@work/application/queries/read-line.query';
import { LineResourceResponseDto } from '@work/presentation/http/dto/line-resource.response.dto';

const KIND = 'line';

const LineResource = resourceApi({
  kind: KIND,
  plural: 'lines',
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
      repositories: [
        {
          name: 'acme/api',
          image: 'ghcr.io/acme/api-runner:main',
          setup: 'go mod download',
        },
      ],
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
          profile: 'careful',
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

const WORKSPACE = ApiParam({
  name: 'workspaceId',
  example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
});

const representation = (line: LineResourceDto) =>
  new LineResourceResponseDto(line);

@LineResource.Controller()
export class LineResourceController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @LineResource.Create('teams/:teamId/lines', 'Create a line for a team')
  @ApiParam({ name: 'teamId', example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  @DEFINITION
  async create(
    @Param('teamId') teamId: string,
    @IdempotencyKeyHeader() key: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<LineResourceResponseDto> {
    return answerCreated(
      KIND,
      await this.commandBus.execute<CreateLineCommand, ResourceCreated | null>(
        new CreateLineCommand(teamId, actor, key, body),
      ),
      (id) => this.answer(id, actor.principal),
    );
  }

  @LineResource.Read('lines/:id', 'Read the current form of a line')
  @ID
  read(
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<LineResourceResponseDto> {
    return this.answer(id, principal);
  }

  @LineResource.Update(
    'lines/:id',
    'Reconcile a line with its definition, and keep each station that the definition still names',
  )
  @ID
  @DEFINITION
  async update(
    @Param('id') id: string,
    @IfMatch() version: number,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<LineResourceResponseDto> {
    return answerUpdated(
      KIND,
      await this.commandBus.execute<UpdateLineCommand, ResourceUpdated | null>(
        new UpdateLineCommand(id, actor, version, body),
      ),
      (updated) => this.answer(updated, actor.principal),
    );
  }

  @LineResource.Delete('lines/:id', 'Delete a line that has no tasks')
  @ID
  async delete(
    @Param('id') id: string,
    @IfMatch() version: number,
    @CurrentActor() actor: Actor,
  ): Promise<void> {
    answerDeleted(
      KIND,
      await this.commandBus.execute<DeleteLineCommand, ResourceDeleted | null>(
        new DeleteLineCommand(id, actor, version),
      ),
    );
  }

  @LineResource.Import(
    'workspaces/:workspaceId/lines/import',
    'Find the line at an address in a workspace, to import it',
  )
  @WORKSPACE
  async import(
    @Param('workspaceId') workspaceId: string,
    @Query('address') address: string | undefined,
    @CurrentPrincipal() principal: Principal,
  ): Promise<LineResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<ImportLineQuery, LineResourceDto | null>(
        new ImportLineQuery(workspaceId, address ?? '', principal),
      ),
      representation,
    );
  }

  @LineResource.List(
    'workspaces/:workspaceId/lines',
    'List every line in a workspace, across its teams, each in its current form',
  )
  @WORKSPACE
  async list(
    @Param('workspaceId') workspaceId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ResourceList<LineResourceResponseDto>> {
    return listed(
      await this.queryBus.execute<
        ListLineResourcesQuery,
        readonly LineResourceDto[] | null
      >(new ListLineResourcesQuery(workspaceId, principal)),
      representation,
    );
  }

  private async answer(
    id: string,
    principal: Principal,
  ): Promise<LineResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<ReadLineQuery, LineResourceDto | null>(
        new ReadLineQuery(id, principal),
      ),
      representation,
    );
  }
}
