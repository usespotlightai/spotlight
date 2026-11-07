import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

export interface LineSource {
  readonly repository: Repository;
  readonly path: string;
}
