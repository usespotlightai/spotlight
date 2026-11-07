import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { filesChangedIn } from '@work/domain/services/files-changed-in';
import { describe, expect, it } from 'vitest';

describe('the files changed in a workspace', () => {
  const API = Repository.of('acme/api');
  const WEB = Repository.of('acme/web');

  it('name each file within a checkout in the repository of that folder', () => {
    expect(
      filesChangedIn(
        ['api/src/uploads.ts', 'web/src/Upload.tsx', 'api'],
        [API, WEB],
      ),
    ).toEqual([
      { repository: API, path: 'src/uploads.ts' },
      { repository: WEB, path: 'src/Upload.tsx' },
    ]);
  });

  it('leave out a checkout whose repository is not worked on', () => {
    expect(filesChangedIn(['web/src/Upload.tsx'], [API])).toEqual([]);
  });
});
