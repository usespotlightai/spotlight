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
import { CreateSecretCommand } from '@secrets/application/commands/create-secret.command';
import { DeleteSecretCommand } from '@secrets/application/commands/delete-secret.command';
import { UpdateSecretCommand } from '@secrets/application/commands/update-secret.command';
import type { SecretResourceDto } from '@secrets/application/dto/secret-resource.dto';
import { ImportSecretQuery } from '@secrets/application/queries/import-secret.query';
import { ListSecretResourcesQuery } from '@secrets/application/queries/list-secret-resources.query';
import { ReadSecretQuery } from '@secrets/application/queries/read-secret.query';
import { SECRET_SOURCE_KINDS } from '@secrets/domain/value-objects/secret-source.vo';
import { SecretResourceResponseDto } from '@secrets/presentation/http/dto/secret-resource.response.dto';
import type {
  ResourceCreated,
  ResourceDeleted,
  ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';
import { SECRET_LOCATIONS } from '@shared-kernel/domain/value-objects/secret-locations';

const KIND = 'secret';

const SecretResource = resourceApi({
  kind: KIND,
  plural: 'secrets',
  tag: 'secrets',
  representation: SecretResourceResponseDto,
  addressExample: 'LINEAR_API_KEY',
});

const DEFINITION = ApiBody({
  schema: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', example: 'LINEAR_API_KEY' },
      source: {
        type: 'object',
        required: ['kind'],
        properties: {
          kind: {
            type: 'string',
            enum: [...SECRET_SOURCE_KINDS],
            default: 'built-in',
          },
          secretId: { type: 'string' },
          field: { type: 'string' },
        },
      },
      bindings: {
        type: 'array',
        items: {
          type: 'object',
          required: ['host'],
          properties: {
            host: { type: 'string', example: 'api.linear.app' },
            location: {
              type: 'string',
              enum: [...SECRET_LOCATIONS],
              default: 'header',
            },
            name: {
              type: 'string',
              description:
                'The header or query parameter that Spotlight injects it in. The default header is authorization',
              example: 'authorization',
            },
            prefix: { type: 'string', default: '', example: 'Bearer ' },
          },
        },
      },
      valueWo: {
        type: 'string',
        writeOnly: true,
        description:
          'The value to store; accepted on create and whenever valueWoVersion changes, and never returned',
      },
      valueWoVersion: {
        type: 'integer',
        minimum: 0,
        example: 1,
        description:
          'Change it to rotate the value to the valueWo sent with it',
      },
    },
  },
});

const ID = ApiParam({
  name: 'id',
  example: '3f8a2c1d-6b4e-4d9a-8c7f-1e2d3c4b5a69',
});

const WORKSPACE = ApiParam({
  name: 'workspaceId',
  example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
});

const representation = (secret: SecretResourceDto) =>
  new SecretResourceResponseDto(secret);

@SecretResource.Controller()
export class SecretResourceController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @SecretResource.Create(
    'workspaces/:workspaceId/secrets',
    'Create a secret in a workspace; only workspace admins and tokens with the secrets scope may',
  )
  @WORKSPACE
  @DEFINITION
  async create(
    @Param('workspaceId') workspaceId: string,
    @IdempotencyKeyHeader() key: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<SecretResourceResponseDto> {
    return respondCreated(
      KIND,
      await this.commandBus.execute<
        CreateSecretCommand,
        ResourceCreated | null
      >(new CreateSecretCommand(workspaceId, actor, key, body)),
      (id) => this.toResponse(id, actor.principal),
    );
  }

  @SecretResource.Read('secrets/:id', 'Read a secret, never its value')
  @ID
  read(
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<SecretResourceResponseDto> {
    return this.toResponse(id, principal);
  }

  @SecretResource.Update(
    'secrets/:id',
    'Rebind a secret, or rotate its value by changing valueWoVersion',
  )
  @ID
  @DEFINITION
  async update(
    @Param('id') id: string,
    @IfMatch() version: number,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<SecretResourceResponseDto> {
    return respondUpdated(
      KIND,
      await this.commandBus.execute<
        UpdateSecretCommand,
        ResourceUpdated | null
      >(new UpdateSecretCommand(id, actor, version, body)),
      (updated) => this.toResponse(updated, actor.principal),
    );
  }

  @SecretResource.Delete('secrets/:id', 'Delete a secret and its value')
  @ID
  async delete(
    @Param('id') id: string,
    @IfMatch() version: number,
    @CurrentActor() actor: Actor,
  ): Promise<void> {
    respondDeleted(
      KIND,
      await this.commandBus.execute<
        DeleteSecretCommand,
        ResourceDeleted | null
      >(new DeleteSecretCommand(id, actor, version)),
    );
  }

  @SecretResource.Import(
    'workspaces/:workspaceId/secrets/import',
    'Find the secret with a name in a workspace, to import it',
  )
  @WORKSPACE
  async import(
    @Param('workspaceId') workspaceId: string,
    @Query('address') address: string | undefined,
    @CurrentPrincipal() principal: Principal,
  ): Promise<SecretResourceResponseDto> {
    return respondFound(
      KIND,
      await this.queryBus.execute<ImportSecretQuery, SecretResourceDto | null>(
        new ImportSecretQuery(workspaceId, address ?? '', principal),
      ),
      representation,
    );
  }

  @SecretResource.List(
    'workspaces/:workspaceId/secrets',
    'List every secret in a workspace, never their values',
  )
  @WORKSPACE
  async list(
    @Param('workspaceId') workspaceId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ResourceList<SecretResourceResponseDto>> {
    return respondListed(
      await this.queryBus.execute<
        ListSecretResourcesQuery,
        readonly SecretResourceDto[] | null
      >(new ListSecretResourcesQuery(workspaceId, principal)),
      representation,
    );
  }

  private async toResponse(
    id: string,
    principal: Principal,
  ): Promise<SecretResourceResponseDto> {
    return respondFound(
      KIND,
      await this.queryBus.execute<ReadSecretQuery, SecretResourceDto | null>(
        new ReadSecretQuery(id, principal),
      ),
      representation,
    );
  }
}
