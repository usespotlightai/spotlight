import { useMutation } from '@tanstack/react-query';
import { revealVaultKey } from '@/lib/api';

export function useRevealVaultKey(teamId: string) {
  return useMutation({
    mutationFn: async () => {
      const { data, response } = await revealVaultKey({
        path: { teamId },
      });

      if (response?.status === 403 || response?.status === 404) {
        return null;
      }
      if (!data) {
        throw new Error('Could not load the vault key');
      }
      return data;
    },
  });
}
