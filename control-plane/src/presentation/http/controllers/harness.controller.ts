import type { HarnessDto } from '@application/dto/harness.dto';
import { ListHarnessesQuery } from '@application/queries/list-harnesses.query';
import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HarnessResponseDto } from '@presentation/http/dto/harness.response.dto';

@ApiTags('harnesses')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('harnesses')
export class HarnessController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    operationId: 'listHarnesses',
    summary: 'List the harnesses a station can be worked by',
  })
  @ApiOkResponse({ type: HarnessResponseDto, isArray: true })
  async list(): Promise<HarnessResponseDto[]> {
    const harnesses = await this.queryBus.execute<
      ListHarnessesQuery,
      HarnessDto[]
    >(new ListHarnessesQuery());

    return harnesses.map(
      (harness) => new HarnessResponseDto(harness.id, harness.name),
    );
  }
}
