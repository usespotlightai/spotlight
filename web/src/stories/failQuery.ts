import type { QueryClient, QueryKey } from '@tanstack/react-query';

export const failQuery = (
  client: QueryClient,
  queryKey: QueryKey,
  error: Error = new Error('Control plane didn’t respond.'),
) => {
  const query = client.getQueryCache().build(client, { queryKey });

  query.setState({
    ...query.state,
    status: 'error',
    error,
    errorUpdateCount: 1,
    errorUpdatedAt: Date.now(),
  });
};
