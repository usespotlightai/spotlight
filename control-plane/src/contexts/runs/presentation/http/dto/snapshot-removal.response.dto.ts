import { ApiProperty } from '@nestjs/swagger';
import type { SnapshotRemovalDto } from '@runs/application/dto/snapshot-removal.dto';

export class SnapshotRemovalResponseDto {
  @ApiProperty({
    example: '0b6f3c2e-6c55-4b8e-9d7a-2f4e1a9c8d31',
    description:
      'The removed archive; DELETE /api/hosts/snapshot-removals/{archiveId} once the snapshot is deleted',
  })
  readonly archiveId: string;

  @ApiProperty({
    example: 'spotlight-0b6f3c2e-6c55-4b8e-9d7a-2f4e1a9c8d31',
    description: 'The snapshot to delete from the store',
  })
  readonly snapshot: string;

  constructor(removal: SnapshotRemovalDto) {
    this.archiveId = removal.archiveId;
    this.snapshot = removal.snapshot;
  }
}

export class SnapshotRemovalsResponseDto {
  @ApiProperty({
    type: String,
    nullable: true,
    example: 's3://team-a',
    description:
      'The store of the host’s pool or trust; null when it keeps no working copies in a store of its hosts',
  })
  readonly store: string | null;

  @ApiProperty({ type: [SnapshotRemovalResponseDto] })
  readonly removals: readonly SnapshotRemovalResponseDto[];

  constructor(store: string | null, removals: readonly SnapshotRemovalDto[]) {
    this.store = store;
    this.removals = removals.map(
      (each) => new SnapshotRemovalResponseDto(each),
    );
  }
}
