import type { QueryClient, QueryKey } from '@tanstack/react-query';

export const failQuery = (client: QueryClient, queryKey: QueryKey) => {
  const query = client.getQueryCache().build(client, { queryKey });

  query.setState({
    ...query.state,
    status: 'error',
    error: new Error('The control plane did not answer.'),
    errorUpdateCount: 1,
    errorUpdatedAt: Date.now(),
  });
};
