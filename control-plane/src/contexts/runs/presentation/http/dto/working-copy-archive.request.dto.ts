import { ApiProperty } from '@nestjs/swagger';

export class SnapshotArchiveRequestDto {
  @ApiProperty({
    type: String,
    nullable: true,
    required: false,
    example: 'base-v1',
    description:
      'The base snapshot the working copy descends from: the store’s current base, or the base of the working copy the run restored. Null or left out for one that started without a base. Spotlight takes the store from the runner’s pool or trust',
  })
  readonly base?: string | null;
}

export class GrantWorkingCopyArchiveRequestDto {
  @ApiProperty({
    required: false,
    example: 48_213_551,
    description:
      'The archive’s size in bytes, as it will be uploaded. Not with snapshot',
  })
  readonly size?: number;

  @ApiProperty({
    required: false,
    example: '9f2c1d0e8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f10',
    description:
      'The archive’s SHA-256, as 64 hexadecimal digits. Not with snapshot',
  })
  readonly sha256?: string;

  @ApiProperty({
    type: SnapshotArchiveRequestDto,
    required: false,
    description:
      'The archive is a snapshot that the host makes in the store of the runner’s pool or trust, not a tar. Only for a runner whose pool or trust keeps working copies in a store; any other runner uploads a tar',
  })
  readonly snapshot?: SnapshotArchiveRequestDto;
}
