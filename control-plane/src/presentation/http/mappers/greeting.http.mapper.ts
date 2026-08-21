import type { GreetingDto } from '@application/dto/greeting.dto';
import { GreetingResponseDto } from '@presentation/http/dto/greeting.response.dto';

export const GreetingHttpMapper = {
  toResponse(dto: GreetingDto): GreetingResponseDto {
    return new GreetingResponseDto(dto.message);
  },
};
