import { workingCopyPath } from '@runs/domain/services/working-copy-path';
import { describe, expect, it } from 'vitest';

const FOLDERS = ['api', 'web'];

describe('a path within the working copy', () => {
  it('begins at the checkout an absolute path runs through', () => {
    expect(
      workingCopyPath('/var/spotlight/runs/run_1/api/src/uploads.ts', FOLDERS),
    ).toBe('api/src/uploads.ts');
  });

  it('keeps a path already within the working copy', () => {
    expect(workingCopyPath('./web/src/App.tsx', FOLDERS)).toBe(
      'web/src/App.tsx',
    );
  });

  it('takes the first checkout it runs through', () => {
    expect(workingCopyPath('/work/api/src/web/client.ts', FOLDERS)).toBe(
      'api/src/web/client.ts',
    );
  });

  it('names nothing outside every checkout', () => {
    expect(workingCopyPath('/tmp/scratch.ts', FOLDERS)).toBeNull();
    expect(workingCopyPath('/work/api', FOLDERS)).toBeNull();
    expect(workingCopyPath('api/../../etc/passwd', FOLDERS)).toBeNull();
  });
});
