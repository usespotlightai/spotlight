import type { GreetingDto } from '@application/dto/greeting.dto';
import { GreetingMapper } from '@application/mappers/greeting.mapper';
import { GetGreetingQuery } from '@application/queries/get-greeting.query';
import { Greeting } from '@domain/value-objects/greeting.vo';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';

@QueryHandler(GetGreetingQuery)
export class GetGreetingHandler
  implements IQueryHandler<GetGreetingQuery, GreetingDto>
{
  async execute(): Promise<GreetingDto> {
    return GreetingMapper.toDto(Greeting.for('World'));
  }
}
