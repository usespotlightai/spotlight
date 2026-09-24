import { Body, Param, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBody, ApiParam } from '@nestjs/swagger';
import { CurrentActor } from '@platform/http/decorators/current-actor.decorator';
import { CurrentPrincipal } from '@platform/http/decorators/current-principal.decorator';
import { IdempotencyKeyHeader } from '@platform/http/resources/idempotency-key.decorator';
import { IfMatch } from '@platform/http/resources/if-match.decorator';
import {
  answerCreated,
  answerDeleted,
  answerUpdated,
  found,
} from '@platform/http/resources/resource-answers';
import { resourceApi } from '@platform/http/resources/resource-api';
import {
  CreateWorkspaceRunnersCommand,
  DeleteWorkspaceRunnersCommand,
  UpdateWorkspaceRunnersCommand,
} from '@runners/application/commands/runner-resource.commands';
import type { WorkspaceRunnersResourceDto } from '@runners/application/dto/runner-resource.dto';
import {
  ImportWorkspaceRunnersQuery,
  ReadWorkspaceRunnersQuery,
} from '@runners/application/queries/runner-resource.queries';
import { WorkspaceRunnersResourceResponseDto } from '@runners/presentation/http/dto/runner-resource.response.dto';
import type {
  ResourceCreated,
  ResourceDeleted,
  ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

const KIND = 'workspace-runners';

const WorkspaceRunnersResource = resourceApi({
  kind: KIND,
  tag: 'runners',
  representation: WorkspaceRunnersResourceResponseDto,
  addressExample: 'acme',
});

const DEFINITION = ApiBody({
  schema: {
    type: 'object',
    properties: {
      runners: {
        type: 'array',
        items: { type: 'string' },
        example: ['build-1'],
      },
      trusts: {
        type: 'array',
        items: { type: 'string' },
        example: ['production-cluster'],
      },
    },
  },
});

const ID = ApiParam({
  name: 'id',
  example: '6e2b8f1d-4c93-4a7e-8d5b-1f0c9a3e7b62',
});

const WORKSPACE = ApiParam({
  name: 'workspaceId',
  example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
});

const representation = (declared: WorkspaceRunnersResourceDto) =>
  new WorkspaceRunnersResourceResponseDto(declared);

@WorkspaceRunnersResource.Controller()
export class WorkspaceRunnersResourceController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @WorkspaceRunnersResource.Create(
    'workspaces/:workspaceId/workspace-runners',
    'Declare every runner a workspace means to have, so any other shows as drift',
  )
  @WORKSPACE
  @DEFINITION
  async create(
    @Param('workspaceId') workspaceId: string,
    @IdempotencyKeyHeader() key: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<WorkspaceRunnersResourceResponseDto> {
    return answerCreated(
      KIND,
      await this.commandBus.execute<
        CreateWorkspaceRunnersCommand,
        ResourceCreated | null
      >(new CreateWorkspaceRunnersCommand(workspaceId, actor, key, body)),
      (id) => this.answer(id, actor.principal),
    );
  }

  @WorkspaceRunnersResource.Read(
    'workspace-runners/:id',
    'Read the runners a workspace declares, and any enrolled outside them',
  )
  @ID
  read(
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<WorkspaceRunnersResourceResponseDto> {
    return this.answer(id, principal);
  }

  @WorkspaceRunnersResource.Update(
    'workspace-runners/:id',
    'Declare the workspace runners again',
  )
  @ID
  @DEFINITION
  async update(
    @Param('id') id: string,
    @IfMatch() version: number,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<WorkspaceRunnersResourceResponseDto> {
    return answerUpdated(
      KIND,
      await this.commandBus.execute<
        UpdateWorkspaceRunnersCommand,
        ResourceUpdated | null
      >(new UpdateWorkspaceRunnersCommand(id, actor, version, body)),
      (updated) => this.answer(updated, actor.principal),
    );
  }

  @WorkspaceRunnersResource.Delete(
    'workspace-runners/:id',
    'Stop declaring the workspace runners, leaving every runner enrolled',
  )
  @ID
  async delete(
    @Param('id') id: string,
    @IfMatch() version: number,
    @CurrentActor() actor: Actor,
  ): Promise<void> {
    answerDeleted(
      KIND,
      await this.commandBus.execute<
        DeleteWorkspaceRunnersCommand,
        ResourceDeleted | null
      >(new DeleteWorkspaceRunnersCommand(id, actor, version)),
    );
  }

  @WorkspaceRunnersResource.Import(
    'workspaces/:workspaceId/workspace-runners/import',
    'Find what a workspace declares of its runners, by its slug, to import it',
  )
  @WORKSPACE
  async import(
    @Param('workspaceId') workspaceId: string,
    @Query('address') address: string | undefined,
    @CurrentPrincipal() principal: Principal,
  ): Promise<WorkspaceRunnersResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<
        ImportWorkspaceRunnersQuery,
        WorkspaceRunnersResourceDto | null
      >(new ImportWorkspaceRunnersQuery(workspaceId, address ?? '', principal)),
      representation,
    );
  }

  private async answer(
    id: string,
    principal: Principal,
  ): Promise<WorkspaceRunnersResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<
        ReadWorkspaceRunnersQuery,
        WorkspaceRunnersResourceDto | null
      >(new ReadWorkspaceRunnersQuery(id, principal)),
      representation,
    );
  }
}
