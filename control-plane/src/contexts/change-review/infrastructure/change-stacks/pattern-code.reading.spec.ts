import { factsOf } from '@change-review/domain/services/diff-facts';
import { GitDiffReader } from '@change-review/infrastructure/change-stacks/git-diff.reader';
import { PatternCodeReading } from '@change-review/infrastructure/change-stacks/pattern-code.reading';
import { describe, expect, it } from 'vitest';

const file = (path: string, lines: string[], removed: string[] = []) =>
  [
    `diff --git a/${path} b/${path}`,
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -1,${removed.length} +1,${lines.length} @@`,
    ...removed.map((line) => `-${line}`),
    ...lines.map((line) => `+${line}`),
  ].join('\n');

const reading = new PatternCodeReading();

const reader = new GitDiffReader();

const classOf = (path: string) => reading.classOf(path);

const factsFor = (...files: string[]) =>
  factsOf(reader.read(files.join('\n')).diff, reading);

describe('PatternCodeReading', () => {
  it('tells incidental files from the ones worth reading', () => {
    expect(classOf('web/package-lock.json')).toBe('lockfile');
    expect(classOf('go.sum')).toBe('lockfile');
    expect(classOf('web/src/lib/api/types.gen.ts')).toBe('generated');
    expect(classOf('control-plane/drizzle/meta/20260916_snapshot.json')).toBe(
      'generated',
    );
    expect(classOf('src/__snapshots__/Button.test.tsx.snap')).toBe('snapshot');
    expect(classOf('src/invite.spec.ts')).toBe('test');
    expect(classOf('runner/internal/session/base_test.go')).toBe('test');
    expect(classOf('tests/test_invite.py')).toBe('test');
    expect(classOf('README.md')).toBe('docs');
    expect(classOf('src/invite.ts')).toBe('source');
  });
});

describe('factsOf', () => {
  it('marks lockfiles, generated files and formatting-only changes incidental', () => {
    const facts = factsFor(
      file('package-lock.json', ['"zod": "4.4.3"'], ['"zod": "4.4.2"']),
      file('src/a.ts', ['const  total = 1;'], ['const total = 1;']),
      file('src/b.ts', ['export const invite = 1;']),
    );

    expect(facts.hunks.map((each) => [each.hunk, each.incidental])).toEqual([
      ['h1', true],
      ['h2', true],
      ['h3', false],
    ]);
  });

  it('finds what a hunk defines, by language', () => {
    const facts = factsFor(
      file('src/invite.ts', [
        'export class InvitationService {',
        '  async createInvitation(email: string): Promise<void> {',
        '  }',
        '}',
        'export type InviteRole = "admin";',
        'export const INVITE_LIMIT = 10;',
      ]),
      file('runner/base.go', [
        'func markBases(ctx context.Context) {',
        'type Checkout struct {',
      ]),
      file('api/invite.py', ['def send_invitation(email):', 'class Invite:']),
      file('db/001.sql', ['CREATE TABLE IF NOT EXISTS "invitation" (']),
    );

    expect(facts.hunks.map((each) => each.defines)).toEqual([
      ['InvitationService', 'createInvitation', 'InviteRole', 'INVITE_LIMIT'],
      ['markBases', 'Checkout'],
      ['send_invitation', 'Invite'],
      ['invitation'],
    ]);
  });

  it('links a hunk to the hunks that define what it uses', () => {
    const facts = factsFor(
      file('src/invite.ts', ['export function createInvitation() {}']),
      file('src/routes.ts', ['router.post("/invitations", createInvitation);']),
    );

    expect(facts.links).toEqual([
      { kind: 'uses', from: 'h2', to: 'h1', because: ['createInvitation'] },
    ]);
  });

  it('pairs a test with the source file it covers', () => {
    const facts = factsFor(
      file('src/invite.ts', ['export const ready = true;']),
      file('src/invite.spec.ts', ['it("works", () => {});']),
    );

    expect(facts.links).toEqual([
      { kind: 'tests', from: 'h2', to: 'h1', because: ['invite.ts'] },
    ]);
  });

  it('ignores names too common or too widely defined to mean anything', () => {
    const facts = factsFor(
      file('src/a.ts', ['const data = 1;', 'function helper() {}']),
      file('src/b.ts', ['function helper() {}']),
      file('src/c.ts', ['function helper() {}']),
      file('src/d.ts', ['function helper() {}']),
      file('src/e.ts', ['use(data, helper);']),
    );

    expect(facts.hunks[0]?.defines).toEqual(['helper']);
    expect(facts.links).toEqual([]);
  });

  it('draws no links to or from incidental changes', () => {
    const facts = factsFor(
      file('src/lib/api/sdk.gen.ts', ['export const readRunReview = 1;']),
      file('src/hooks/useRunReview.ts', ['readRunReview();']),
    );

    expect(facts.hunks[0]?.defines).toEqual([]);
    expect(facts.links).toEqual([]);
  });
});

describe('factsOf, further', () => {
  it('tells migrations and configuration from the rest', () => {
    expect(classOf('control-plane/drizzle/20260916_add_invites.sql')).toBe(
      'migration',
    );
    expect(classOf('db/migrations/001_invites.sql')).toBe('migration');
    expect(classOf('web/package.json')).toBe('config');
    expect(classOf('web/vite.config.ts')).toBe('config');
    expect(classOf('.github/workflows/ci.yml')).toBe('config');
    expect(classOf('compose.yml')).toBe('config');
  });

  it('pairs a test with the source it imports, whatever the test is called', () => {
    const facts = factsFor(
      file('src/lib/review.ts', ['export const ready = true;']),
      file('src/components/Thread.test.tsx', [
        "import { threadsOf } from '@/lib/review';",
      ]),
    );

    expect(facts.links).toEqual([
      { kind: 'tests', from: 'h2', to: 'h1', because: ['review.ts'] },
    ]);
  });

  it('marks a file that was only renamed incidental', () => {
    const facts = factsOf(
      reader.read(
        [
          'diff --git a/src/old.ts b/src/new.ts',
          'similarity index 100%',
          'rename from src/old.ts',
          'rename to src/new.ts',
        ].join('\n'),
      ).diff,
      reading,
    );

    expect(facts.hunks[0]).toMatchObject({ renamed: true, incidental: true });
  });

  it('links code moved from one place to another', () => {
    const moved = [
      'export function score(invite: Invite) {',
      '  const age = Date.now() - invite.sentAt;',
      '  return age > WEEK ? 0 : 1;',
      '}',
    ];
    const facts = factsFor(
      file('src/invite.ts', [], moved),
      file(
        'src/scoring.ts',
        moved.map((line) => `  ${line}`),
      ),
    );

    expect(facts.links).toContainEqual({
      kind: 'moves',
      from: 'h2',
      to: 'h1',
      because: ['src/invite.ts → src/scoring.ts'],
    });
    expect(facts.hunks.map((each) => each.moved)).toEqual([true, true]);
  });

  it('does not count a few repeated lines as a move', () => {
    const facts = factsFor(
      file('src/a.ts', [], ['}', '']),
      file('src/b.ts', ['}', '']),
    );

    expect(facts.links.filter((each) => each.kind === 'moves')).toEqual([]);
  });
});
