export type Loadable = {
  data: unknown;
  isPending: boolean;
  errorUpdateCount: number;
};

export const loading = (query: Loadable): boolean =>
  query.isPending && query.errorUpdateCount === 0;

export const failed = (query: Loadable): boolean =>
  query.data === undefined && query.errorUpdateCount > 0;

type KeyedQuery = { readonly queryKey: readonly unknown[] };

// Placeholder data for an insights query keyed [..., kind, teamId, period]:
// the team's last period stays shown until the new period arrives.
export const keepTeamPeriod =
  (teamId: string | undefined) =>
  <T>(previous: T | undefined, query: KeyedQuery | undefined): T | undefined =>
    query?.queryKey[2] === (teamId ?? null) ? previous : undefined;
