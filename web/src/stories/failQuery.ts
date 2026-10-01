import type { QueryClient, QueryKey } from '@tanstack/react-query';

export const failQuery = (
  client: QueryClient,
  queryKey: QueryKey,
  error: Error = new Error('The control plane did not answer.'),
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
