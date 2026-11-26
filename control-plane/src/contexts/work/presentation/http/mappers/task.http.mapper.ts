import type { TaskDto } from '@work/application/dto/task.dto';
import {
  TaskHandMoveResponseDto,
  TaskNoteResponseDto,
  TaskPersonResponseDto,
  TaskResponseDto,
  TaskReviewResponseDto,
  TaskHoldResponseDto,
  TaskRunNotStartedResponseDto,
} from '@work/presentation/http/dto/task.response.dto';
import { AttachmentHttpMapper } from '@work/presentation/http/mappers/attachment.http.mapper';
import { stationLabelOf } from '@work/presentation/http/mappers/station-label';

export const TaskHttpMapper = {
  toResponse(dto: TaskDto): TaskResponseDto {
    return new TaskResponseDto(
      dto.id,
      dto.stationId,
      dto.revision,
      dto.title,
      dto.description,
      dto.attachments.map((each) => AttachmentHttpMapper.toResponse(each)),
      dto.createdAt,
      dto.progress,
      dto.awaitingReview
        ? new TaskReviewResponseDto(dto.awaitingReview.conversationId)
        : null,
      dto.waitingForYou,
      dto.yourMessage,
      dto.finished,
      dto.pullRequests,
      dto.createdBy
        ? new TaskPersonResponseDto(
            dto.createdBy.id,
            dto.createdBy.name,
            dto.createdBy.image,
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
            stationLabelOf(dto.note.station),
            dto.note.body,
          )
        : null,
      dto.source,
      dto.hold
        ? new TaskHoldResponseDto(
            new TaskPersonResponseDto(
              dto.hold.by.id,
              dto.hold.by.name,
              dto.hold.by.image,
            ),
            dto.hold.startedAt,
            dto.hold.runId,
            dto.hold.heldMoveTo,
            dto.hold.chatId,
            dto.hold.viewerDrives,
            dto.hold.viewerEnds,
          )
        : null,
      dto.runNotStarted
        ? new TaskRunNotStartedResponseDto(dto.runNotStarted.harness)
        : null,
      dto.handMoves.map(
        (each) =>
          new TaskHandMoveResponseDto(each.stationId, each.denial, each.skips),
      ),
    );
  },
};
