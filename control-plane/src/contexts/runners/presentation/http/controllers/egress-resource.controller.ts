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
  CreateEgressCommand,
  DeleteEgressCommand,
  UpdateEgressCommand,
} from '@runners/application/commands/runner-resource.commands';
import type {
  EgressCreatedDto,
  EgressResourceDto,
} from '@runners/application/dto/runner-resource.dto';
import {
  ImportEgressQuery,
  ListEgressResourcesQuery,
  ReadEgressQuery,
} from '@runners/application/queries/runner-resource.queries';
import { EgressResourceResponseDto } from '@runners/presentation/http/dto/runner-resource.response.dto';
import type {
  ResourceDeleted,
  ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

const KIND = 'egress';

export const EGRESS_TOKEN_HEADER = 'Spotlight-Egress-Token';

const EgressResource = resourceApi({
  kind: KIND,
  plural: 'egresses',
  tag: 'runners',
  representation: EgressResourceResponseDto,
  addressExample: 'shared',
});

const DEFINITION = ApiBody({
  schema: {
    type: 'object',
    required: ['key', 'url'],
    properties: {
      key: { type: 'string', example: 'shared' },
      url: {
        type: 'string',
        example: 'https://egress.example.com',
        description:
          'Where the runners of a pool that names this egress send their traffic',
      },
      token: {
        type: 'string',
        writeOnly: true,
        minLength: 32,
        maxLength: 255,
        description:
          'Write-only: the token the egress calls Spotlight with, kept only as a hash and never answered. Left out on create, Spotlight issues one and answers it once in Spotlight-Egress-Token',
      },
      tokenVersion: {
        type: 'integer',
        minimum: 0,
        nullable: true,
        description:
          'Changed, with a new token, to rotate the egress token in place: the old token stops working at once',
      },
    },
  },
});

const CREATED = ApiResponse({
  status: HttpStatus.CREATED,
  description: 'The egress, as a read would answer it',
  type: EgressResourceResponseDto,
  headers: {
    [ETAG_HEADER]: {
      description: 'The version answered, to send back as If-Match',
      schema: { type: 'string', example: '"0"' },
    },
    [IDEMPOTENT_REPLAY_HEADER]: {
      description: 'true when this answers an earlier attempt',
      schema: { type: 'string', enum: ['true'] },
    },
    [EGRESS_TOKEN_HEADER]: {
      description:
        'The egress token Spotlight issued, when none was given; answered this once and never again, not even to a retry',
      schema: { type: 'string' },
    },
  },
});

const ID = ApiParam({
  name: 'id',
  example: '8d2e4f6a-3c71-4b9e-a0d5-7e1f2c9b4a63',
});

const WORKSPACE = ApiParam({
  name: 'workspaceId',
  example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
});

interface Headed {
  setHeader(name: string, value: string): void;
}

const representation = (egress: EgressResourceDto) =>
  new EgressResourceResponseDto(egress);

@EgressResource.Controller()
export class EgressResourceController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @CREATED
  @EgressResource.Create(
    'workspaces/:workspaceId/egresses',
    'Create an egress that the runners of push pools send their traffic through',
  )
  @WORKSPACE
  @DEFINITION
  async create(
    @Param('workspaceId') workspaceId: string,
    @IdempotencyKeyHeader() key: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
    @Res({ passthrough: true }) response: Headed,
  ): Promise<EgressResourceResponseDto> {
    const made = await this.commandBus.execute<
      CreateEgressCommand,
      EgressCreatedDto | null
    >(new CreateEgressCommand(workspaceId, actor, key, body));
    const answered = await answerCreated(KIND, made?.created ?? null, (id) =>
      this.answer(id, actor.principal),
    );

    if (made?.token) {
      response.setHeader(EGRESS_TOKEN_HEADER, made.token);
    }

    return answered;
  }

  @EgressResource.Read('egresses/:id', 'Read an egress')
  @ID
  read(
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<EgressResourceResponseDto> {
    return this.answer(id, principal);
  }

  @EgressResource.Update(
    'egresses/:id',
    'Move an egress to another URL, or rotate its token',
  )
  @ID
  @DEFINITION
  async update(
    @Param('id') id: string,
    @IfMatch() version: number,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<EgressResourceResponseDto> {
    return answerUpdated(
      KIND,
      await this.commandBus.execute<
        UpdateEgressCommand,
        ResourceUpdated | null
      >(new UpdateEgressCommand(id, actor, version, body)),
      (updated) => this.answer(updated, actor.principal),
    );
  }

  @EgressResource.Delete(
    'egresses/:id',
    'Delete an egress that no runner pool names',
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
        DeleteEgressCommand,
        ResourceDeleted | null
      >(new DeleteEgressCommand(id, actor, version)),
    );
  }

  @EgressResource.Import(
    'workspaces/:workspaceId/egresses/import',
    'Find the egress with a key in a workspace, to import it',
  )
  @WORKSPACE
  async import(
    @Param('workspaceId') workspaceId: string,
    @Query('address') address: string | undefined,
    @CurrentPrincipal() principal: Principal,
  ): Promise<EgressResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<ImportEgressQuery, EgressResourceDto | null>(
        new ImportEgressQuery(workspaceId, address ?? '', principal),
      ),
      representation,
    );
  }

  @EgressResource.List(
    'workspaces/:workspaceId/egresses',
    'List every egress in a workspace',
  )
  @WORKSPACE
  async list(
    @Param('workspaceId') workspaceId: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ResourceList<EgressResourceResponseDto>> {
    return listed(
      await this.queryBus.execute<
        ListEgressResourcesQuery,
        readonly EgressResourceDto[] | null
      >(new ListEgressResourcesQuery(workspaceId, principal)),
      representation,
    );
  }

  private async answer(
    id: string,
    principal: Principal,
  ): Promise<EgressResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<ReadEgressQuery, EgressResourceDto | null>(
        new ReadEgressQuery(id, principal),
      ),
      representation,
    );
  }
}
