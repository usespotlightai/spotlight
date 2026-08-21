import type { GreetingDto } from '@application/dto/greeting.dto';
import { GetGreetingQuery } from '@application/queries/get-greeting.query';
import { Controller, Get, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GreetingResponseDto } from '@presentation/http/dto/greeting.response.dto';
import { GreetingHttpMapper } from '@presentation/http/mappers/greeting.http.mapper';

const DEFAULT_RECIPIENT = 'World';

@ApiTags('greeting')
@Controller()
export class GreetingController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({ operationId: 'getGreeting', summary: 'Return a greeting' })
  @ApiQuery({
    name: 'name',
    required: false,
    example: 'Leon',
    description: `Who to greet. Defaults to "${DEFAULT_RECIPIENT}".`,
  })
  @ApiOkResponse({ type: GreetingResponseDto })
  @ApiUnauthorizedResponse({ description: 'No valid session' })
  async handle(@Query('name') name?: string): Promise<GreetingResponseDto> {
    const recipient = name?.trim() ? name : DEFAULT_RECIPIENT;
    const greeting = await this.queryBus.execute<GetGreetingQuery, GreetingDto>(
      new GetGreetingQuery(recipient),
    );
    return GreetingHttpMapper.toResponse(greeting);
  }
}
