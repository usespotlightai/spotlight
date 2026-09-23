import { DefineIntegrationCommand } from '@integrations/application/commands/define-integration.command';
import type { DefinedIntegrationDto } from '@integrations/application/dto/integration-resource.dto';
import { IntegrationResourceResponseDto } from '@integrations/presentation/http/dto/integration-resource.response.dto';
import {
  Body,
  Controller,
  NotFoundException,
  Param,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import { ConfigurationProblemsResponseDto } from '@platform/http/dto/configuration-problems.response.dto';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';

@ApiTags('integrations')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('teams/:teamId/integrations')
export class IntegrationDefinitionController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  @ApiOperation({
    operationId: 'defineIntegration',
    summary:
      'Define an integration, replacing the one this team has for its host',
  })
  @ApiParam({ name: 'teamId', example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: true,
      example: {
        integration: 'linear',
        actions: {
          comment: {
            request: {
              method: 'POST',
              url: 'https://api.linear.app/graphql',
            },
          },
        },
      },
    },
  })
  @ApiCreatedResponse({ type: IntegrationResourceResponseDto })
  @ApiNotFoundResponse({ description: 'No such team this caller administers' })
  @ApiUnprocessableEntityResponse({
    type: ConfigurationProblemsResponseDto,
    description: 'What is wrong with the definition, field by field',
  })
  async define(
    @Param('teamId') teamId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IntegrationResourceResponseDto> {
    const defined = await this.commandBus.execute<
      DefineIntegrationCommand,
      DefinedIntegrationDto | null
    >(new DefineIntegrationCommand(teamId, user.id, body));

    if (!defined) {
      throw new NotFoundException();
    }

    if (!defined.ok) {
      throw new UnprocessableEntityException(
        new ConfigurationProblemsResponseDto(defined.problems),
      );
    }

    return new IntegrationResourceResponseDto(
      defined.integration,
      defined.warnings,
    );
  }
}
