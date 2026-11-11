import { fn } from 'storybook/test';

export const useSession = fn(() => ({
  data: {
    user: {
      id: 'user_1',
      name: 'Sam Rivera',
      email: 'sam@example.com',
      image: null,
    },
  },
  isPending: false,
  isRefetching: false,
  error: null,
  refetch: async () => undefined,
})).mockName('useSession');
