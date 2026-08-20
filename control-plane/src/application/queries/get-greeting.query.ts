import type { GreetingDto } from '@application/dto/greeting.dto';
import { Query } from '@nestjs/cqrs';

export class GetGreetingQuery extends Query<GreetingDto> {}
