import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export interface KeyedStation {
  readonly lineId: string;
  readonly key: string;
}

export class ListTeamReplaySetsQuery {
  constructor(
    readonly teamId: string,
    readonly principal: Principal,
    readonly at: KeyedStation | null,
  ) {}
}
