import type { TaskDto } from '@application/dto/task.dto';
import {
  TaskNoteResponseDto,
  TaskPersonResponseDto,
  TaskResponseDto,
  TaskReviewResponseDto,
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
      dto.awaitingReview
        ? new TaskReviewResponseDto(dto.awaitingReview.conversationId)
        : null,
      dto.raisedBy
        ? new TaskPersonResponseDto(
            dto.raisedBy.id,
            dto.raisedBy.name,
            dto.raisedBy.image,
          )
        : null,
      dto.note
        ? new TaskNoteResponseDto(
            dto.note.position,
            dto.note.station,
            dto.note.body,
          )
        : null,
    );
  },
};
