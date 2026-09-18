import type { QueryClient } from '@tanstack/react-query';

export const failMutations = (client: QueryClient) => {
  client.getMutationCache().config.onMutate = () => {
    throw new Error('The control plane did not answer.');
  };
};
