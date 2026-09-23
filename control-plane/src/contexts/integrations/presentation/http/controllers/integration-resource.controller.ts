import { CreateIntegrationCommand } from '@integrations/application/commands/create-integration.command';
import { DeleteIntegrationCommand } from '@integrations/application/commands/delete-integration.command';
import { UpdateIntegrationCommand } from '@integrations/application/commands/update-integration.command';
import type { IntegrationResourceDto } from '@integrations/application/dto/integration-resource.dto';
import { ImportIntegrationQuery } from '@integrations/application/queries/import-integration.query';
import { ReadIntegrationQuery } from '@integrations/application/queries/read-integration.query';
import { IntegrationResourceResponseDto } from '@integrations/presentation/http/dto/integration-resource.response.dto';
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

const KIND = 'integration';

const IntegrationResource = resourceApi({
  kind: KIND,
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
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IntegrationResourceResponseDto> {
    return answerCreated(
      KIND,
      await this.commandBus.execute<
        CreateIntegrationCommand,
        ResourceCreated | null
      >(new CreateIntegrationCommand(teamId, user.id, key, body)),
      (id) => this.answer(id, user),
    );
  }

  @IntegrationResource.Read('integrations/:id', 'Read an integration')
  @ID
  read(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IntegrationResourceResponseDto> {
    return this.answer(id, user);
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
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IntegrationResourceResponseDto> {
    return answerUpdated(
      KIND,
      await this.commandBus.execute<
        UpdateIntegrationCommand,
        ResourceUpdated | null
      >(new UpdateIntegrationCommand(id, user.id, version, body)),
      (updated) => this.answer(updated, user),
    );
  }

  @IntegrationResource.Delete('integrations/:id', 'Delete an integration')
  @ID
  async delete(
    @Param('id') id: string,
    @IfMatch() version: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    answerDeleted(
      KIND,
      await this.commandBus.execute<
        DeleteIntegrationCommand,
        ResourceDeleted | null
      >(new DeleteIntegrationCommand(id, user.id, version)),
    );
  }

  @IntegrationResource.Import(
    'workspaces/:workspaceId/integrations/import',
    'Find the integration at an address in a workspace, to import it',
  )
  @ApiParam({
    name: 'workspaceId',
    example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
  })
  async import(
    @Param('workspaceId') workspaceId: string,
    @Query('address') address: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IntegrationResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<
        ImportIntegrationQuery,
        IntegrationResourceDto | null
      >(new ImportIntegrationQuery(workspaceId, address ?? '', user.id)),
      representation,
    );
  }

  private async answer(
    id: string,
    user: AuthenticatedUser,
  ): Promise<IntegrationResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<
        ReadIntegrationQuery,
        IntegrationResourceDto | null
      >(new ReadIntegrationQuery(id, user.id)),
      representation,
    );
  }
}
