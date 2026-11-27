import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Put,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { AllowWorkspaceTokens } from '@platform/http/decorators/allow-workspace-tokens.decorator';
import { CurrentActor } from '@platform/http/decorators/current-actor.decorator';
import { CurrentPrincipal } from '@platform/http/decorators/current-principal.decorator';
import { InAudience } from '@platform/http/decorators/in-audience.decorator';
import type { SecretValueSet } from '@secrets/application/commands/handlers/set-secret-value.handler';
import { SetSecretValueCommand } from '@secrets/application/commands/set-secret-value.command';
import type { WorkspaceSecretDto } from '@secrets/application/dto/workspace-secret.dto';
import { ListWorkspaceSecretsQuery } from '@secrets/application/queries/list-workspace-secrets.query';
import { SetSecretValueRequestDto } from '@secrets/presentation/http/dto/set-secret-value.request.dto';
import { WorkspaceSecretResponseDto } from '@secrets/presentation/http/dto/workspace-secret.response.dto';
import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

const valueIn = (body: SetSecretValueRequestDto | undefined): unknown =>
  body?.value;

@ApiTags('workspaces')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'No valid session or token' })
@AllowWorkspaceTokens()
@InAudience('automation')
@Controller('workspaces')
export class WorkspaceSecretController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get(':slug/secrets')
  @ApiOperation({
    operationId: 'listWorkspaceSecrets',
    summary:
      'The workspace’s secrets, with the hosts each one is sent to and where its value comes from. Never the values',
  })
  @ApiParam({ name: 'slug', example: 'acme-inc' })
  @ApiOkResponse({ type: WorkspaceSecretResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  async list(
    @Param('slug') slug: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<WorkspaceSecretResponseDto[]> {
    const secrets = await this.queryBus.execute<
      ListWorkspaceSecretsQuery,
      readonly WorkspaceSecretDto[] | null
    >(new ListWorkspaceSecretsQuery(slug, principal));

    if (!secrets) {
      throw new NotFoundException();
    }

    return secrets.map((each) => new WorkspaceSecretResponseDto(each));
  }

  @Put(':slug/secrets/:name/value')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'setWorkspaceSecretValue',
    summary:
      'Set the value of a secret that Spotlight stores and Terraform does not set. Spotlight encrypts it and never returns it',
  })
  @ApiParam({ name: 'slug', example: 'acme-inc' })
  @ApiParam({ name: 'name', example: 'STAGING_LOGIN_PASSWORD' })
  @ApiNoContentResponse({ description: 'Spotlight stores the new value' })
  @ApiForbiddenResponse({ description: 'You do not manage secrets' })
  @ApiNotFoundResponse({ description: 'No such secret for this caller' })
  @ApiConflictResponse({
    description: 'Terraform sets this value, or the secret changed meanwhile',
  })
  @ApiUnprocessableEntityResponse({
    description:
      'The value is not text, is empty, is too long, or is more than one line for a bound secret',
  })
  async setValue(
    @Param('slug') slug: string,
    @Param('name') name: string,
    @Body() body: SetSecretValueRequestDto,
    @CurrentActor() actor: Actor,
  ): Promise<void> {
    const value = valueIn(body);

    if (typeof value !== 'string') {
      throw new UnprocessableEntityException(
        'Secret value must be a string, as in { "value": "hunter2" }.',
      );
    }

    const set = await this.commandBus.execute<
      SetSecretValueCommand,
      SecretValueSet
    >(new SetSecretValueCommand(slug, name, actor, value));

    if (!set) {
      throw new NotFoundException();
    }

    if (set.outcome === 'forbidden') {
      throw new ForbiddenException(`You need the ${set.act} permission`);
    }
  }
}
