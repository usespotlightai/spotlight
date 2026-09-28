import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import {
  filesChangedIn,
  workspacePath,
} from '@work/domain/services/workspace-path';
import { describe, expect, it } from 'vitest';

const FOLDERS = ['api', 'web'];

describe('a path within the workspace', () => {
  it('begins at the checkout an absolute path runs through', () => {
    expect(
      workspacePath('/var/spotlight/runs/run_1/api/src/uploads.ts', FOLDERS),
    ).toBe('api/src/uploads.ts');
  });

  it('keeps a path already within the workspace', () => {
    expect(workspacePath('./web/src/App.tsx', FOLDERS)).toBe('web/src/App.tsx');
  });

  it('takes the first checkout it runs through', () => {
    expect(workspacePath('/work/api/src/web/client.ts', FOLDERS)).toBe(
      'api/src/web/client.ts',
    );
  });

  it('names nothing outside every checkout', () => {
    expect(workspacePath('/tmp/scratch.ts', FOLDERS)).toBeNull();
    expect(workspacePath('/work/api', FOLDERS)).toBeNull();
    expect(workspacePath('api/../../etc/passwd', FOLDERS)).toBeNull();
  });
});

describe('the files changed in a run', () => {
  const API = Repository.of('acme/api');
  const WEB = Repository.of('acme/web');

  it('name each file within a checkout in the repository of that folder', () => {
    expect(
      filesChangedIn(
        {
          checkouts: ['api', 'web'],
          paths: [
            '/runs/run_1/api/src/uploads.ts',
            '/runs/run_1/web/src/Upload.tsx',
            '/tmp/scratch.ts',
          ],
        },
        [API, WEB],
      ),
    ).toEqual([
      { repository: API, path: 'src/uploads.ts' },
      { repository: WEB, path: 'src/Upload.tsx' },
    ]);
  });

  it('leave out a checkout whose repository is not worked on', () => {
    expect(
      filesChangedIn(
        {
          checkouts: ['api', 'web'],
          paths: ['/runs/run_1/web/src/Upload.tsx'],
        },
        [API],
      ),
    ).toEqual([]);
  });
});
