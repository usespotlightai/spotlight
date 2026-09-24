import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadSecretQuery {
  constructor(
    readonly secretId: string,
    readonly principal: Principal,
  ) {}
}
