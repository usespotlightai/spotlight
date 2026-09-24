import { Body, HttpStatus, Param, Query, Res } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBody, ApiParam, ApiResponse } from '@nestjs/swagger';
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
  ETAG_HEADER,
  IDEMPOTENT_REPLAY_HEADER,
} from '@platform/http/resources/resource-headers';
import {
  CreateRunnerCommand,
  DeleteRunnerCommand,
  UpdateRunnerCommand,
} from '@runners/application/commands/runner-resource.commands';
import type {
  RunnerCreatedDto,
  RunnerResourceDto,
} from '@runners/application/dto/runner-resource.dto';
import {
  ImportRunnerQuery,
  ReadRunnerQuery,
} from '@runners/application/queries/runner-resource.queries';
import { RunnerResourceResponseDto } from '@runners/presentation/http/dto/runner-resource.response.dto';
import type {
  ResourceDeleted,
  ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

const KIND = 'runner';

export const RUNNER_TOKEN_HEADER = 'Spotlight-Runner-Token';

const RunnerResource = resourceApi({
  kind: KIND,
  tag: 'runners',
  representation: RunnerResourceResponseDto,
  addressExample: 'build-1',
});

const DEFINITION = ApiBody({
  schema: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', example: 'build-1' },
      labels: {
        type: 'array',
        items: { type: 'string' },
        example: ['vpc-internal'],
      },
      token: {
        type: 'string',
        writeOnly: true,
        minLength: 32,
        maxLength: 255,
        description:
          'Write-only: the token the runner will call with, kept only as a hash and never answered. Left out on create, Spotlight issues one and answers it once in Spotlight-Runner-Token; given on update, it replaces the runner token',
      },
    },
  },
});

const CREATED = ApiResponse({
  status: HttpStatus.CREATED,
  description: 'The runner, as a read would answer it',
  type: RunnerResourceResponseDto,
  headers: {
    [ETAG_HEADER]: {
      description: 'The version answered, to send back as If-Match',
      schema: { type: 'string', example: '"0"' },
    },
    [IDEMPOTENT_REPLAY_HEADER]: {
      description: 'true when this answers an earlier attempt',
      schema: { type: 'string', enum: ['true'] },
    },
    [RUNNER_TOKEN_HEADER]: {
      description:
        'The token Spotlight issued, when the create gave none; answered this once and never again, not even to a retry',
      schema: { type: 'string' },
    },
  },
});

const ID = ApiParam({
  name: 'id',
  example: '8a1d4e0b-6c72-4f35-9b8a-1e5d3c7f2a49',
});

const WORKSPACE = ApiParam({
  name: 'workspaceId',
  example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
});

interface Headed {
  setHeader(name: string, value: string): void;
}

const representation = (runner: RunnerResourceDto) =>
  new RunnerResourceResponseDto(runner);

@RunnerResource.Controller()
export class RunnerResourceController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @CREATED
  @RunnerResource.Create(
    'workspaces/:workspaceId/runners',
    'Enrol a runner that calls with a token',
  )
  @WORKSPACE
  @DEFINITION
  async create(
    @Param('workspaceId') workspaceId: string,
    @IdempotencyKeyHeader() key: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
    @Res({ passthrough: true }) response: Headed,
  ): Promise<RunnerResourceResponseDto> {
    const made = await this.commandBus.execute<
      CreateRunnerCommand,
      RunnerCreatedDto | null
    >(new CreateRunnerCommand(workspaceId, actor, key, body));
    const answered = await answerCreated(KIND, made?.created ?? null, (id) =>
      this.answer(id, actor.principal),
    );

    if (made?.token) {
      response.setHeader(RUNNER_TOKEN_HEADER, made.token);
    }

    return answered;
  }

  @RunnerResource.Read('runners/:id', 'Read a runner')
  @ID
  read(
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<RunnerResourceResponseDto> {
    return this.answer(id, principal);
  }

  @RunnerResource.Update(
    'runners/:id',
    'Relabel a runner, or give it a new token',
  )
  @ID
  @DEFINITION
  async update(
    @Param('id') id: string,
    @IfMatch() version: number,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<RunnerResourceResponseDto> {
    return answerUpdated(
      KIND,
      await this.commandBus.execute<
        UpdateRunnerCommand,
        ResourceUpdated | null
      >(new UpdateRunnerCommand(id, actor, version, body)),
      (updated) => this.answer(updated, actor.principal),
    );
  }

  @RunnerResource.Delete(
    'runners/:id',
    'Revoke a runner, putting back whatever it was running',
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
        DeleteRunnerCommand,
        ResourceDeleted | null
      >(new DeleteRunnerCommand(id, actor, version)),
    );
  }

  @RunnerResource.Import(
    'workspaces/:workspaceId/runners/import',
    'Find the runner with a name in a workspace, to import it',
  )
  @WORKSPACE
  async import(
    @Param('workspaceId') workspaceId: string,
    @Query('address') address: string | undefined,
    @CurrentPrincipal() principal: Principal,
  ): Promise<RunnerResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<ImportRunnerQuery, RunnerResourceDto | null>(
        new ImportRunnerQuery(workspaceId, address ?? '', principal),
      ),
      representation,
    );
  }

  private async answer(
    id: string,
    principal: Principal,
  ): Promise<RunnerResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<ReadRunnerQuery, RunnerResourceDto | null>(
        new ReadRunnerQuery(id, principal),
      ),
      representation,
    );
  }
}
