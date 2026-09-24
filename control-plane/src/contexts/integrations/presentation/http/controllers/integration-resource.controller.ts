import { CreateIntegrationCommand } from '@integrations/application/commands/create-integration.command';
import { DeleteIntegrationCommand } from '@integrations/application/commands/delete-integration.command';
import { UpdateIntegrationCommand } from '@integrations/application/commands/update-integration.command';
import type { IntegrationResourceDto } from '@integrations/application/dto/integration-resource.dto';
import { ImportIntegrationQuery } from '@integrations/application/queries/import-integration.query';
import { ListIntegrationResourcesQuery } from '@integrations/application/queries/list-integration-resources.query';
import { ReadIntegrationQuery } from '@integrations/application/queries/read-integration.query';
import { IntegrationResourceResponseDto } from '@integrations/presentation/http/dto/integration-resource.response.dto';
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

const KIND = 'integration';

const IntegrationResource = resourceApi({
  kind: KIND,
  plural: 'integrations',
  tag: 'integrations',
  representation: IntegrationResourceResponseDto,
  addressExample: 'core/linear',
});

const DEFINITION = ApiBody({
  schema: {
    type: 'object',
    additionalProperties: true,
    example: {
      integration: 'linear',
      actions: {
        comment: {
          request: { method: 'POST', url: 'https://api.linear.app/graphql' },
        },
      },
    },
  },
});

const ID = ApiParam({
  name: 'id',
  example: '0d6f3c1e-8a52-4f7b-9c1d-5e2a7b3f9c40',
});

const WORKSPACE = ApiParam({
  name: 'workspaceId',
  example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
});

const representation = (integration: IntegrationResourceDto) =>
  new IntegrationResourceResponseDto(integration);

@IntegrationResource.Controller()
export class IntegrationResourceController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @IntegrationResource.Create(
    'teams/:teamId/integrations',
    'Create an integration for a team',
  )
  @ApiParam({ name: 'teamId', example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  @DEFINITION
  async create(
    @Param('teamId') teamId: string,
    @IdempotencyKeyHeader() key: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<IntegrationResourceResponseDto> {
    return answerCreated(
      KIND,
      await this.commandBus.execute<
        CreateIntegrationCommand,
        ResourceCreated | null
      >(new CreateIntegrationCommand(teamId, actor, key, body)),
      (id) => this.answer(id, actor.principal),
    );
  }

  @IntegrationResource.Read('integrations/:id', 'Read an integration')
  @ID
  read(
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<IntegrationResourceResponseDto> {
    return this.answer(id, principal);
  }

  @IntegrationResource.Update(
    'integrations/:id',
    'Replace an integration’s definition',
  )
  @ID
  @DEFINITION
  async update(
    @Param('id') id: string,
    @IfMatch() version: number,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<IntegrationResourceResponseDto> {
    return answerUpdated(
      KIND,
      await this.commandBus.execute<
        UpdateIntegrationCommand,
        ResourceUpdated | null
      >(new UpdateIntegrationCommand(id, actor, version, body)),
      (updated) => this.answer(updated, actor.principal),
    );
  }

  @IntegrationResource.Delete('integrations/:id', 'Delete an integration')
  @ID
  async delete(
    @Param('id') id: string,
    @IfMatch() version: number,
    @CurrentActor() actor: Actor,
  ): Promise<void> {
    answerDeleted(
      KIND,
      await this.commandBus.execute<
        DeleteIntegrationCommand,
        ResourceDeleted | null
      >(new DeleteIntegrationCommand(id, actor, version)),
    );
  }

  @IntegrationResource.Import(
    'workspaces/:workspaceId/integrations/import',
    'Find the integration at an address in a workspace, to import it',
  )
  @WORKSPACE
  async import(
    @Param('workspaceId') workspaceId: string,
    @Query('address') address: string | undefined,
    @CurrentPrincipal() principal: Principal,
  ): Promise<IntegrationResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<
        ImportIntegrationQuery,
        IntegrationResourceDto | null
      >(new ImportIntegrationQuery(workspaceId, address ?? '', principal)),
      representation,
    );
  }

  @IntegrationResource.List(
    'workspaces/:workspaceId/integrations',
    'List every integration in a workspace, across its teams',
  )
  @WORKSPACE
  async list(
    @Param('workspaceId') workspaceId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ResourceList<IntegrationResourceResponseDto>> {
    return listed(
      await this.queryBus.execute<
        ListIntegrationResourcesQuery,
        readonly IntegrationResourceDto[] | null
      >(new ListIntegrationResourcesQuery(workspaceId, principal)),
      representation,
    );
  }

  private async answer(
    id: string,
    principal: Principal,
  ): Promise<IntegrationResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<
        ReadIntegrationQuery,
        IntegrationResourceDto | null
      >(new ReadIntegrationQuery(id, principal)),
      representation,
    );
  }
}
