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
import {
  CreateRunnerPoolCommand,
  DeleteRunnerPoolCommand,
  UpdateRunnerPoolCommand,
} from '@runners/application/commands/runner-resource.commands';
import type {
  RunnerPoolCreatedDto,
  RunnerPoolResourceDto,
} from '@runners/application/dto/runner-resource.dto';
import {
  ImportRunnerPoolQuery,
  ListRunnerPoolResourcesQuery,
  ReadRunnerPoolQuery,
} from '@runners/application/queries/runner-resource.queries';
import { RunnerPoolResourceResponseDto } from '@runners/presentation/http/dto/runner-resource.response.dto';
import type {
  ResourceDeleted,
  ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

const KIND = 'runner-pool';

export const POOL_TOKEN_HEADER = 'Spotlight-Pool-Token';

const RunnerPoolResource = resourceApi({
  kind: KIND,
  plural: 'runner-pools',
  tag: 'runners',
  representation: RunnerPoolResourceResponseDto,
  addressExample: 'ephemeral',
});

const WRITE_ONLY_VERSION = {
  type: 'integer',
  minimum: 0,
  nullable: true,
};

const DEFINITION = ApiBody({
  schema: {
    type: 'object',
    required: ['key'],
    properties: {
      key: { type: 'string', example: 'ephemeral' },
      labels: {
        type: 'array',
        items: { type: 'string' },
        example: ['linux'],
      },
      maxRuns: {
        type: 'integer',
        minimum: 1,
        nullable: true,
        example: 8,
        description:
          'The most runs the pool serves at once; left out, no limit',
      },
      token: {
        type: 'string',
        writeOnly: true,
        minLength: 32,
        maxLength: 255,
        description:
          'Write-only, and only for a pool without provision: the token its runners claim with, kept only as a hash and never answered. Left out on create, Spotlight issues one and answers it once in Spotlight-Pool-Token',
      },
      tokenVersion: {
        ...WRITE_ONLY_VERSION,
        description:
          'Changed, with a new token, to rotate the pool token in place: the old token is refused at once, while runs already claimed keep their own one-run credentials',
      },
      provision: {
        type: 'object',
        nullable: true,
        required: ['url'],
        description:
          'Makes the pool push: Spotlight calls url with each run it is to serve, and the pool has no token. Fixed for the pool’s life',
        properties: {
          url: {
            type: 'string',
            example: 'https://provision.example.com/runs',
          },
          secret: {
            type: 'string',
            writeOnly: true,
            description:
              'Write-only: signs each call as Standard Webhooks sign, given as whsec_ and 24 to 64 base64 bytes. Required on create, and whenever secretVersion changes',
          },
          secretVersion: {
            ...WRITE_ONLY_VERSION,
            description: 'Changed to rotate the secret',
          },
        },
      },
    },
  },
});

const CREATED = ApiResponse({
  status: HttpStatus.CREATED,
  description: 'The runner pool, as a read would answer it',
  type: RunnerPoolResourceResponseDto,
  headers: {
    [ETAG_HEADER]: {
      description: 'The version answered, to send back as If-Match',
      schema: { type: 'string', example: '"0"' },
    },
    [IDEMPOTENT_REPLAY_HEADER]: {
      description: 'true when this answers an earlier attempt',
      schema: { type: 'string', enum: ['true'] },
    },
    [POOL_TOKEN_HEADER]: {
      description:
        'The pool token Spotlight issued, when none was given; answered this once and never again, not even to a retry',
      schema: { type: 'string' },
    },
  },
});

const ID = ApiParam({
  name: 'id',
  example: '3f7c2a9e-1b64-4d8f-a5e0-9c2b7d4e1f86',
});

const WORKSPACE = ApiParam({
  name: 'workspaceId',
  example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
});

interface Headed {
  setHeader(name: string, value: string): void;
}

const representation = (pool: RunnerPoolResourceDto) =>
  new RunnerPoolResourceResponseDto(pool);

@RunnerPoolResource.Controller()
export class RunnerPoolResourceController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @CREATED
  @RunnerPoolResource.Create(
    'workspaces/:workspaceId/runner-pools',
    'Define a pool of one-run runners, pulled from with a token or pushed to through provision',
  )
  @WORKSPACE
  @DEFINITION
  async create(
    @Param('workspaceId') workspaceId: string,
    @IdempotencyKeyHeader() key: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
    @Res({ passthrough: true }) response: Headed,
  ): Promise<RunnerPoolResourceResponseDto> {
    const made = await this.commandBus.execute<
      CreateRunnerPoolCommand,
      RunnerPoolCreatedDto | null
    >(new CreateRunnerPoolCommand(workspaceId, actor, key, body));
    const answered = await answerCreated(KIND, made?.created ?? null, (id) =>
      this.answer(id, actor.principal),
    );

    if (made?.token) {
      response.setHeader(POOL_TOKEN_HEADER, made.token);
    }

    return answered;
  }

  @RunnerPoolResource.Read('runner-pools/:id', 'Read a runner pool')
  @ID
  read(
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<RunnerPoolResourceResponseDto> {
    return this.answer(id, principal);
  }

  @RunnerPoolResource.Update(
    'runner-pools/:id',
    'Relabel or resize a runner pool, move where it provisions, or rotate its token or secret',
  )
  @ID
  @DEFINITION
  async update(
    @Param('id') id: string,
    @IfMatch() version: number,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<RunnerPoolResourceResponseDto> {
    return answerUpdated(
      KIND,
      await this.commandBus.execute<
        UpdateRunnerPoolCommand,
        ResourceUpdated | null
      >(new UpdateRunnerPoolCommand(id, actor, version, body)),
      (updated) => this.answer(updated, actor.principal),
    );
  }

  @RunnerPoolResource.Delete(
    'runner-pools/:id',
    'Retire a runner pool; runs its runners already hold carry on to their end',
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
        DeleteRunnerPoolCommand,
        ResourceDeleted | null
      >(new DeleteRunnerPoolCommand(id, actor, version)),
    );
  }

  @RunnerPoolResource.Import(
    'workspaces/:workspaceId/runner-pools/import',
    'Find the runner pool with a key in a workspace, to import it',
  )
  @WORKSPACE
  async import(
    @Param('workspaceId') workspaceId: string,
    @Query('address') address: string | undefined,
    @CurrentPrincipal() principal: Principal,
  ): Promise<RunnerPoolResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<
        ImportRunnerPoolQuery,
        RunnerPoolResourceDto | null
      >(new ImportRunnerPoolQuery(workspaceId, address ?? '', principal)),
      representation,
    );
  }

  @RunnerPoolResource.List(
    'workspaces/:workspaceId/runner-pools',
    'List every runner pool in a workspace',
  )
  @WORKSPACE
  async list(
    @Param('workspaceId') workspaceId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ResourceList<RunnerPoolResourceResponseDto>> {
    return listed(
      await this.queryBus.execute<
        ListRunnerPoolResourcesQuery,
        readonly RunnerPoolResourceDto[] | null
      >(new ListRunnerPoolResourcesQuery(workspaceId, principal)),
      representation,
    );
  }

  private async answer(
    id: string,
    principal: Principal,
  ): Promise<RunnerPoolResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<
        ReadRunnerPoolQuery,
        RunnerPoolResourceDto | null
      >(new ReadRunnerPoolQuery(id, principal)),
      representation,
    );
  }
}
