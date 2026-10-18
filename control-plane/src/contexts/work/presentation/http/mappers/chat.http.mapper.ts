import type { ChatDto, ChatSummaryDto } from '@work/application/dto/chat.dto';
import {
  ChatMessageResponseDto,
  ChatProposalResponseDto,
  ChatResponseDto,
  ChatSetupResponseDto,
  ChatSummaryResponseDto,
  ChatTargetStationResponseDto,
  ChatTraceResponseDto,
} from '@work/presentation/http/dto/chat.response.dto';
import { InboxAuthorResponseDto } from '@work/presentation/http/dto/inbox.response.dto';
import { AttachmentHttpMapper } from '@work/presentation/http/mappers/attachment.http.mapper';

export const ChatHttpMapper = {
  summaryToResponse(dto: ChatSummaryDto): ChatSummaryResponseDto {
    return new ChatSummaryResponseDto(
      dto.id,
      dto.title,
      dto.harness,
      dto.model,
      dto.effort,
      dto.repositories,
      dto.targetStation
        ? new ChatTargetStationResponseDto(dto.targetStation)
        : null,
      dto.setup ? new ChatSetupResponseDto(dto.setup) : null,
      dto.createdAt,
      dto.updatedAt,
      dto.working,
    );
  },

  toResponse(dto: ChatDto): ChatResponseDto {
    return new ChatResponseDto(
      ChatHttpMapper.summaryToResponse(dto),
      dto.runId,
      dto.messages.map(
        (message) =>
          new ChatMessageResponseDto(
            message.position,
            message.kind,
            message.body,
            message.at,
            message.author
              ? new InboxAuthorResponseDto(
                  message.author.id,
                  message.author.name,
                  message.author.image,
                )
              : null,
            message.runId,
            message.attachments.map(AttachmentHttpMapper.toResponse),
            message.traces.map(
              (each) => new ChatTraceResponseDto(each.taskId, each.title),
            ),
            message.proposal
              ? new ChatProposalResponseDto(
                  message.proposal.lineId,
                  message.proposal.lineName,
                  message.proposal.stationId,
                  message.proposal.stationName,
                  message.proposal.stationColor,
                  message.proposal.stationPosition,
                  message.proposal.stationCount,
                  message.proposal.title,
                  message.proposal.description,
                  message.proposal.state,
                  message.proposal.taskId,
                )
              : null,
          ),
      ),
    );
  },
};
