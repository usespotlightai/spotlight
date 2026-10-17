import { InvalidFilePathError } from '@change-review/domain/exceptions/invalid-file-path.error';
import { FilePath } from '@change-review/domain/value-objects/file-path.vo';
import { describe, expect, it } from 'vitest';

describe('FilePath', () => {
  it('names a file from the repository’s root, whichever way it is written', () => {
    expect(FilePath.of(' /src/uploads.ts ').value).toBe('src/uploads.ts');
    expect(
      FilePath.of('//src/uploads.ts').equals(FilePath.of('src/uploads.ts')),
    ).toBe(true);
  });

  it('rejects a path that names no file', () => {
    expect(() => FilePath.of('  ')).toThrow(InvalidFilePathError);
    expect(() => FilePath.of('/')).toThrow(InvalidFilePathError);
  });
});
