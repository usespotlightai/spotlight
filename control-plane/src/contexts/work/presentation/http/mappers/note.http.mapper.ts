import type { FoldedVisitDto, NoteDto } from '@work/application/dto/inbox.dto';
import {
  FoldedVisitResponseDto,
  InboxApprovalResponseDto,
  InboxAuthorResponseDto,
  InboxConnectionResponseDto,
  InboxFailureResponseDto,
  NoteResumptionResponseDto,
  NoteResponseDto,
} from '@work/presentation/http/dto/inbox.response.dto';
import { AttachmentHttpMapper } from '@work/presentation/http/mappers/attachment.http.mapper';
import { stationLabelOf } from '@work/presentation/http/mappers/station-label';

export const NoteHttpMapper = {
  toResponse: (note: NoteDto): NoteResponseDto =>
    new NoteResponseDto(
      note.position,
      note.kind,
      note.form,
      note.voice,
      stationLabelOf(note.station),
      note.stationColor,
      note.stationPosition,
      note.runId,
      note.body,
      note.attachments.map((each) => AttachmentHttpMapper.toResponse(each)),
      note.at,
      note.author
        ? new InboxAuthorResponseDto(
            note.author.id,
            note.author.name,
            note.author.image,
          )
        : null,
      note.coAuthors.map(
        (each) => new InboxAuthorResponseDto(each.id, each.name, each.image),
      ),
      note.source,
      note.deferredTo,
      note.approval ? new InboxApprovalResponseDto(note.approval) : null,
      note.failure ? new InboxFailureResponseDto(note.failure) : null,
      note.connection ? new InboxConnectionResponseDto(note.connection) : null,
      note.resumption ? new NoteResumptionResponseDto(note.resumption) : null,
      note.suggestsClosing,
    ),

  foldedToResponse: (visit: FoldedVisitDto): FoldedVisitResponseDto =>
    new FoldedVisitResponseDto(
      NoteHttpMapper.toResponse(visit.first),
      visit.to,
      visit.endedAt,
      visit.closing && NoteHttpMapper.toResponse(visit.closing),
      visit.answers.map(NoteHttpMapper.toResponse),
      visit.sentBack,
    ),
};
