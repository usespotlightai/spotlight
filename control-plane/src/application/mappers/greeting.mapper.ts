import type { GreetingDto } from '@application/dto/greeting.dto';
import type { Greeting } from '@domain/value-objects/greeting.vo';

export const GreetingMapper = {
  toDto(greeting: Greeting): GreetingDto {
    return { message: greeting.message };
  },
};
