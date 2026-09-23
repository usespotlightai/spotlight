import { CreateTeamCommand } from '@identity/application/commands/create-team.command';
import { DeleteTeamCommand } from '@identity/application/commands/delete-team.command';
import { UpdateTeamCommand } from '@identity/application/commands/update-team.command';
import type { TeamResourceDto } from '@identity/application/dto/team-resource.dto';
import { ImportTeamQuery } from '@identity/application/queries/import-team.query';
import { ReadTeamQuery } from '@identity/application/queries/read-team.query';
import { TeamResourceResponseDto } from '@identity/presentation/http/dto/team-resource.response.dto';
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

const KIND = 'team';

const TeamResource = resourceApi({
  kind: KIND,
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
    'Create a team in a workspace, holding nothing yet',
  )
  @WORKSPACE
  @DEFINITION
  async create(
    @Param('workspaceId') workspaceId: string,
    @IdempotencyKeyHeader() key: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeamResourceResponseDto> {
    return answerCreated(
      KIND,
      await this.commandBus.execute<CreateTeamCommand, ResourceCreated | null>(
        new CreateTeamCommand(workspaceId, user.id, key, body),
      ),
      (id) => this.answer(id, user),
    );
  }

  @TeamResource.Read('teams/:id', 'Read a team')
  @ID
  read(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeamResourceResponseDto> {
    return this.answer(id, user);
  }

  @TeamResource.Update('teams/:id', 'Rename a team')
  @ID
  @DEFINITION
  async update(
    @Param('id') id: string,
    @IfMatch() version: number,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeamResourceResponseDto> {
    return answerUpdated(
      KIND,
      await this.commandBus.execute<UpdateTeamCommand, ResourceUpdated | null>(
        new UpdateTeamCommand(id, user.id, version, body),
      ),
      (updated) => this.answer(updated, user),
    );
  }

  @TeamResource.Delete(
    'teams/:id',
    'Delete a team that holds no lines, skills or integrations',
  )
  @ID
  async delete(
    @Param('id') id: string,
    @IfMatch() version: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    answerDeleted(
      KIND,
      await this.commandBus.execute<DeleteTeamCommand, ResourceDeleted | null>(
        new DeleteTeamCommand(id, user.id, version),
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
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeamResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<ImportTeamQuery, TeamResourceDto | null>(
        new ImportTeamQuery(workspaceId, address ?? '', user.id),
      ),
      representation,
    );
  }

  private async answer(
    id: string,
    user: AuthenticatedUser,
  ): Promise<TeamResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<ReadTeamQuery, TeamResourceDto | null>(
        new ReadTeamQuery(id, user.id),
      ),
      representation,
    );
  }
}
