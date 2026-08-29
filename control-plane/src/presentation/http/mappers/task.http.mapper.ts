import type { TaskDto } from '@application/dto/task.dto';
import {
  TaskNoteResponseDto,
  TaskResponseDto,
} from '@presentation/http/dto/task.response.dto';

export const TaskHttpMapper = {
  toResponse(dto: TaskDto): TaskResponseDto {
    return new TaskResponseDto(
      dto.id,
      dto.stationId,
      dto.title,
      dto.description,
      dto.createdAt,
      dto.running,
      dto.awaitingReview,
      dto.note ? new TaskNoteResponseDto(
            dto.note.position,
            dto.note.station,
            dto.note.body,
          ) : null,
    );
  },
};
