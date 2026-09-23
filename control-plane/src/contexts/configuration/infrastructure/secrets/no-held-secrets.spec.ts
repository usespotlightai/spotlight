import { NoHeldSecrets } from '@configuration/infrastructure/secrets/no-held-secrets';
import { describe, expect, it } from 'vitest';

describe('NoHeldSecrets', () => {
  it('holds no secret for any team', async () => {
    await expect(new NoHeldSecrets().held()).resolves.toEqual([]);
  });
});
