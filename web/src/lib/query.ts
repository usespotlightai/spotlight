type Loadable = {
  data: unknown;
  isPending: boolean;
  errorUpdateCount: number;
};

export const loading = (query: Loadable): boolean =>
  query.isPending && query.errorUpdateCount === 0;

export const failed = (query: Loadable): boolean =>
  query.data === undefined && query.errorUpdateCount > 0;
