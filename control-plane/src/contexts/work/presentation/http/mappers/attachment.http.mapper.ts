import type { AttachmentDto } from '@work/application/dto/attachment.dto';
import { AttachmentResponseDto } from '@work/presentation/http/dto/attachment.response.dto';

export const AttachmentHttpMapper = {
  toResponse(dto: AttachmentDto): AttachmentResponseDto {
    return new AttachmentResponseDto(
      dto.id,
      dto.name,
      dto.contentType,
      dto.size,
    );
  },

  ids(given: unknown): string[] {
    return Array.isArray(given)
      ? given.filter((each): each is string => typeof each === 'string')
      : [];
  },
};
