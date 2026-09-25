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
import {
  CreateRunnerTrustCommand,
  DeleteRunnerTrustCommand,
  UpdateRunnerTrustCommand,
} from '@runners/application/commands/runner-resource.commands';
import type { RunnerTrustResourceDto } from '@runners/application/dto/runner-resource.dto';
import {
  ImportRunnerTrustQuery,
  ListRunnerTrustResourcesQuery,
  ReadRunnerTrustQuery,
} from '@runners/application/queries/runner-resource.queries';
import { RunnerTrustResourceResponseDto } from '@runners/presentation/http/dto/runner-resource.response.dto';
import type {
  ResourceCreated,
  ResourceDeleted,
  ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

const KIND = 'runner-trust';

const RunnerTrustResource = resourceApi({
  kind: KIND,
  plural: 'runner-trusts',
  tag: 'runners',
  representation: RunnerTrustResourceResponseDto,
  addressExample: 'production-cluster',
});

const DEFINITION = ApiBody({
  schema: {
    type: 'object',
    required: ['key', 'issuer', 'subject'],
    properties: {
      key: { type: 'string', example: 'production-cluster' },
      issuer: {
        type: 'string',
        example: 'https://oidc.eks.eu-west-1.amazonaws.com/id/EXAMPLE',
      },
      subject: {
        type: 'string',
        example: 'system:serviceaccount:spotlight:runner',
      },
      audience: { type: 'string', default: 'spotlight' },
      labels: {
        type: 'array',
        items: { type: 'string' },
        example: ['vpc-internal'],
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

const representation = (trust: RunnerTrustResourceDto) =>
  new RunnerTrustResourceResponseDto(trust);

@RunnerTrustResource.Controller()
export class RunnerTrustResourceController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @RunnerTrustResource.Create(
    'workspaces/:workspaceId/runner-trusts',
    'Trust a platform workload to claim work as a host, with the token its platform issues',
  )
  @WORKSPACE
  @DEFINITION
  async create(
    @Param('workspaceId') workspaceId: string,
    @IdempotencyKeyHeader() key: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<RunnerTrustResourceResponseDto> {
    return answerCreated(
      KIND,
      await this.commandBus.execute<
        CreateRunnerTrustCommand,
        ResourceCreated | null
      >(new CreateRunnerTrustCommand(workspaceId, actor, key, body)),
      (id) => this.answer(id, actor.principal),
    );
  }

  @RunnerTrustResource.Read('runner-trusts/:id', 'Read a runner trust')
  @ID
  read(
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<RunnerTrustResourceResponseDto> {
    return this.answer(id, principal);
  }

  @RunnerTrustResource.Update(
    'runner-trusts/:id',
    'Change which workload a runner trust admits, or how its runners are labelled',
  )
  @ID
  @DEFINITION
  async update(
    @Param('id') id: string,
    @IfMatch() version: number,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<RunnerTrustResourceResponseDto> {
    return answerUpdated(
      KIND,
      await this.commandBus.execute<
        UpdateRunnerTrustCommand,
        ResourceUpdated | null
      >(new UpdateRunnerTrustCommand(id, actor, version, body)),
      (updated) => this.answer(updated, actor.principal),
    );
  }

  @RunnerTrustResource.Delete(
    'runner-trusts/:id',
    'Stop trusting a workload, so it can claim no more work through the trust',
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
        DeleteRunnerTrustCommand,
        ResourceDeleted | null
      >(new DeleteRunnerTrustCommand(id, actor, version)),
    );
  }

  @RunnerTrustResource.Import(
    'workspaces/:workspaceId/runner-trusts/import',
    'Find the runner trust with a key in a workspace, to import it',
  )
  @WORKSPACE
  async import(
    @Param('workspaceId') workspaceId: string,
    @Query('address') address: string | undefined,
    @CurrentPrincipal() principal: Principal,
  ): Promise<RunnerTrustResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<
        ImportRunnerTrustQuery,
        RunnerTrustResourceDto | null
      >(new ImportRunnerTrustQuery(workspaceId, address ?? '', principal)),
      representation,
    );
  }

  @RunnerTrustResource.List(
    'workspaces/:workspaceId/runner-trusts',
    'List every runner trust in a workspace',
  )
  @WORKSPACE
  async list(
    @Param('workspaceId') workspaceId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ResourceList<RunnerTrustResourceResponseDto>> {
    return listed(
      await this.queryBus.execute<
        ListRunnerTrustResourcesQuery,
        readonly RunnerTrustResourceDto[] | null
      >(new ListRunnerTrustResourcesQuery(workspaceId, principal)),
      representation,
    );
  }

  private async answer(
    id: string,
    principal: Principal,
  ): Promise<RunnerTrustResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<
        ReadRunnerTrustQuery,
        RunnerTrustResourceDto | null
      >(new ReadRunnerTrustQuery(id, principal)),
      representation,
    );
  }
}
