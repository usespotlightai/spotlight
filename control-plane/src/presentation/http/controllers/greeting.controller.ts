import { GetGreetingQuery } from '@application/queries/get-greeting.query';
import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import type { GreetingResponseDto } from '@presentation/http/dto/greeting.response.dto';
import { GreetingHttpMapper } from '@presentation/http/mappers/greeting.http.mapper';

@Controller()
export class GreetingController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  async handle(): Promise<GreetingResponseDto> {
    const greeting = await this.queryBus.execute(new GetGreetingQuery());
    return GreetingHttpMapper.toResponse(greeting);
  }
}
