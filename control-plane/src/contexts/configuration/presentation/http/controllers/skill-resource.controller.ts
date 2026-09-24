import { CreateSkillCommand } from '@configuration/application/commands/create-skill.command';
import { DeleteSkillCommand } from '@configuration/application/commands/delete-skill.command';
import { UpdateSkillCommand } from '@configuration/application/commands/update-skill.command';
import type { SkillResourceDto } from '@configuration/application/dto/skill-resource.dto';
import { ImportSkillQuery } from '@configuration/application/queries/import-skill.query';
import { ListSkillResourcesQuery } from '@configuration/application/queries/list-skill-resources.query';
import { ReadSkillQuery } from '@configuration/application/queries/read-skill.query';
import { SkillResourceResponseDto } from '@configuration/presentation/http/dto/skill-resource.response.dto';
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

const KIND = 'skill';

const SkillResource = resourceApi({
  kind: KIND,
  plural: 'skills',
  tag: 'skills',
  representation: SkillResourceResponseDto,
  addressExample: 'core/grafana',
});

const DEFINITION = ApiBody({
  schema: {
    type: 'object',
    required: ['key', 'files'],
    properties: {
      key: { type: 'string', example: 'grafana' },
      files: {
        type: 'object',
        additionalProperties: { type: 'string' },
        example: {
          'SKILL.md':
            '---\nname: grafana\ndescription: Look up dashboards\n---\nSearch before you guess.',
        },
      },
    },
  },
});

const ID = ApiParam({
  name: 'id',
  example: '7e4b1a9d-2c5f-4d3e-8b6a-0f9c2d7e5a18',
});

const WORKSPACE = ApiParam({
  name: 'workspaceId',
  example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
});

const representation = (skill: SkillResourceDto) =>
  new SkillResourceResponseDto(skill);

@SkillResource.Controller()
export class SkillResourceController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @SkillResource.Create('teams/:teamId/skills', 'Define a skill for a team')
  @ApiParam({ name: 'teamId', example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  @DEFINITION
  async create(
    @Param('teamId') teamId: string,
    @IdempotencyKeyHeader() key: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<SkillResourceResponseDto> {
    return answerCreated(
      KIND,
      await this.commandBus.execute<CreateSkillCommand, ResourceCreated | null>(
        new CreateSkillCommand(teamId, actor, key, body),
      ),
      (id) => this.answer(id, actor.principal),
    );
  }

  @SkillResource.Read('skills/:id', 'Read a skill, files and all')
  @ID
  read(
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<SkillResourceResponseDto> {
    return this.answer(id, principal);
  }

  @SkillResource.Update('skills/:id', 'Replace a skill’s files')
  @ID
  @DEFINITION
  async update(
    @Param('id') id: string,
    @IfMatch() version: number,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<SkillResourceResponseDto> {
    return answerUpdated(
      KIND,
      await this.commandBus.execute<UpdateSkillCommand, ResourceUpdated | null>(
        new UpdateSkillCommand(id, actor, version, body),
      ),
      (updated) => this.answer(updated, actor.principal),
    );
  }

  @SkillResource.Delete('skills/:id', 'Delete a skill no station gives')
  @ID
  async delete(
    @Param('id') id: string,
    @IfMatch() version: number,
    @CurrentActor() actor: Actor,
  ): Promise<void> {
    answerDeleted(
      KIND,
      await this.commandBus.execute<DeleteSkillCommand, ResourceDeleted | null>(
        new DeleteSkillCommand(id, actor, version),
      ),
    );
  }

  @SkillResource.Import(
    'workspaces/:workspaceId/skills/import',
    'Find the skill at an address in a workspace, to import it',
  )
  @WORKSPACE
  async import(
    @Param('workspaceId') workspaceId: string,
    @Query('address') address: string | undefined,
    @CurrentPrincipal() principal: Principal,
  ): Promise<SkillResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<ImportSkillQuery, SkillResourceDto | null>(
        new ImportSkillQuery(workspaceId, address ?? '', principal),
      ),
      representation,
    );
  }

  @SkillResource.List(
    'workspaces/:workspaceId/skills',
    'List every skill in a workspace, across its teams, files and all',
  )
  @WORKSPACE
  async list(
    @Param('workspaceId') workspaceId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ResourceList<SkillResourceResponseDto>> {
    return listed(
      await this.queryBus.execute<
        ListSkillResourcesQuery,
        readonly SkillResourceDto[] | null
      >(new ListSkillResourcesQuery(workspaceId, principal)),
      representation,
    );
  }

  private async answer(
    id: string,
    principal: Principal,
  ): Promise<SkillResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<ReadSkillQuery, SkillResourceDto | null>(
        new ReadSkillQuery(id, principal),
      ),
      representation,
    );
  }
}
