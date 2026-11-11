import { vi } from 'vitest';

import { sweepPages, workspacePages } from '@/mocks/pages/sweep';

vi.mock('@/hooks/api/useSession', async () => ({
  useSession: (await import('@/test/signed-in')).signedInSession,
}));

sweepPages(workspacePages());
