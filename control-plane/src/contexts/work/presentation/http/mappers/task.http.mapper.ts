import type { TaskDto } from '@work/application/dto/task.dto';
import {
  TaskNoteResponseDto,
  TaskPersonResponseDto,
  TaskResponseDto,
  TaskReviewResponseDto,
} from '@work/presentation/http/dto/task.response.dto';
import { AttachmentHttpMapper } from '@work/presentation/http/mappers/attachment.http.mapper';

export const TaskHttpMapper = {
  toResponse(dto: TaskDto): TaskResponseDto {
    return new TaskResponseDto(
      dto.id,
      dto.stationId,
      dto.revision,
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
