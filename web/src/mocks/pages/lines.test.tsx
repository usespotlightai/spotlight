import { vi } from 'vitest';

import { linePages, sweepPages } from '@/mocks/pages/sweep';

vi.mock('@/hooks/api/useSession', async () => ({
  useSession: (await import('@/test/signed-in')).signedInSession,
}));

sweepPages(linePages());
