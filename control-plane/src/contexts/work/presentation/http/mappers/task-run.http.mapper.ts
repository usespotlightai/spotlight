import type {
  TaskRunDto,
  TeamRunDto,
} from '@work/application/dto/task-run.dto';
import {
  RunReviewResponseDto,
  RunStationResponseDto,
  TaskRunResponseDto,
  TeamRunResponseDto,
} from '@work/presentation/http/dto/task-run.response.dto';

export const TaskRunHttpMapper = {
  toResponse(dto: TaskRunDto): TaskRunResponseDto {
    return new TaskRunResponseDto(
      dto.id,
      dto.state,
      dto.attempt,
      dto.exitCode,
      dto.startedAt,
      dto.updatedAt,
      dto.harness,
      dto.image,
      dto.station
        ? new RunStationResponseDto(
            dto.station.id,
            dto.station.name,
            dto.station.color,
            dto.station.position,
            dto.station.count,
          )
        : null,
      dto.review
        ? new RunReviewResponseDto(dto.review.state, dto.review.conversationId)
        : null,
      dto.work,
    );
  },

  teamToResponse(dto: TeamRunDto): TeamRunResponseDto {
    return new TeamRunResponseDto(
      TaskRunHttpMapper.toResponse(dto),
      dto.taskId,
      dto.taskTitle,
      dto.taskDescription,
    );
  },
};
