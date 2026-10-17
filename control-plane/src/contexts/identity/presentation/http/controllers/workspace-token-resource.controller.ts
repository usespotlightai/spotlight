import {
  CreateWorkspaceTokenCommand,
  DeleteWorkspaceTokenCommand,
  UpdateWorkspaceTokenCommand,
} from '@identity/application/commands/workspace-token.commands';
import type {
  WorkspaceTokenCreatedDto,
  WorkspaceTokenResourceDto,
} from '@identity/application/dto/workspace-token-resource.dto';
import {
  ImportWorkspaceTokenQuery,
  ListWorkspaceTokenResourcesQuery,
  ReadWorkspaceTokenQuery,
} from '@identity/application/queries/workspace-token.queries';
import { WorkspaceTokenResourceResponseDto } from '@identity/presentation/http/dto/workspace-token-resource.response.dto';
import { Body, HttpStatus, Param, Query, Res } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBody, ApiParam, ApiResponse } from '@nestjs/swagger';
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
import {
  ETAG_HEADER,
  IDEMPOTENT_REPLAY_HEADER,
} from '@platform/http/resources/resource-headers';
import type {
  ResourceDeleted,
  ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';
import { TOKEN_SCOPES } from '@shared-kernel/domain/value-objects/token-scope.vo';

const KIND = 'workspace-token';

const WORKSPACE_TOKEN_HEADER = 'Spotlight-Workspace-Token';

const WorkspaceTokenResource = resourceApi({
  kind: KIND,
  plural: 'workspace-tokens',
  tag: 'workspace-tokens',
  representation: WorkspaceTokenResourceResponseDto,
  addressExample: 'ci',
});

const DEFINITION = ApiBody({
  schema: {
    type: 'object',
    required: ['name', 'scopes'],
    properties: {
      name: { type: 'string', example: 'ci' },
      scopes: {
        type: 'array',
        items: { type: 'string', enum: [...TOKEN_SCOPES] },
        minItems: 1,
        uniqueItems: true,
        example: ['configure', 'secrets'],
      },
      description: {
        type: 'string',
        maxLength: 255,
        example: 'Plans the platform repository on every pull request',
      },
      expiresAt: {
        type: 'string',
        format: 'date-time',
        nullable: true,
        example: '2026-12-31T23:59:59Z',
      },
    },
  },
});

const CREATED = ApiResponse({
  status: HttpStatus.CREATED,
  description: 'The token, as a read would answer it',
  type: WorkspaceTokenResourceResponseDto,
  headers: {
    [ETAG_HEADER]: {
      description: 'The version answered, to send back as If-Match',
      schema: { type: 'string', example: '"0"' },
    },
    [IDEMPOTENT_REPLAY_HEADER]: {
      description: 'true when this answers an earlier attempt',
      schema: { type: 'string', enum: ['true'] },
    },
    [WORKSPACE_TOKEN_HEADER]: {
      description:
        'The token to send as Authorization: Bearer; answered this once and never again, not even to a retry, and stored only as a hash',
      schema: {
        type: 'string',
        example: 'q3Vd0n8yXbT2c4kPzR7mW1sLhA9eJ5gUfN6oYiC0xEw',
      },
    },
  },
});

const ID = ApiParam({
  name: 'id',
  example: '3f7a2c1d-9b84-4e6f-a05d-7c2e1b9f4a63',
});

const WORKSPACE = ApiParam({
  name: 'workspaceId',
  example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
});

interface Headed {
  setHeader(name: string, value: string): void;
}

const representation = (token: WorkspaceTokenResourceDto) =>
  new WorkspaceTokenResourceResponseDto(token);

@WorkspaceTokenResource.Controller()
export class WorkspaceTokenResourceController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @CREATED
  @WorkspaceTokenResource.Create(
    'workspaces/:workspaceId/tokens',
    'Issue a token that acts in a workspace within its scopes; only a workspace admin may',
  )
  @WORKSPACE
  @DEFINITION
  async create(
    @Param('workspaceId') workspaceId: string,
    @IdempotencyKeyHeader() key: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
    @Res({ passthrough: true }) response: Headed,
  ): Promise<WorkspaceTokenResourceResponseDto> {
    const issued = await this.commandBus.execute<
      CreateWorkspaceTokenCommand,
      WorkspaceTokenCreatedDto | null
    >(new CreateWorkspaceTokenCommand(workspaceId, actor, key, body));
    const answered = await answerCreated(KIND, issued?.created ?? null, (id) =>
      this.answer(id, actor.principal),
    );

    if (issued?.token) {
      response.setHeader(WORKSPACE_TOKEN_HEADER, issued.token);
    }

    return answered;
  }

  @WorkspaceTokenResource.Read('tokens/:id', 'Read a workspace token')
  @ID
  read(
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<WorkspaceTokenResourceResponseDto> {
    return this.answer(id, principal);
  }

  @WorkspaceTokenResource.Update(
    'tokens/:id',
    "Update a workspace token's description; its name, scopes and expiry stay as issued",
  )
  @ID
  @DEFINITION
  async update(
    @Param('id') id: string,
    @IfMatch() version: number,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<WorkspaceTokenResourceResponseDto> {
    return answerUpdated(
      KIND,
      await this.commandBus.execute<
        UpdateWorkspaceTokenCommand,
        ResourceUpdated | null
      >(new UpdateWorkspaceTokenCommand(id, actor, version, body)),
      (updated) => this.answer(updated, actor.principal),
    );
  }

  @WorkspaceTokenResource.Delete(
    'tokens/:id',
    'Revoke a workspace token; Spotlight does not accept it from this moment',
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
        DeleteWorkspaceTokenCommand,
        ResourceDeleted | null
      >(new DeleteWorkspaceTokenCommand(id, actor, version)),
    );
  }

  @WorkspaceTokenResource.Import(
    'workspaces/:workspaceId/tokens/import',
    'Find the token with a name in a workspace, to import it',
  )
  @WORKSPACE
  async import(
    @Param('workspaceId') workspaceId: string,
    @Query('address') address: string | undefined,
    @CurrentPrincipal() principal: Principal,
  ): Promise<WorkspaceTokenResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<
        ImportWorkspaceTokenQuery,
        WorkspaceTokenResourceDto | null
      >(new ImportWorkspaceTokenQuery(workspaceId, address ?? '', principal)),
      representation,
    );
  }

  @WorkspaceTokenResource.List(
    'workspaces/:workspaceId/tokens',
    'List every token that acts in a workspace, never the tokens themselves',
  )
  @WORKSPACE
  async list(
    @Param('workspaceId') workspaceId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ResourceList<WorkspaceTokenResourceResponseDto>> {
    return listed(
      await this.queryBus.execute<
        ListWorkspaceTokenResourcesQuery,
        readonly WorkspaceTokenResourceDto[] | null
      >(new ListWorkspaceTokenResourcesQuery(workspaceId, principal)),
      representation,
    );
  }

  private async answer(
    id: string,
    principal: Principal,
  ): Promise<WorkspaceTokenResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<
        ReadWorkspaceTokenQuery,
        WorkspaceTokenResourceDto | null
      >(new ReadWorkspaceTokenQuery(id, principal)),
      representation,
    );
  }
}
