import type { PullRequestFilterQuery } from '@insights/application/queries/pull-request-filter-query';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class ListInsightsPullRequestsQuery {
  constructor(
    readonly teamId: string,
    readonly principal: Principal,
    readonly period: string,
    readonly filter: PullRequestFilterQuery,
    readonly page: number | null,
    readonly size: number | null,
  ) {}
}
