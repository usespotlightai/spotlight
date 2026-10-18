import { CreateTeamCommand } from '@identity/application/commands/create-team.command';
import { DeleteTeamCommand } from '@identity/application/commands/delete-team.command';
import { UpdateTeamCommand } from '@identity/application/commands/update-team.command';
import type { TeamResourceDto } from '@identity/application/dto/team-resource.dto';
import { ImportTeamQuery } from '@identity/application/queries/import-team.query';
import { ListTeamResourcesQuery } from '@identity/application/queries/list-team-resources.query';
import { ReadTeamQuery } from '@identity/application/queries/read-team.query';
import { TeamResourceResponseDto } from '@identity/presentation/http/dto/team-resource.response.dto';
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

const KIND = 'team';

const TeamResource = resourceApi({
  kind: KIND,
  plural: 'teams',
  tag: 'teams',
  representation: TeamResourceResponseDto,
  addressExample: 'core',
});

const DEFINITION = ApiBody({
  schema: {
    type: 'object',
    required: ['key', 'name'],
    properties: {
      key: { type: 'string', example: 'core' },
      name: { type: 'string', example: 'Core' },
    },
  },
});

const ID = ApiParam({
  name: 'id',
  example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84',
});

const WORKSPACE = ApiParam({
  name: 'workspaceId',
  example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
});

const representation = (team: TeamResourceDto) =>
  new TeamResourceResponseDto(team);

@TeamResource.Controller()
export class TeamResourceController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @TeamResource.Create(
    'workspaces/:workspaceId/teams',
    'Create a team in a workspace, with nothing in it yet',
  )
  @WORKSPACE
  @DEFINITION
  async create(
    @Param('workspaceId') workspaceId: string,
    @IdempotencyKeyHeader() key: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<TeamResourceResponseDto> {
    return respondCreated(
      KIND,
      await this.commandBus.execute<CreateTeamCommand, ResourceCreated | null>(
        new CreateTeamCommand(workspaceId, actor, key, body),
      ),
      (id) => this.toResponse(id, actor.principal),
    );
  }

  @TeamResource.Read('teams/:id', 'Read a team')
  @ID
  read(
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<TeamResourceResponseDto> {
    return this.toResponse(id, principal);
  }

  @TeamResource.Update('teams/:id', 'Rename a team')
  @ID
  @DEFINITION
  async update(
    @Param('id') id: string,
    @IfMatch() version: number,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<TeamResourceResponseDto> {
    return respondUpdated(
      KIND,
      await this.commandBus.execute<UpdateTeamCommand, ResourceUpdated | null>(
        new UpdateTeamCommand(id, actor, version, body),
      ),
      (updated) => this.toResponse(updated, actor.principal),
    );
  }

  @TeamResource.Delete(
    'teams/:id',
    'Delete a team that has no lines, skills or integrations',
  )
  @ID
  async delete(
    @Param('id') id: string,
    @IfMatch() version: number,
    @CurrentActor() actor: Actor,
  ): Promise<void> {
    respondDeleted(
      KIND,
      await this.commandBus.execute<DeleteTeamCommand, ResourceDeleted | null>(
        new DeleteTeamCommand(id, actor, version),
      ),
    );
  }

  @TeamResource.Import(
    'workspaces/:workspaceId/teams/import',
    'Find the team with a key in a workspace, to import it',
  )
  @WORKSPACE
  async import(
    @Param('workspaceId') workspaceId: string,
    @Query('address') address: string | undefined,
    @CurrentPrincipal() principal: Principal,
  ): Promise<TeamResourceResponseDto> {
    return respondFound(
      KIND,
      await this.queryBus.execute<ImportTeamQuery, TeamResourceDto | null>(
        new ImportTeamQuery(workspaceId, address ?? '', principal),
      ),
      representation,
    );
  }

  @TeamResource.List(
    'workspaces/:workspaceId/teams',
    'List every team in a workspace',
  )
  @WORKSPACE
  async list(
    @Param('workspaceId') workspaceId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ResourceList<TeamResourceResponseDto>> {
    return respondListed(
      await this.queryBus.execute<
        ListTeamResourcesQuery,
        readonly TeamResourceDto[] | null
      >(new ListTeamResourcesQuery(workspaceId, principal)),
      representation,
    );
  }

  private async toResponse(
    id: string,
    principal: Principal,
  ): Promise<TeamResourceResponseDto> {
    return respondFound(
      KIND,
      await this.queryBus.execute<ReadTeamQuery, TeamResourceDto | null>(
        new ReadTeamQuery(id, principal),
      ),
      representation,
    );
  }
}
