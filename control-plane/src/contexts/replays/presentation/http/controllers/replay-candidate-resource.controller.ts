import { Body, Param, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CurrentActor } from '@platform/http/decorators/current-actor.decorator';
import { CurrentPrincipal } from '@platform/http/decorators/current-principal.decorator';
import type { ResourceList } from '@platform/http/dto/resource-list.response.dto';
import { IdempotencyKeyHeader } from '@platform/http/resources/idempotency-key.decorator';
import { IfMatch } from '@platform/http/resources/if-match.decorator';
import {
  answerCreated,
  answerDeleted,
  found,
  listed,
} from '@platform/http/resources/resource-answers';
import { resourceApi } from '@platform/http/resources/resource-api';
import { ProposeCandidateCommand } from '@replays/application/commands/propose-candidate.command';
import { WithdrawCandidateCommand } from '@replays/application/commands/withdraw-candidate.command';
import type { CandidateResourceDto } from '@replays/application/dto/replays.dto';
import { ImportCandidateQuery } from '@replays/application/queries/import-candidate.query';
import { ListCandidatesQuery } from '@replays/application/queries/list-candidates.query';
import { ReadCandidateQuery } from '@replays/application/queries/read-candidate.query';
import { ReplayCandidateResourceResponseDto } from '@replays/presentation/http/dto/replay-candidate-resource.response.dto';
import type {
  ResourceCreated,
  ResourceDeleted,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

const KIND = 'replay-candidate';

const CandidateResource = resourceApi({
  kind: KIND,
  plural: 'replay-candidates',
  tag: 'replays',
  representation: ReplayCandidateResourceResponseDto,
  addressExample: 'core/delivery/build/Shorter prompt',
});

const PROPOSAL = ApiBody({
  schema: {
    type: 'object',
    required: ['name', 'station'],
    properties: {
      name: {
        type: 'string',
        maxLength: 100,
        example: 'Shorter prompt',
        description:
          'Tells it from the station’s other candidates; a name is proposed once per station',
      },
      station: {
        type: 'object',
        additionalProperties: true,
        description:
          'The station block to replay under, as the line resource holds a station: it keeps the station’s key, and is checked as a line with it in place would be',
        example: {
          key: 'build',
          name: 'Build',
          kind: 'work',
          harness: 'claude-code',
          prompt: 'Build it, then drain the queue.',
          passesTo: ['ship'],
        },
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

const representation = (candidate: CandidateResourceDto) =>
  new ReplayCandidateResourceResponseDto(candidate);

@CandidateResource.Controller()
export class ReplayCandidateResourceController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @CandidateResource.Create(
    'lines/:lineId/stations/:stationKey/replay-candidates',
    'Propose a station config to replay past tasks under, without applying it; candidates never change, so a changed config is a new candidate',
  )
  @ApiParam({ name: 'lineId', example: '3f7a2c9e-5d18-4b6a-8e2f-1c9d7b4a6e03' })
  @ApiParam({ name: 'stationKey', example: 'build' })
  @PROPOSAL
  async create(
    @Param('lineId') lineId: string,
    @Param('stationKey') stationKey: string,
    @IdempotencyKeyHeader() key: string,
    @Body() body: unknown,
    @CurrentActor() actor: Actor,
  ): Promise<ReplayCandidateResourceResponseDto> {
    return answerCreated(
      KIND,
      await this.commandBus.execute<
        ProposeCandidateCommand,
        ResourceCreated | null
      >(new ProposeCandidateCommand(lineId, stationKey, actor, key, body)),
      (id) => this.answer(id, actor.principal),
    );
  }

  @CandidateResource.Read(
    'replay-candidates/:id',
    'Read a candidate, with what it changes from the live config it was proposed against',
  )
  @ID
  read(
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ReplayCandidateResourceResponseDto> {
    return this.answer(id, principal);
  }

  @CandidateResource.Delete(
    'replay-candidates/:id',
    'Withdraw a proposed candidate no replay is running; replays that ran it keep their results',
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
        WithdrawCandidateCommand,
        ResourceDeleted | null
      >(new WithdrawCandidateCommand(id, actor, version)),
    );
  }

  @CandidateResource.Import(
    'workspaces/:workspaceId/replay-candidates/import',
    'Find the proposed candidate at an address in a workspace: team, line and station keys, then its name',
  )
  @WORKSPACE
  async import(
    @Param('workspaceId') workspaceId: string,
    @Query('address') address: string | undefined,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ReplayCandidateResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<
        ImportCandidateQuery,
        CandidateResourceDto | null
      >(new ImportCandidateQuery(workspaceId, address ?? '', principal)),
      representation,
    );
  }

  @CandidateResource.List(
    'workspaces/:workspaceId/replay-candidates',
    'List the proposed candidates of the teams you may read in a workspace, or of one station; Spotlight’s live snapshots show only in the replays that ran them',
  )
  @WORKSPACE
  @ApiQuery({
    name: 'station',
    required: false,
    example: 'core/delivery/build',
    description:
      'Only the candidates of this station: its team, line and station keys',
  })
  async list(
    @Param('workspaceId') workspaceId: string,
    @Query('station') station: string | undefined,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ResourceList<ReplayCandidateResourceResponseDto>> {
    return listed(
      await this.queryBus.execute<
        ListCandidatesQuery,
        readonly CandidateResourceDto[] | null
      >(new ListCandidatesQuery(workspaceId, station ?? null, principal)),
      representation,
    );
  }

  private async answer(
    id: string,
    principal: Principal,
  ): Promise<ReplayCandidateResourceResponseDto> {
    return found(
      KIND,
      await this.queryBus.execute<
        ReadCandidateQuery,
        CandidateResourceDto | null
      >(new ReadCandidateQuery(id, principal)),
      representation,
    );
  }
}
