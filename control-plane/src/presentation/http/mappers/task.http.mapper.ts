import type { TaskDto } from '@application/dto/task.dto';
import {
  TaskLabelResponseDto,
  TaskNoteResponseDto,
  TaskPersonResponseDto,
  TaskResponseDto,
  TaskReviewResponseDto,
} from '@presentation/http/dto/task.response.dto';
import { AttachmentHttpMapper } from '@presentation/http/mappers/attachment.http.mapper';

export const TaskHttpMapper = {
  toResponse(dto: TaskDto): TaskResponseDto {
    return new TaskResponseDto(
      dto.id,
      dto.stationId,
      dto.title,
      dto.description,
      dto.attachments.map(AttachmentHttpMapper.toResponse),
      dto.createdAt,
      dto.running,
      dto.awaitingReview
        ? new TaskReviewResponseDto(dto.awaitingReview.conversationId)
        : null,
      dto.pullRequest,
      dto.raisedBy
        ? new TaskPersonResponseDto(
            dto.raisedBy.id,
            dto.raisedBy.name,
            dto.raisedBy.image,
          )
        : null,
      dto.assignee
        ? new TaskPersonResponseDto(
            dto.assignee.id,
            dto.assignee.name,
            dto.assignee.image,
          )
        : null,
      (dto.labels ?? []).map(
        (l) => new TaskLabelResponseDto(l.id, l.name, l.colour),
      ),
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
