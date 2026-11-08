import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import { ReviewAnchor } from '@change-review/domain/value-objects/review-anchor.vo';
import { describe, expect, it } from 'vitest';

const DOCS = RepositoryName.of('docs');
const WEB = RepositoryName.of('web');

describe('ReviewAnchor', () => {
  it('keeps the repository the file is in', () => {
    expect(
      ReviewAnchor.at({
        repository: 'docs',
        path: 'guide.md',
        side: 'new',
        line: 4,
        startLine: null,
      }).repository?.value,
    ).toBe('docs');
    expect(
      ReviewAnchor.at({
        repository: '  ',
        path: 'guide.md',
        side: null,
        line: null,
        startLine: null,
      }).repository,
    ).toBeNull();
  });

  it('is in its own repository, and an anchor that names none is in any', () => {
    expect(ReviewAnchor.onFile('a.ts', DOCS).isIn(DOCS)).toBe(true);
    expect(ReviewAnchor.onFile('a.ts', DOCS).isIn(WEB)).toBe(false);
    expect(ReviewAnchor.onFile('a.ts').isIn(WEB)).toBe(true);
    expect(ReviewAnchor.onFile('a.ts', DOCS).isIn(null)).toBe(true);
  });

  it('tells the same file in another repository apart', () => {
    expect(
      ReviewAnchor.onFile('README.md', DOCS).sameFileAs(
        ReviewAnchor.onFile('README.md', WEB),
      ),
    ).toBe(false);
    expect(
      ReviewAnchor.onFile('README.md', DOCS).sameFileAs(
        ReviewAnchor.onFile('README.md', RepositoryName.of('Docs')),
      ),
    ).toBe(true);
  });

  it('equals only an anchor in the same repository', () => {
    const on = (repository: RepositoryName | null) =>
      ReviewAnchor.onLines({ repository, path: 'a.ts', side: 'new', line: 2 });

    expect(on(DOCS).equals(on(DOCS))).toBe(true);
    expect(on(DOCS).equals(on(null))).toBe(false);
    expect(on(DOCS).samePlaceAs(on(null))).toBe(true);
    expect(on(DOCS).samePlaceAs(on(WEB))).toBe(false);
  });
});
