import {
  CreateWorkspaceTokenTrustCommand,
  DeleteWorkspaceTokenTrustCommand,
  UpdateWorkspaceTokenTrustCommand,
} from '@identity/application/commands/workspace-token-trust.commands';
import type { WorkspaceTokenTrustResourceDto } from '@identity/application/dto/workspace-token-trust-resource.dto';
import {
  ImportWorkspaceTokenTrustQuery,
  ListWorkspaceTokenTrustResourcesQuery,
  ReadWorkspaceTokenTrustQuery,
} from '@identity/application/queries/workspace-token-trust.queries';
import { WorkspaceTokenTrustResourceResponseDto } from '@identity/presentation/http/dto/workspace-token-trust-resource.response.dto';
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
import type {
  ResourceCreated,
  ResourceDeleted,
  ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';
import { TOKEN_SCOPES } from '@shared-kernel/domain/value-objects/token-scope.vo';

const KIND = 'workspace-token-trust';

const WorkspaceTokenTrustResource = resourceApi({
  kind: KIND,
  plural: 'workspace-token-trusts',
  tag: 'workspace-tokens',
  representation: WorkspaceTokenTrustResourceResponseDto,
  addressExample: 'github-main',
});

const DEFINITION = ApiBody({
  schema: {
    type: 'object',
    required: ['key', 'issuer', 'subject', 'scopes'],
    properties: {
      key: { type: 'string', example: 'github-main' },
      issuer: {
        type: 'string',
        example: 'https://token.actions.githubusercontent.com',
      },
      audience: { type: 'string', default: 'spotlight' },
      subject: {
        type: 'string',
        example: 'repo:acme/platform:ref:refs/heads/main',
      },
      claims: {
        type: 'object',
        additionalProperties: { type: 'string' },
        example: { repository: 'acme/platform' },
      },
      scopes: {
        type: 'array',
        items: { type: 'string', enum: [...TOKEN_SCOPES] },
        minItems: 1,
        uniqueItems: true,
        example: ['configure', 'secrets'],
      },
      lifetimeMinutes: {
        type: 'integer',
        minimum: 1,
        maximum: 60,
        default: 15,
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

const representation = (trust: WorkspaceTokenTrustResourceDto) =>
  new WorkspaceTokenTrustResourceResponseDto(trust);

@WorkspaceTokenTrustResource.Controller()
export class WorkspaceTokenTrustResourceController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @WorkspaceTokenTrustResource.Create(
    'workspaces/:workspaceId/token-trusts',
    'Trust a CI workload to exchange the OIDC token its platform issues for a short-lived workspace token; needs a workspace admin, or a token granted trusts',
  )
  @WORKSPACE
  @DEFINITION
  async create(
    @Param('workspaceId') workspaceId: string,
    @IdempotencyKeyHeader() key: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<WorkspaceTokenTrustResourceResponseDto> {
    return respondCreated(
      KIND,
      await this.commandBus.execute<
        CreateWorkspaceTokenTrustCommand,
        ResourceCreated | null
      >(new CreateWorkspaceTokenTrustCommand(workspaceId, actor, key, body)),
      (id) => this.toResponse(id, actor.principal),
    );
  }

  @WorkspaceTokenTrustResource.Read(
    'token-trusts/:id',
    'Read a workspace token trust',
  )
  @ID
  read(
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<WorkspaceTokenTrustResourceResponseDto> {
    return this.toResponse(id, principal);
  }

  @WorkspaceTokenTrustResource.Update(
    'token-trusts/:id',
    'Change which workloads a token trust matches, or what the tokens it issues may do; tokens issued with scopes it no longer grants stop being valid',
  )
  @ID
  @DEFINITION
  async update(
    @Param('id') id: string,
    @IfMatch() version: number,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<WorkspaceTokenTrustResourceResponseDto> {
    return respondUpdated(
      KIND,
      await this.commandBus.execute<
        UpdateWorkspaceTokenTrustCommand,
        ResourceUpdated | null
      >(new UpdateWorkspaceTokenTrustCommand(id, actor, version, body)),
      (updated) => this.toResponse(updated, actor.principal),
    );
  }

  @WorkspaceTokenTrustResource.Delete(
    'token-trusts/:id',
    'Delete a token trust; Spotlight accepts no token that the trust issued from this moment',
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
        DeleteWorkspaceTokenTrustCommand,
        ResourceDeleted | null
      >(new DeleteWorkspaceTokenTrustCommand(id, actor, version)),
    );
  }

  @WorkspaceTokenTrustResource.Import(
    'workspaces/:workspaceId/token-trusts/import',
    'Find the token trust with a key in a workspace, to import it',
  )
  @WORKSPACE
  async import(
    @Param('workspaceId') workspaceId: string,
    @Query('address') address: string | undefined,
    @CurrentPrincipal() principal: Principal,
  ): Promise<WorkspaceTokenTrustResourceResponseDto> {
    return respondFound(
      KIND,
      await this.queryBus.execute<
        ImportWorkspaceTokenTrustQuery,
        WorkspaceTokenTrustResourceDto | null
      >(
        new ImportWorkspaceTokenTrustQuery(
          workspaceId,
          address ?? '',
          principal,
        ),
      ),
      representation,
    );
  }

  @WorkspaceTokenTrustResource.List(
    'workspaces/:workspaceId/token-trusts',
    'List every token trust in a workspace',
  )
  @WORKSPACE
  async list(
    @Param('workspaceId') workspaceId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ResourceList<WorkspaceTokenTrustResourceResponseDto>> {
    return respondListed(
      await this.queryBus.execute<
        ListWorkspaceTokenTrustResourcesQuery,
        readonly WorkspaceTokenTrustResourceDto[] | null
      >(new ListWorkspaceTokenTrustResourcesQuery(workspaceId, principal)),
      representation,
    );
  }

  private async toResponse(
    id: string,
    principal: Principal,
  ): Promise<WorkspaceTokenTrustResourceResponseDto> {
    return respondFound(
      KIND,
      await this.queryBus.execute<
        ReadWorkspaceTokenTrustQuery,
        WorkspaceTokenTrustResourceDto | null
      >(new ReadWorkspaceTokenTrustQuery(id, principal)),
      representation,
    );
  }
}
