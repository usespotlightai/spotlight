import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { ReviewGitAccess } from '@work/domain/services/review-git-access';
import { describe, expect, it } from 'vitest';

describe('ReviewGitAccess', () => {
  it('lets review work fetch and nothing else', () => {
    expect(ReviewGitAccess.mayCall('git-upload-pack')).toBe(true);
    expect(ReviewGitAccess.mayCall('git-receive-pack')).toBe(false);
  });

  it('lets work that names no repository read any its task or run allows', () => {
    expect(ReviewGitAccess.mayRead(null, Repository.of('acme/api'))).toBe(true);
  });

  it('lets work that names a repository read only that one, in any case', () => {
    expect(ReviewGitAccess.mayRead('Web', Repository.of('acme/web'))).toBe(
      true,
    );
    expect(ReviewGitAccess.mayRead('Web', Repository.of('acme/api'))).toBe(
      false,
    );
  });

  it('lets work that names a repository it cannot parse read nothing', () => {
    expect(ReviewGitAccess.mayRead('../api', Repository.of('acme/api'))).toBe(
      false,
    );
  });
});
