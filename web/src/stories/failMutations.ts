import type { QueryClient } from '@tanstack/react-query';

export const failMutations = (client: QueryClient) => {
  client.getMutationCache().config.onMutate = () => {
    throw new Error('Control plane didn’t respond.');
  };
};
