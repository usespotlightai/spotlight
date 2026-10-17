import type { MemoryFileDto } from '@memory/application/dto/memory-file.dto';
import { ReadMemoryFilesQuery } from '@memory/application/queries/read-memory-files.query';
import { MemoryFileResponseDto } from '@memory/presentation/http/dto/memory-file.response.dto';
import { Controller, Get, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentRunner } from '@platform/http/decorators/current-runner.decorator';
import { RunnerOnly } from '@platform/http/decorators/runner-only.decorator';

@ApiTags('runners')
@ApiUnauthorizedResponse({
  description: 'Missing, spent or wrong runner token',
})
@ApiParam({ name: 'runId', type: String })
@RunnerOnly()
@Controller('runs/:runId/memory-files')
export class RunnerMemoryFilesController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    operationId: 'readMemoryFiles',
    summary:
      'Every standing memory that applies to the run, as files to lay in its workspace',
  })
  @ApiOkResponse({ type: MemoryFileResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such run leased by this runner' })
  async files(
    @Param('runId') runId: string,
    @CurrentRunner() runnerId: string,
  ): Promise<MemoryFileResponseDto[]> {
    const files = await this.queryBus.execute<
      ReadMemoryFilesQuery,
      MemoryFileDto[]
    >(new ReadMemoryFilesQuery(runId, runnerId));

    return files.map((each) => new MemoryFileResponseDto(each));
  }
}
