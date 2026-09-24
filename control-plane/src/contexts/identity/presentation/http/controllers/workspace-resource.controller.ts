import { CreateWorkspaceCommand } from '@identity/application/commands/create-workspace.command';
import { DeleteWorkspaceCommand } from '@identity/application/commands/delete-workspace.command';
import { UpdateWorkspaceCommand } from '@identity/application/commands/update-workspace.command';
import type { WorkspaceResourceDto } from '@identity/application/dto/workspace-resource.dto';
import { ImportWorkspaceQuery } from '@identity/application/queries/import-workspace.query';
import { ReadWorkspaceQuery } from '@identity/application/queries/read-workspace.query';
import { WorkspaceResourceResponseDto } from '@identity/presentation/http/dto/workspace-resource.response.dto';
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
import type {
  ResourceCreated,
  ResourceDeleted,
  ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

const KIND = 'workspace';

const WorkspaceResource = resourceApi({
  kind: KIND,
  tag: 'workspaces',
  representation: WorkspaceResourceResponseDto,
  addressExample: 'acme',
});

const DEFINITION = ApiBody({
  schema: {
    type: 'object',
    required: ['name', 'slug'],
    properties: {
      name: { type: 'string', example: 'Acme' },
      slug: { type: 'string', example: 'acme' },
    },
  },
});

const ID = ApiParam({
  name: 'id',
  example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
});

const representation = (workspace: WorkspaceResourceDto) =>
  new WorkspaceResourceResponseDto(workspace);

@WorkspaceResource.Controller()
export class WorkspaceResourceController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @WorkspaceResource.Import(
    'workspaces/import',
    'Find the workspace with a slug, to import it',
  )
  async import(
    @Query('address') address: string | undefined,
    @CurrentPrincipal() principal: Principal,
  ): Promise<WorkspaceResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<
        ImportWorkspaceQuery,
        WorkspaceResourceDto | null
      >(new ImportWorkspaceQuery(address ?? '', principal)),
      representation,
    );
  }

  @WorkspaceResource.Create(
    'workspaces',
    'Create a workspace, owned by whoever creates it',
  )
  @DEFINITION
  async create(
    @IdempotencyKeyHeader() key: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<WorkspaceResourceResponseDto> {
    return answerCreated(
      KIND,
      await this.commandBus.execute<CreateWorkspaceCommand, ResourceCreated>(
        new CreateWorkspaceCommand(actor, key, body),
      ),
      (id) => this.answer(id, actor.principal),
    );
  }

  @WorkspaceResource.Read('workspaces/:id', 'Read a workspace')
  @ID
  read(
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<WorkspaceResourceResponseDto> {
    return this.answer(id, principal);
  }

  @WorkspaceResource.Update('workspaces/:id', 'Rename a workspace')
  @ID
  @DEFINITION
  async update(
    @Param('id') id: string,
    @IfMatch() version: number,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<WorkspaceResourceResponseDto> {
    return answerUpdated(
      KIND,
      await this.commandBus.execute<
        UpdateWorkspaceCommand,
        ResourceUpdated | null
      >(new UpdateWorkspaceCommand(id, actor, version, body)),
      (updated) => this.answer(updated, actor.principal),
    );
  }

  @WorkspaceResource.Delete(
    'workspaces/:id',
    'Delete a workspace that holds no teams',
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
        DeleteWorkspaceCommand,
        ResourceDeleted | null
      >(new DeleteWorkspaceCommand(id, actor, version)),
    );
  }

  private async answer(
    id: string,
    principal: Principal,
  ): Promise<WorkspaceResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<
        ReadWorkspaceQuery,
        WorkspaceResourceDto | null
      >(new ReadWorkspaceQuery(id, principal)),
      representation,
    );
  }
}
