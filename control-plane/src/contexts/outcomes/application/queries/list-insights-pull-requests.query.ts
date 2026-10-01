import type { PullRequestFilterAsked } from '@outcomes/domain/services/pull-request-filter';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ListInsightsPullRequestsQuery {
  constructor(
    readonly teamId: string,
    readonly principal: Principal,
    readonly period: string,
    readonly filter: PullRequestFilterAsked,
    readonly page: number | null,
    readonly size: number | null,
  ) {}
}
