import { ApiProperty } from '@nestjs/swagger';
import type { StoredArchiveDto } from '@runs/application/dto/working-copy-archive.dto';

export class SnapshotGrantResponseDto {
  @ApiProperty({
    example: 'spotlight-0b6f3c2e-6c55-4b8e-9d7a-2f4e1a9c8d31',
    description:
      'The snapshot the host makes of the working copy; then the runner completes the archive',
  })
  readonly name: string;

  constructor(name: string) {
    this.name = name;
  }
}

export class ArchiveGrantResponseDto {
  @ApiProperty({ example: '0b6f3c2e-6c55-4b8e-9d7a-2f4e1a9c8d31' })
  readonly id: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Where to PUT the archive, for a quarter of an hour; the upload must carry every header given. null for a snapshot',
  })
  readonly url: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: {
      'content-type': 'application/gzip',
      'x-amz-checksum-sha256': 'nywdDot6b15NPCsaD56NfG5Kp9PS0bmo9+bWxLOqLxA=',
    },
  })
  readonly headers: Readonly<Record<string, string>>;

  @ApiProperty({
    type: SnapshotGrantResponseDto,
    required: false,
    description: 'For a snapshot: the snapshot to make',
  })
  readonly snapshot?: SnapshotGrantResponseDto;

  constructor(
    id: string,
    url: string | null,
    headers: Readonly<Record<string, string>>,
    snapshot?: SnapshotGrantResponseDto,
  ) {
    this.id = id;
    this.url = url;
    this.headers = headers;
    if (snapshot) {
      this.snapshot = snapshot;
    }
  }

  static snapshot(id: string, name: string): ArchiveGrantResponseDto {
    return new ArchiveGrantResponseDto(
      id,
      null,
      {},
      new SnapshotGrantResponseDto(name),
    );
  }
}

export class StoredSnapshotResponseDto {
  @ApiProperty({
    example: 's3://team-a',
    description: 'The store that keeps the snapshot',
  })
  readonly store: string;

  @ApiProperty({
    example: 'spotlight-0b6f3c2e-6c55-4b8e-9d7a-2f4e1a9c8d31',
    description:
      'The snapshot a host of that store opens the working copy from',
  })
  readonly name: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'base-v1',
    description:
      'The base snapshot the working copy descends from; null for one that started without a base',
  })
  readonly base: string | null;

  @ApiProperty({
    example: false,
    description:
      'true when the run starts from the current base of the host’s store instead: it starts no session of its own, and the working copy descends from another base',
  })
  readonly rebase: boolean;

  constructor(snapshot: {
    store: string;
    name: string;
    base: string | null;
    rebase: boolean;
  }) {
    this.store = snapshot.store;
    this.name = snapshot.name;
    this.base = snapshot.base;
    this.rebase = snapshot.rebase;
  }
}

export class StoredArchiveResponseDto {
  @ApiProperty({ example: '0b6f3c2e-6c55-4b8e-9d7a-2f4e1a9c8d31' })
  readonly id: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Where to GET the archive, for a quarter of an hour. null for a snapshot',
  })
  readonly url: string | null;

  @ApiProperty({ type: 'integer', nullable: true, example: 48_213_551 })
  readonly size: number | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '9f2c1d0e8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f10',
  })
  readonly sha256: string | null;

  @ApiProperty({
    type: StoredSnapshotResponseDto,
    required: false,
    description:
      'For a snapshot: only a host whose working copy hook reaches the store restores it',
  })
  readonly snapshot?: StoredSnapshotResponseDto;

  constructor(stored: StoredArchiveDto) {
    this.id = stored.id;

    if ('snapshot' in stored) {
      this.url = null;
      this.size = null;
      this.sha256 = null;
      this.snapshot = new StoredSnapshotResponseDto(stored.snapshot);
      return;
    }

    this.url = stored.url;
    this.size = stored.size;
    this.sha256 = stored.sha256;
  }
}
