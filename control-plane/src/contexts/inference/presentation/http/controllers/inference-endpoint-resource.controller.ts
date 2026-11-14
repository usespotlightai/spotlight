import {
  CreateInferenceEndpointCommand,
  DeleteInferenceEndpointCommand,
  TestInferenceEndpointCommand,
  UpdateInferenceEndpointCommand,
} from '@inference/application/commands/inference-endpoint.commands';
import type {
  ConnectionTested,
  InferenceEndpointResourceDto,
} from '@inference/application/dto/inference-endpoint-resource.dto';
import {
  ImportInferenceEndpointQuery,
  ListInferenceEndpointResourcesQuery,
  ReadInferenceEndpointQuery,
} from '@inference/application/queries/inference-endpoint.queries';
import {
  ConnectionTestResponseDto,
  InferenceEndpointResourceResponseDto,
} from '@inference/presentation/http/dto/inference-endpoint-resource.response.dto';
import { Body, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBody, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { CurrentActor } from '@platform/http/decorators/current-actor.decorator';
import { CurrentPrincipal } from '@platform/http/decorators/current-principal.decorator';
import type { ResourceList } from '@platform/http/dto/resource-list.response.dto';
import { ApiProblemResponse } from '@platform/http/resources/conventional-api';
import { IdempotencyKeyHeader } from '@platform/http/resources/idempotency-key.decorator';
import { IfMatch } from '@platform/http/resources/if-match.decorator';
import { ProblemException } from '@platform/http/resources/problem.exception';
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

const KIND = 'inference-endpoint';

const InferenceEndpointResource = resourceApi({
  kind: KIND,
  plural: 'inference-endpoints',
  tag: 'inference',
  representation: InferenceEndpointResourceResponseDto,
  addressExample: 'acme',
});

const DEFINITION = ApiBody({
  schema: {
    type: 'object',
    required: ['baseUrl', 'model'],
    properties: {
      baseUrl: { type: 'string', example: 'https://openrouter.ai/api/v1' },
      model: { type: 'string', example: 'openai/gpt-5-mini' },
      supportsReasoningEffort: { type: 'boolean', default: false },
      apiKeyWo: {
        type: 'string',
        writeOnly: true,
        description:
          'The API key to store; accepted on create and whenever it is sent, and never returned',
      },
      apiKeyWoVersion: {
        type: 'integer',
        minimum: 0,
        example: 1,
        description: 'Change it to rotate the key to the apiKeyWo sent with it',
      },
    },
  },
});

const ID = ApiParam({
  name: 'id',
  example: '6e2b8f1d-4c93-4a7e-8d5b-1f0c9a3e7b62',
});

const WORKSPACE = ApiParam({
  name: 'workspaceId',
  example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
});

const representation = (endpoint: InferenceEndpointResourceDto) =>
  new InferenceEndpointResourceResponseDto(endpoint);

@InferenceEndpointResource.Controller()
export class InferenceEndpointResourceController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @InferenceEndpointResource.Create(
    'workspaces/:workspaceId/inference-endpoints',
    'Create the inference endpoint: the OpenAI-compatible API and model a workspace uses for Spotlight features',
  )
  @WORKSPACE
  @DEFINITION
  async create(
    @Param('workspaceId') workspaceId: string,
    @IdempotencyKeyHeader() key: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<InferenceEndpointResourceResponseDto> {
    return respondCreated(
      KIND,
      await this.commandBus.execute<
        CreateInferenceEndpointCommand,
        ResourceCreated | null
      >(new CreateInferenceEndpointCommand(workspaceId, actor, key, body)),
      (id) => this.toResponse(id, actor.principal),
    );
  }

  @InferenceEndpointResource.Read(
    'inference-endpoints/:id',
    'Read the inference endpoint of a workspace. The API key is never returned',
  )
  @ID
  read(
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<InferenceEndpointResourceResponseDto> {
    return this.toResponse(id, principal);
  }

  @InferenceEndpointResource.Update(
    'inference-endpoints/:id',
    'Update the inference endpoint',
  )
  @ID
  @DEFINITION
  async update(
    @Param('id') id: string,
    @IfMatch() version: number,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<InferenceEndpointResourceResponseDto> {
    return respondUpdated(
      KIND,
      await this.commandBus.execute<
        UpdateInferenceEndpointCommand,
        ResourceUpdated | null
      >(new UpdateInferenceEndpointCommand(id, actor, version, body)),
      (updated) => this.toResponse(updated, actor.principal),
    );
  }

  @InferenceEndpointResource.Delete(
    'inference-endpoints/:id',
    'Delete the inference endpoint and its API key. Spotlight features that need a model then turn off',
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
        DeleteInferenceEndpointCommand,
        ResourceDeleted | null
      >(new DeleteInferenceEndpointCommand(id, actor, version)),
    );
  }

  @InferenceEndpointResource.Import(
    'workspaces/:workspaceId/inference-endpoints/import',
    'Find the inference endpoint of a workspace, by its slug, to import it',
  )
  @WORKSPACE
  async import(
    @Param('workspaceId') workspaceId: string,
    @Query('address') address: string | undefined,
    @CurrentPrincipal() principal: Principal,
  ): Promise<InferenceEndpointResourceResponseDto> {
    return respondFound(
      KIND,
      await this.queryBus.execute<
        ImportInferenceEndpointQuery,
        InferenceEndpointResourceDto | null
      >(
        new ImportInferenceEndpointQuery(workspaceId, address ?? '', principal),
      ),
      representation,
    );
  }

  @InferenceEndpointResource.List(
    'workspaces/:workspaceId/inference-endpoints',
    'List the inference endpoint of a workspace: one, or none',
  )
  @WORKSPACE
  async list(
    @Param('workspaceId') workspaceId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ResourceList<InferenceEndpointResourceResponseDto>> {
    return respondListed(
      await this.queryBus.execute<
        ListInferenceEndpointResourcesQuery,
        readonly InferenceEndpointResourceDto[] | null
      >(new ListInferenceEndpointResourcesQuery(workspaceId, principal)),
      representation,
    );
  }

  @Post('workspaces/:workspaceId/inference-endpoint/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'testInferenceEndpoint',
    summary:
      'Send one minimal request to an inference endpoint and report what happened. Saves nothing. Without apiKeyWo it uses the stored key',
  })
  @ApiResponse({ status: HttpStatus.OK, type: ConnectionTestResponseDto })
  @ApiProblemResponse(
    HttpStatus.NOT_FOUND,
    'No such workspace that you may see',
  )
  @ApiProblemResponse(
    HttpStatus.FORBIDDEN,
    'Not allowed to test the inference endpoint; the detail says why',
  )
  @ApiProblemResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'What is wrong, field by field',
  )
  @WORKSPACE
  @DEFINITION
  async test(
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<ConnectionTestResponseDto> {
    const tested = await this.commandBus.execute<
      TestInferenceEndpointCommand,
      ConnectionTested | null
    >(new TestInferenceEndpointCommand(workspaceId, actor, body));

    switch (tested?.outcome) {
      case 'tested':
        return new ConnectionTestResponseDto(tested.ok, tested.message);
      case 'invalid':
        throw ProblemException.invalid(KIND, tested.problems);
      case 'forbidden':
        throw ProblemException.forbidden(KIND, tested.act);
      case undefined:
        throw ProblemException.notFound('workspace');
    }
  }

  private async toResponse(
    id: string,
    principal: Principal,
  ): Promise<InferenceEndpointResourceResponseDto> {
    return respondFound(
      KIND,
      await this.queryBus.execute<
        ReadInferenceEndpointQuery,
        InferenceEndpointResourceDto | null
      >(new ReadInferenceEndpointQuery(id, principal)),
      representation,
    );
  }
}
