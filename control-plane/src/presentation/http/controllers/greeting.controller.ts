import { GetGreetingQuery } from '@application/queries/get-greeting.query';
import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GreetingResponseDto } from '@presentation/http/dto/greeting.response.dto';
import { GreetingHttpMapper } from '@presentation/http/mappers/greeting.http.mapper';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@ApiTags('greeting')
@Controller()
export class GreetingController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @AllowAnonymous()
  @ApiOperation({ operationId: 'getGreeting', summary: 'Return a greeting' })
  @ApiOkResponse({ type: GreetingResponseDto })
  async handle(): Promise<GreetingResponseDto> {
    const greeting = await this.queryBus.execute(new GetGreetingQuery());
    return GreetingHttpMapper.toResponse(greeting);
  }
}
