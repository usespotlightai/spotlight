import type { RawChange } from '@replays/domain/services/changes-asked-about';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadConfigOriginsQuery {
  constructor(
    readonly teamId: string,
    readonly principal: Principal,
    readonly changes: readonly RawChange[],
  ) {}
}
