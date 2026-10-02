import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadCandidateQuery {
  constructor(
    readonly candidateId: string,
    readonly principal: Principal,
  ) {}
}
