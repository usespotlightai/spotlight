import type { NoteDto } from '@work/application/dto/inbox.dto';
import {
  InboxApprovalResponseDto,
  InboxAuthorResponseDto,
  InboxConnectionResponseDto,
  InboxFailureResponseDto,
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
      note.attachments.map(AttachmentHttpMapper.toResponse),
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
      note.deferredTo && stationLabelOf(note.deferredTo),
      note.approval ? new InboxApprovalResponseDto(note.approval) : null,
      note.failure ? new InboxFailureResponseDto(note.failure) : null,
      note.connection ? new InboxConnectionResponseDto(note.connection) : null,
    ),
};
