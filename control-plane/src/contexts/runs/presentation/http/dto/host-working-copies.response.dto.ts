import { ApiProperty } from '@nestjs/swagger';
import type { WorkingCopyStoreContract } from '@runners/application/contracts/working-copy-store.contract';

export class HostWorkingCopiesResponseDto {
  @ApiProperty({
    example: 's3://team-a',
    description:
      'The store the host’s working copy hook keeps working copies in; the host passes it to the hook',
  })
  readonly store: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'base-v1',
    description:
      'The snapshot a new working copy starts from; with null, the hook starts one as it sees fit',
  })
  readonly base: string | null;

  constructor(store: WorkingCopyStoreContract) {
    this.store = store.store;
    this.base = store.base;
  }

  static of(
    store: WorkingCopyStoreContract | null,
  ): HostWorkingCopiesResponseDto | null {
    return store ? new HostWorkingCopiesResponseDto(store) : null;
  }
}
