import { Body, Param, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBody, ApiParam } from '@nestjs/swagger';
import { CurrentActor } from '@platform/http/decorators/current-actor.decorator';
import { CurrentPrincipal } from '@platform/http/decorators/current-principal.decorator';
import type { ResourceList } from '@platform/http/dto/resource-list.response.dto';
import { IdempotencyKeyHeader } from '@platform/http/resources/idempotency-key.decorator';
import { IfMatch } from '@platform/http/resources/if-match.decorator';
import { resourceApi } from '@platform/http/resources/resource-api';
import {
  respondCreated,
  respondDeleted,
  respondFound,
  respondListed,
  respondUpdated,
} from '@platform/http/resources/resource-responses';
import {
  CreateWorkspaceRunnersCommand,
  DeleteWorkspaceRunnersCommand,
  UpdateWorkspaceRunnersCommand,
} from '@runners/application/commands/runner-resource.commands';
import type { WorkspaceRunnersResourceDto } from '@runners/application/dto/runner-resource.dto';
import {
  ImportWorkspaceRunnersQuery,
  ListWorkspaceRunnersResourcesQuery,
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
  plural: 'workspace-runners',
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
      pools: {
        type: 'array',
        items: { type: 'string' },
        example: ['ephemeral'],
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
    'Create the workspace runners: the pools and trusts a workspace lets work through',
  )
  @WORKSPACE
  @DEFINITION
  async create(
    @Param('workspaceId') workspaceId: string,
    @IdempotencyKeyHeader() key: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<WorkspaceRunnersResourceResponseDto> {
    return respondCreated(
      KIND,
      await this.commandBus.execute<
        CreateWorkspaceRunnersCommand,
        ResourceCreated | null
      >(new CreateWorkspaceRunnersCommand(workspaceId, actor, key, body)),
      (id) => this.toResponse(id, actor.principal),
    );
  }

  @WorkspaceRunnersResource.Read(
    'workspace-runners/:id',
    'Read the pools and trusts a workspace declares',
  )
  @ID
  read(
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<WorkspaceRunnersResourceResponseDto> {
    return this.toResponse(id, principal);
  }

  @WorkspaceRunnersResource.Update(
    'workspace-runners/:id',
    'Update the workspace runners',
  )
  @ID
  @DEFINITION
  async update(
    @Param('id') id: string,
    @IfMatch() version: number,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<WorkspaceRunnersResourceResponseDto> {
    return respondUpdated(
      KIND,
      await this.commandBus.execute<
        UpdateWorkspaceRunnersCommand,
        ResourceUpdated | null
      >(new UpdateWorkspaceRunnersCommand(id, actor, version, body)),
      (updated) => this.toResponse(updated, actor.principal),
    );
  }

  @WorkspaceRunnersResource.Delete(
    'workspace-runners/:id',
    'Delete the workspace runners, leaving every pool and trust as it is',
  )
  @ID
  async delete(
    @Param('id') id: string,
    @IfMatch() version: number,
    @CurrentActor() actor: Actor,
  ): Promise<void> {
    respondDeleted(
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
    return respondFound(
      KIND,
      await this.queryBus.execute<
        ImportWorkspaceRunnersQuery,
        WorkspaceRunnersResourceDto | null
      >(new ImportWorkspaceRunnersQuery(workspaceId, address ?? '', principal)),
      representation,
    );
  }

  @WorkspaceRunnersResource.List(
    'workspaces/:workspaceId/workspace-runners',
    'List what a workspace declares of its runners: one declaration, or none',
  )
  @WORKSPACE
  async list(
    @Param('workspaceId') workspaceId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ResourceList<WorkspaceRunnersResourceResponseDto>> {
    return respondListed(
      await this.queryBus.execute<
        ListWorkspaceRunnersResourcesQuery,
        readonly WorkspaceRunnersResourceDto[] | null
      >(new ListWorkspaceRunnersResourcesQuery(workspaceId, principal)),
      representation,
    );
  }

  private async toResponse(
    id: string,
    principal: Principal,
  ): Promise<WorkspaceRunnersResourceResponseDto> {
    return respondFound(
      KIND,
      await this.queryBus.execute<
        ReadWorkspaceRunnersQuery,
        WorkspaceRunnersResourceDto | null
      >(new ReadWorkspaceRunnersQuery(id, principal)),
      representation,
    );
  }
}
