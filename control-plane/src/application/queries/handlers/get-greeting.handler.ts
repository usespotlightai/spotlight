import type { GreetingDto } from '@application/dto/greeting.dto';
import { GreetingMapper } from '@application/mappers/greeting.mapper';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { GetGreetingQuery } from '@application/queries/get-greeting.query';
import { Greeting } from '@domain/value-objects/greeting.vo';

export class GetGreetingHandler
  implements QueryHandlerPort<GetGreetingQuery, GreetingDto>
{
  async execute(query: GetGreetingQuery): Promise<GreetingDto> {
    return GreetingMapper.toDto(Greeting.for(query.recipient));
  }
}
