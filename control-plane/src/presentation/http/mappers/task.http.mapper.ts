import type { TaskDto } from '@application/dto/task.dto';
import { TaskResponseDto } from '@presentation/http/dto/task.response.dto';

export const TaskHttpMapper = {
  toResponse(dto: TaskDto): TaskResponseDto {
    return new TaskResponseDto(
      dto.id,
      dto.stationId,
      dto.title,
      dto.description,
      dto.createdAt,
    );
  },
};
