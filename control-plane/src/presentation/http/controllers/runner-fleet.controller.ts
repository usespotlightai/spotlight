import {
  EnrolRunnerCommand,
  RevokeRunnerCommand,
} from '@application/commands/runner.commands';
import type { ConnectedRunnerDto } from '@application/dto/connected-runner.dto';
import type { EnrolledRunnerDto } from '@application/dto/run.dto';
import { ListRunnersQuery } from '@application/queries/list-runners.query';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ConnectedRunnerResponseDto,
  EnrolledRunnerResponseDto,
} from '@presentation/http/dto/connected-runner.response.dto';
import { EnrolRunnerRequestDto } from '@presentation/http/dto/enrol-runner.request.dto';
import { ConnectedRunnerHttpMapper } from '@presentation/http/mappers/connected-runner.http.mapper';

@ApiTags('runners')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('runners')
export class RunnerFleetController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'listRunners',
    summary: 'List every runner and whether it is still answering',
  })
  @ApiOkResponse({ type: ConnectedRunnerResponseDto, isArray: true })
  async list(): Promise<ConnectedRunnerResponseDto[]> {
    const runners = await this.queryBus.execute<
      ListRunnersQuery,
      ConnectedRunnerDto[]
    >(new ListRunnersQuery());

    return runners.map(ConnectedRunnerHttpMapper.toResponse);
  }

  @Post()
  @ApiOperation({
    operationId: 'enrolRunner',
    summary: 'Enrol a runner and mint the token it registers with',
  })
  @ApiCreatedResponse({ type: EnrolledRunnerResponseDto })
  async enrol(
    @Body() body: EnrolRunnerRequestDto,
  ): Promise<EnrolledRunnerResponseDto> {
    const enrolled = await this.commandBus.execute<
      EnrolRunnerCommand,
      EnrolledRunnerDto
    >(new EnrolRunnerCommand(body.name, body.pool));

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
  @ApiNotFoundResponse({ description: 'No such runner' })
  async revoke(@Param('runnerId') runnerId: string): Promise<void> {
    await this.commandBus.execute<RevokeRunnerCommand, void>(
      new RevokeRunnerCommand(runnerId),
    );
  }
}
