import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import {
  EnrolRunnerCommand,
  RevokeRunnerCommand,
} from '@runners/application/commands/runner-fleet.commands';
import type { ConnectedRunnerDto } from '@runners/application/dto/connected-runner.dto';
import { type EnrolledRunnerDto } from '@runners/application/dto/runner.dto';
import { ListRunnersQuery } from '@runners/application/queries/list-runners.query';
import {
  ConnectedRunnerResponseDto,
  EnrolledRunnerResponseDto,
} from '@runners/presentation/http/dto/connected-runner.response.dto';
import { EnrolRunnerRequestDto } from '@runners/presentation/http/dto/enrol-runner.request.dto';
import { ConnectedRunnerHttpMapper } from '@runners/presentation/http/mappers/connected-runner.http.mapper';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';

@ApiTags('runners')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@ApiParam({ name: 'slug', example: 'acme' })
@Controller('workspaces/:slug/runners')
export class RunnerFleetController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listRunners',
    summary: 'List the workspace’s runners and whether each is still answering',
  })
  @ApiOkResponse({ type: ConnectedRunnerResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  async list(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConnectedRunnerResponseDto[]> {
    const runners = await this.queryBus.execute<
      ListRunnersQuery,
      ConnectedRunnerDto[] | null
    >(new ListRunnersQuery(slug, user.id));

    if (!runners) {
      throw new NotFoundException();
    }

    return runners.map(ConnectedRunnerHttpMapper.toResponse);
  }

  @Post()
  @ApiOperation({
    operationId: 'enrolRunner',
    summary: 'Enrol a runner and mint the token it registers with',
  })
  @ApiCreatedResponse({ type: EnrolledRunnerResponseDto })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  @ApiForbiddenResponse({ description: 'Not an owner or admin' })
  async enrol(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: EnrolRunnerRequestDto,
  ): Promise<EnrolledRunnerResponseDto> {
    const enrolled = await this.commandBus.execute<
      EnrolRunnerCommand,
      EnrolledRunnerDto | null
    >(new EnrolRunnerCommand(slug, user.id, body.name));

    if (!enrolled) {
      throw new NotFoundException();
    }

    return new EnrolledRunnerResponseDto(
      enrolled.runnerId,
      enrolled.name,
      enrolled.token,
    );
  }

  @Post(':runnerId/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'revokeRunner',
    summary: 'Retire a runner’s token, locking it out from the next call on',
  })
  @ApiParam({ name: 'runnerId' })
  @ApiNoContentResponse({ description: 'The token no longer works' })
  @ApiNotFoundResponse({ description: 'No such runner in this workspace' })
  @ApiForbiddenResponse({ description: 'Not an owner or admin' })
  async revoke(
    @Param('slug') slug: string,
    @Param('runnerId') runnerId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute<RevokeRunnerCommand, void>(
      new RevokeRunnerCommand(slug, user.id, runnerId),
    );
  }
}
