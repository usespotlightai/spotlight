import { CreateHookCommand } from '@integrations/application/commands/create-hook.command';
import { DeleteHookCommand } from '@integrations/application/commands/delete-hook.command';
import { UpdateHookCommand } from '@integrations/application/commands/update-hook.command';
import type { HookResourceDto } from '@integrations/application/dto/hook-resource.dto';
import { ImportHookQuery } from '@integrations/application/queries/import-hook.query';
import { ListHookResourcesQuery } from '@integrations/application/queries/list-hook-resources.query';
import { ReadHookQuery } from '@integrations/application/queries/read-hook.query';
import { HookDefinitionRequestDto } from '@integrations/presentation/http/dto/hook-definition.request.dto';
import { HookResourceResponseDto } from '@integrations/presentation/http/dto/hook-resource.response.dto';
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

const KIND = 'hook';

const HookResource = resourceApi({
  kind: KIND,
  plural: 'hooks',
  tag: 'hooks',
  representation: HookResourceResponseDto,
  addressExample: 'core/migrations-need-a-dba',
});

const DEFINITION = ApiBody({ type: HookDefinitionRequestDto });

const ID = ApiParam({
  name: 'id',
  example: '0d6f3c1e-8a52-4f7b-9c1d-5e2a7b3f9c40',
});

const WORKSPACE = ApiParam({
  name: 'workspaceId',
  example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
});

const representation = (hook: HookResourceDto) =>
  new HookResourceResponseDto(hook);

@HookResource.Controller()
export class HookResourceController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @HookResource.Create('teams/:teamId/hooks', 'Create a hook for a team')
  @ApiParam({ name: 'teamId', example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  @DEFINITION
  async create(
    @Param('teamId') teamId: string,
    @IdempotencyKeyHeader() key: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<HookResourceResponseDto> {
    return answerCreated(
      KIND,
      await this.commandBus.execute<CreateHookCommand, ResourceCreated | null>(
        new CreateHookCommand(teamId, actor, key, body),
      ),
      (id) => this.answer(id, actor.principal),
    );
  }

  @HookResource.Read('hooks/:id', 'Read a hook')
  @ID
  read(
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HookResourceResponseDto> {
    return this.answer(id, principal);
  }

  @HookResource.Update('hooks/:id', 'Replace a hook’s definition')
  @ID
  @DEFINITION
  async update(
    @Param('id') id: string,
    @IfMatch() version: number,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<HookResourceResponseDto> {
    return answerUpdated(
      KIND,
      await this.commandBus.execute<UpdateHookCommand, ResourceUpdated | null>(
        new UpdateHookCommand(id, actor, version, body),
      ),
      (updated) => this.answer(updated, actor.principal),
    );
  }

  @HookResource.Delete('hooks/:id', 'Delete a hook')
  @ID
  async delete(
    @Param('id') id: string,
    @IfMatch() version: number,
    @CurrentActor() actor: Actor,
  ): Promise<void> {
    answerDeleted(
      KIND,
      await this.commandBus.execute<DeleteHookCommand, ResourceDeleted | null>(
        new DeleteHookCommand(id, actor, version),
      ),
    );
  }

  @HookResource.Import(
    'workspaces/:workspaceId/hooks/import',
    'Find the hook at an address in a workspace, to import it',
  )
  @WORKSPACE
  async import(
    @Param('workspaceId') workspaceId: string,
    @Query('address') address: string | undefined,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HookResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<ImportHookQuery, HookResourceDto | null>(
        new ImportHookQuery(workspaceId, address ?? '', principal),
      ),
      representation,
    );
  }

  @HookResource.List(
    'workspaces/:workspaceId/hooks',
    'List every hook in a workspace, across its teams',
  )
  @WORKSPACE
  async list(
    @Param('workspaceId') workspaceId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ResourceList<HookResourceResponseDto>> {
    return listed(
      await this.queryBus.execute<
        ListHookResourcesQuery,
        readonly HookResourceDto[] | null
      >(new ListHookResourcesQuery(workspaceId, principal)),
      representation,
    );
  }

  private async answer(
    id: string,
    principal: Principal,
  ): Promise<HookResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<ReadHookQuery, HookResourceDto | null>(
        new ReadHookQuery(id, principal),
      ),
      representation,
    );
  }
}
