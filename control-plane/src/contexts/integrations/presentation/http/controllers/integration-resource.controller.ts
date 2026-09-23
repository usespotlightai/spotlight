import { CreateIntegrationCommand } from '@integrations/application/commands/create-integration.command';
import { DeleteIntegrationCommand } from '@integrations/application/commands/delete-integration.command';
import { UpdateIntegrationCommand } from '@integrations/application/commands/update-integration.command';
import type {
  IntegrationCreatedDto,
  IntegrationDeletedDto,
  IntegrationResourceDto,
  IntegrationUpdatedDto,
} from '@integrations/application/dto/integration-resource.dto';
import { ImportIntegrationQuery } from '@integrations/application/queries/import-integration.query';
import { ReadIntegrationQuery } from '@integrations/application/queries/read-integration.query';
import { IntegrationResourceResponseDto } from '@integrations/presentation/http/dto/integration-resource.response.dto';
import { Body, Param, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBody, ApiParam } from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import { IdempotencyKeyHeader } from '@platform/http/resources/idempotency-key.decorator';
import { IfMatch } from '@platform/http/resources/if-match.decorator';
import { ProblemException } from '@platform/http/resources/problem.exception';
import { replayed } from '@platform/http/resources/replayed';
import { resourceApi } from '@platform/http/resources/resource-api';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';

const KIND = 'integration';

const IntegrationResource = resourceApi({
  kind: KIND,
  tag: 'integrations',
  representation: IntegrationResourceResponseDto,
  addressExample: 'core/linear',
});

const DEFINITION = ApiBody({
  schema: {
    type: 'object',
    additionalProperties: true,
    example: {
      integration: 'linear',
      actions: {
        comment: {
          request: { method: 'POST', url: 'https://api.linear.app/graphql' },
        },
      },
    },
  },
});

const ID = ApiParam({
  name: 'id',
  example: '0d6f3c1e-8a52-4f7b-9c1d-5e2a7b3f9c40',
});

const found = (
  integration: IntegrationResourceDto | null,
): IntegrationResourceResponseDto => {
  if (!integration) {
    throw ProblemException.notFound(KIND);
  }

  return new IntegrationResourceResponseDto(integration);
};

const refused = (
  outcome:
    | { readonly outcome: 'moved-on'; readonly currentVersion: number }
    | { readonly outcome: 'in-use'; readonly reason: string },
): never => {
  throw outcome.outcome === 'moved-on'
    ? ProblemException.movedOn(KIND, outcome.currentVersion)
    : ProblemException.inUse(KIND, outcome.reason);
};

@IntegrationResource.Controller()
export class IntegrationResourceController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @IntegrationResource.Create(
    'teams/:teamId/integrations',
    'Create an integration for a team',
  )
  @ApiParam({ name: 'teamId', example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  @DEFINITION
  async create(
    @Param('teamId') teamId: string,
    @IdempotencyKeyHeader() key: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IntegrationResourceResponseDto> {
    const created = await this.commandBus.execute<
      CreateIntegrationCommand,
      IntegrationCreatedDto | null
    >(new CreateIntegrationCommand(teamId, user.id, key, body));

    switch (created?.outcome) {
      case 'created': {
        const answered = await this.answer(created.id, user);

        return created.replayed ? replayed(answered) : answered;
      }
      case 'invalid':
        throw ProblemException.invalid(KIND, created.problems);
      case 'taken':
        throw ProblemException.taken(KIND, created.address);
      case 'key-reused':
        throw ProblemException.idempotencyKeyReused();
      default:
        throw ProblemException.notFound(KIND);
    }
  }

  @IntegrationResource.Read('integrations/:id', 'Read an integration')
  @ID
  read(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IntegrationResourceResponseDto> {
    return this.answer(id, user);
  }

  @IntegrationResource.Update(
    'integrations/:id',
    'Replace an integration’s definition',
  )
  @ID
  @DEFINITION
  async update(
    @Param('id') id: string,
    @IfMatch() version: number,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IntegrationResourceResponseDto> {
    const updated = await this.commandBus.execute<
      UpdateIntegrationCommand,
      IntegrationUpdatedDto | null
    >(new UpdateIntegrationCommand(id, user.id, version, body));

    if (!updated) {
      throw ProblemException.notFound(KIND);
    }

    switch (updated.outcome) {
      case 'updated':
        return this.answer(updated.id, user);
      case 'invalid':
        throw ProblemException.invalid(KIND, updated.problems);
      default:
        return refused(updated);
    }
  }

  @IntegrationResource.Delete('integrations/:id', 'Delete an integration')
  @ID
  async delete(
    @Param('id') id: string,
    @IfMatch() version: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const deleted = await this.commandBus.execute<
      DeleteIntegrationCommand,
      IntegrationDeletedDto | null
    >(new DeleteIntegrationCommand(id, user.id, version));

    if (!deleted) {
      throw ProblemException.notFound(KIND);
    }

    if (deleted.outcome !== 'deleted') {
      refused(deleted);
    }
  }

  @IntegrationResource.Import(
    'workspaces/:slug/integrations/import',
    'Find the integration at an address in a workspace, to import it',
  )
  @ApiParam({ name: 'slug', example: 'acme' })
  async import(
    @Param('slug') slug: string,
    @Query('address') address: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IntegrationResourceResponseDto> {
    return found(
      await this.queryBus.execute<
        ImportIntegrationQuery,
        IntegrationResourceDto | null
      >(new ImportIntegrationQuery(slug, address ?? '', user.id)),
    );
  }

  private async answer(
    id: string,
    user: AuthenticatedUser,
  ): Promise<IntegrationResourceResponseDto> {
    return found(
      await this.queryBus.execute<
        ReadIntegrationQuery,
        IntegrationResourceDto | null
      >(new ReadIntegrationQuery(id, user.id)),
    );
  }
}
