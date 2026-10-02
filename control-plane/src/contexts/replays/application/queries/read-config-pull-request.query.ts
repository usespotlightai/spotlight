import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ReadConfigPullRequestQuery {
  constructor(
    readonly teamId: string,
    readonly pullRequestId: string,
    readonly principal: Principal,
  ) {}
}
