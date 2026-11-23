import { ApiProperty } from '@nestjs/swagger';
import type { WorkingCopyStoreDto } from '@runners/application/mappers/working-copy-store.mapper';

export class WorkingCopiesResponseDto {
  @ApiProperty({
    example: 's3://team-a',
    description:
      'The store that the working copy hook of each host keeps working copies in. Spotlight does not read it: any pool or trust with the same store restores the working copies that another one saved. The hook holds what the store needs to be reached; Spotlight never does',
  })
  readonly store: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'base-v1',
    description:
      'The snapshot that a new working copy starts from, such as a workspace with its repositories cloned and set up. With null, the hook starts a new working copy as it sees fit, such as an empty disk',
  })
  readonly base: string | null;

  constructor(store: WorkingCopyStoreDto) {
    this.store = store.store;
    this.base = store.base;
  }

  static of(
    store: WorkingCopyStoreDto | null,
  ): WorkingCopiesResponseDto | null {
    return store ? new WorkingCopiesResponseDto(store) : null;
  }
}

export const WORKING_COPIES = {
  type: WorkingCopiesResponseDto,
  nullable: true,
  description:
    'Where the hosts keep the working copies of runs: a store that the working copy hook of each host reaches, which saves each archive as a snapshot. With null, Spotlight keeps them as archives in its own storage',
};
