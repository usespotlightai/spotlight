import { CreateHarnessProfileCommand } from '@configuration/application/commands/create-harness-profile.command';
import { DeleteHarnessProfileCommand } from '@configuration/application/commands/delete-harness-profile.command';
import { UpdateHarnessProfileCommand } from '@configuration/application/commands/update-harness-profile.command';
import type { HarnessProfileResourceDto } from '@configuration/application/dto/harness-profile-resource.dto';
import { ImportHarnessProfileQuery } from '@configuration/application/queries/import-harness-profile.query';
import { ListHarnessProfileResourcesQuery } from '@configuration/application/queries/list-harness-profile-resources.query';
import { ReadHarnessProfileQuery } from '@configuration/application/queries/read-harness-profile.query';
import {
  HarnessProfileResourceResponseDto,
  MCP_SERVER_ENV,
} from '@configuration/presentation/http/dto/harness-profile-resource.response.dto';
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

const KIND = 'harness-profile';

const HarnessProfileResource = resourceApi({
  kind: KIND,
  plural: 'harness-profiles',
  tag: 'harness-profiles',
  representation: HarnessProfileResourceResponseDto,
  addressExample: 'core/careful',
});

const rules = { type: 'array', items: { type: 'string' } } as const;

const DEFINITION = ApiBody({
  schema: {
    type: 'object',
    required: ['key'],
    properties: {
      key: { type: 'string', example: 'careful' },
      permissions: {
        type: 'object',
        properties: { allow: rules, ask: rules, deny: rules },
        example: {
          allow: ['read', 'edit', 'execute(npm test *)'],
          ask: ['execute(git push *)'],
          deny: ['read(.env)'],
        },
      },
      mcpServers: {
        type: 'array',
        items: {
          type: 'object',
          required: ['name', 'command'],
          properties: {
            name: { type: 'string', example: 'linear' },
            command: { type: 'string', example: 'npx' },
            args: rules,
            env: {
              type: 'object',
              additionalProperties: { type: 'string' },
              description: MCP_SERVER_ENV,
            },
          },
        },
      },
      native: {
        type: 'object',
        additionalProperties: true,
        example: { 'claude-code': { includeCoAuthoredBy: false } },
      },
    },
  },
});

const ID = ApiParam({
  name: 'id',
  example: '3f8a2c6e-9b14-4d7a-a5e2-6c0b1d9f4e73',
});

const WORKSPACE = ApiParam({
  name: 'workspaceId',
  example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
});

const representation = (profile: HarnessProfileResourceDto) =>
  new HarnessProfileResourceResponseDto(profile);

@HarnessProfileResource.Controller()
export class HarnessProfileResourceController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @HarnessProfileResource.Create(
    'teams/:teamId/harness-profiles',
    'Define a harness profile for a team',
  )
  @ApiParam({ name: 'teamId', example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  @DEFINITION
  async create(
    @Param('teamId') teamId: string,
    @IdempotencyKeyHeader() key: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<HarnessProfileResourceResponseDto> {
    return answerCreated(
      KIND,
      await this.commandBus.execute<
        CreateHarnessProfileCommand,
        ResourceCreated | null
      >(new CreateHarnessProfileCommand(teamId, actor, key, body)),
      (id) => this.answer(id, actor.principal),
    );
  }

  @HarnessProfileResource.Read(
    'harness-profiles/:id',
    'Read a harness profile, with what each harness cannot say of it',
  )
  @ID
  read(
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HarnessProfileResourceResponseDto> {
    return this.answer(id, principal);
  }

  @HarnessProfileResource.Update(
    'harness-profiles/:id',
    'Replace a harness profile’s settings',
  )
  @ID
  @DEFINITION
  async update(
    @Param('id') id: string,
    @IfMatch() version: number,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<HarnessProfileResourceResponseDto> {
    return answerUpdated(
      KIND,
      await this.commandBus.execute<
        UpdateHarnessProfileCommand,
        ResourceUpdated | null
      >(new UpdateHarnessProfileCommand(id, actor, version, body)),
      (updated) => this.answer(updated, actor.principal),
    );
  }

  @HarnessProfileResource.Delete(
    'harness-profiles/:id',
    'Delete a harness profile no station names',
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
        DeleteHarnessProfileCommand,
        ResourceDeleted | null
      >(new DeleteHarnessProfileCommand(id, actor, version)),
    );
  }

  @HarnessProfileResource.Import(
    'workspaces/:workspaceId/harness-profiles/import',
    'Find the harness profile at an address in a workspace, to import it',
  )
  @WORKSPACE
  async import(
    @Param('workspaceId') workspaceId: string,
    @Query('address') address: string | undefined,
    @CurrentPrincipal() principal: Principal,
  ): Promise<HarnessProfileResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<
        ImportHarnessProfileQuery,
        HarnessProfileResourceDto | null
      >(new ImportHarnessProfileQuery(workspaceId, address ?? '', principal)),
      representation,
    );
  }

  @HarnessProfileResource.List(
    'workspaces/:workspaceId/harness-profiles',
    'List every harness profile in a workspace, across its teams',
  )
  @WORKSPACE
  async list(
    @Param('workspaceId') workspaceId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ResourceList<HarnessProfileResourceResponseDto>> {
    return listed(
      await this.queryBus.execute<
        ListHarnessProfileResourcesQuery,
        readonly HarnessProfileResourceDto[] | null
      >(new ListHarnessProfileResourcesQuery(workspaceId, principal)),
      representation,
    );
  }

  private async answer(
    id: string,
    principal: Principal,
  ): Promise<HarnessProfileResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<
        ReadHarnessProfileQuery,
        HarnessProfileResourceDto | null
      >(new ReadHarnessProfileQuery(id, principal)),
      representation,
    );
  }
}
