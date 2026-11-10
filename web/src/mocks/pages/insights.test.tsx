import { vi } from 'vitest';
import { insightsPages, sweepPages } from '@/mocks/pages/sweep';

vi.mock('@/hooks/api/useSession', async () => ({
  useSession: (await import('@/test/signed-in')).signedInSession,
}));

sweepPages(insightsPages());
