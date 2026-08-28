import type { TaskRunDto } from '@application/dto/task-run.dto';
import { TaskRunResponseDto } from '@presentation/http/dto/task-run.response.dto';

export const TaskRunHttpMapper = {
  toResponse(dto: TaskRunDto): TaskRunResponseDto {
    return new TaskRunResponseDto(
      dto.id,
      dto.state,
      dto.attempt,
      dto.exitCode,
      dto.startedAt,
      dto.updatedAt,
    );
  },
};
