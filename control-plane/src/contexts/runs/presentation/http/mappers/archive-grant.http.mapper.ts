import { BadRequestException } from '@nestjs/common';
import type { ArchiveGrantRequest } from '@runs/application/commands/working-copy-archive.commands';
import type { ArchiveGrantDto } from '@runs/application/dto/working-copy-archive.dto';
import type { GrantWorkingCopyArchiveRequestDto } from '@runs/presentation/http/dto/working-copy-archive.request.dto';
import { ArchiveGrantResponseDto } from '@runs/presentation/http/dto/working-copy-archive.response.dto';

const SHAPE =
  'name size and sha256 for a tar you upload, or snapshot for a snapshot your host makes: not both, not neither';

// The request names what the runner made. Where it is kept follows from the runner's pool or trust.
export const archiveGrantRequestOf = (
  body: GrantWorkingCopyArchiveRequestDto | undefined,
): ArchiveGrantRequest => {
  const tar = body?.size !== undefined || body?.sha256 !== undefined;
  const snapshot = body?.snapshot;

  if (snapshot && !tar && typeof snapshot === 'object') {
    const { base } = snapshot;

    if (base !== undefined && base !== null && typeof base !== 'string') {
      throw new BadRequestException('snapshot.base is a snapshot name or null');
    }

    return { kind: 'snapshot', base: base ?? null };
  }

  if (
    !snapshot &&
    typeof body?.size === 'number' &&
    typeof body.sha256 === 'string'
  ) {
    return { kind: 'tar', size: body.size, sha256: body.sha256 };
  }

  throw new BadRequestException(SHAPE);
};

export const archiveGrantResponseOf = (
  granted: ArchiveGrantDto,
): ArchiveGrantResponseDto =>
  'snapshot' in granted
    ? ArchiveGrantResponseDto.snapshot(granted.id, granted.snapshot.name)
    : new ArchiveGrantResponseDto(granted.id, granted.url, granted.headers);
