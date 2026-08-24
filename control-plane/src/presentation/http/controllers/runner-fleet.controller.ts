import type { ConnectedRunnerDto } from '@application/dto/connected-runner.dto';
import { ListRunnersQuery } from '@application/queries/list-runners.query';
import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ConnectedRunnerResponseDto } from '@presentation/http/dto/connected-runner.response.dto';
import { ConnectedRunnerHttpMapper } from '@presentation/http/mappers/connected-runner.http.mapper';

@ApiTags('runners')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('runners')
export class RunnerFleetController {
  constructor(private readonly queryBus: QueryBus) {}

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
}
