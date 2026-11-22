import {
  repositoryNameKey,
  sameRepositoryName,
} from '@shared-kernel/domain/services/repository-names';
import { describe, expect, it } from 'vitest';

describe('repository names', () => {
  it('takes repository names in any case as one repository', () => {
    expect(repositoryNameKey('Acme/API')).toBe('acme/api');
    expect(sameRepositoryName('Acme/API', 'acme/api')).toBe(true);
    expect(sameRepositoryName('acme/api', 'acme/web')).toBe(false);
  });

  it('keeps no repository apart from any named one', () => {
    expect(repositoryNameKey(null)).toBeNull();
    expect(sameRepositoryName(null, null)).toBe(true);
    expect(sameRepositoryName(null, 'acme/api')).toBe(false);
  });
});
