import type { ArchiveGrantDto } from '@runs/application/dto/working-copy-archive.dto';
import type { ArchiveGrantStorage } from '@runs/application/services/archive-grants.service';
import type { GrantWorkingCopyArchiveRequestDto } from '@runs/presentation/http/dto/working-copy-archive.request.dto';
import { ArchiveGrantResponseDto } from '@runs/presentation/http/dto/working-copy-archive.response.dto';

export const archiveGrantStorageOf = (
  body: GrantWorkingCopyArchiveRequestDto,
): ArchiveGrantStorage => ({
  ...(body.size === undefined ? {} : { size: body.size }),
  ...(body.sha256 === undefined ? {} : { sha256: body.sha256 }),
  ...(body.snapshot
    ? {
        snapshot: {
          store: body.snapshot.store,
          base: body.snapshot.base ?? null,
        },
      }
    : {}),
});

export const archiveGrantResponseOf = (
  granted: ArchiveGrantDto,
): ArchiveGrantResponseDto =>
  'snapshot' in granted
    ? ArchiveGrantResponseDto.snapshot(granted.id, granted.snapshot.name)
    : new ArchiveGrantResponseDto(granted.id, granted.url, granted.headers);
