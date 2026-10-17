import { describe, expect, it } from 'vitest';
import {
  type ChangeStack,
  changeStackPath,
  currentStacks,
  drafting,
  filesOf,
  isLargeDiff,
  layerAt,
  patchOf,
  settling,
  tallyOf,
} from '@/lib/change-stack';

const checked = (state: 'waiting' | 'checked'): ChangeStack['check'] => ({
  command: 'npm test',
  state,
  reason: null,
  whole: null,
  layers: [],
});

const stack = (over: Partial<ChangeStack> = {}): ChangeStack => ({
  id: 'stack_1',
  repository: null,
  state: 'ready',
  failure: null,
  check: null,
  files: [
    {
      path: 'src/invite.ts',
      previousPath: null,
      status: 'added',
      binary: false,
      hunks: [
        {
          id: 'h1',
          oldStart: 0,
          oldLines: 0,
          newStart: 1,
          newLines: 2,
          patch:
            '@@ -0,0 +1,2 @@\n+export class Invite {}\n+export const x = 1;',
        },
      ],
    },
    {
      path: 'src/routes.ts',
      previousPath: 'src/router.ts',
      status: 'renamed',
      binary: false,
      hunks: [
        {
          id: 'h2',
          oldStart: 1,
          oldLines: 2,
          newStart: 1,
          newLines: 2,
          patch: '@@ -1,2 +1,2 @@\n import a;\n-mount();\n+mount(invite);',
        },
        {
          id: 'h3',
          oldStart: 9,
          oldLines: 1,
          newStart: 9,
          newLines: 1,
          patch: '@@ -9 +9 @@\n-old\n+new',
        },
      ],
    },
  ],
  cohorts: [
    {
      id: 'c1',
      kind: 'change',
      title: 'Team invitations',
      intent: 'Let admins invite people',
      layers: [
        {
          id: 'c1.l1',
          title: 'Add the invitation model',
          summary: 'The model',
          ranges: [{ hunk: 'h1' }],
          notes: [
            { path: 'src/invite.ts', note: 'Adds the invitation model.' },
          ],
        },
        {
          id: 'c1.l2',
          title: 'Mount the invitation routes',
          summary: 'The routes',
          ranges: [{ hunk: 'h3' }, { hunk: 'h2' }],
          notes: [],
        },
      ],
    },
  ],
  ...over,
});

describe('changeStackPath', () => {
  it('sits under the run', () => {
    expect(changeStackPath('acme', 'team_1', 'run 1')).toBe(
      '/w/acme/team/team_1/runs/run%201/changes',
    );
  });
});

describe('currentStacks', () => {
  it('keeps the newest stack of each repository', () => {
    const newest = stack({ id: 'newest', repository: 'web' });
    const older = stack({ id: 'older', repository: 'web' });
    const api = stack({ id: 'api', repository: 'api' });

    expect(currentStacks([newest, older, api]).map((each) => each.id)).toEqual([
      'newest',
      'api',
    ]);
  });

  it('says whether a current stack is still drafting', () => {
    expect(drafting([stack({ state: 'drafting' }), stack()])).toBe(true);
    expect(drafting([stack(), stack({ state: 'drafting' })])).toBe(false);
  });
});

describe('settling', () => {
  it('keeps asking while a stack drafts or waits for its check', () => {
    expect(settling([stack({ check: checked('waiting') })])).toBe(true);
    expect(settling([stack({ check: checked('checked') })])).toBe(false);
    expect(settling([stack()])).toBe(false);
  });
});

describe('layerAt', () => {
  it('finds the layer asked for, with where it stands in its cohort', () => {
    const found = layerAt(stack(), 'c1.l2');

    expect(found?.layer.title).toBe('Mount the invitation routes');
    expect(found?.position).toBe(2);
    expect(found?.cohort.id).toBe('c1');
  });

  it('falls back to the first layer', () => {
    expect(layerAt(stack(), 'nope')?.layer.id).toBe('c1.l1');
    expect(layerAt(stack({ cohorts: [] }), null)).toBeNull();
  });
});

describe('filesOf', () => {
  it('gathers a layer’s hunks by file, in the diff’s order', () => {
    const [layer] = stack().cohorts[0]?.layers.slice(1) ?? [];
    const files = filesOf(stack(), layer as never);

    expect(files).toHaveLength(1);
    expect(files[0]?.file.path).toBe('src/routes.ts');
    expect(files[0]?.hunks.map((each) => each.id)).toEqual(['h2', 'h3']);
    expect(files[0]?.note).toBeNull();
  });

  it('gives each file the layer’s note on it', () => {
    const [layer] = stack().cohorts[0]?.layers ?? [];
    const [file] = filesOf(stack(), layer as never);

    expect(file?.note).toBe('Adds the invitation model.');
  });
});

describe('patchOf', () => {
  it('heads a hunk with the paths either side of it', () => {
    const [added, renamed] = stack().files;

    expect(patchOf(added as never, added?.hunks[0] as never)).toMatch(
      /^--- \/dev\/null\n\+\+\+ b\/src\/invite\.ts\n@@/,
    );
    expect(patchOf(renamed as never, renamed?.hunks[0] as never)).toMatch(
      /^--- a\/src\/router\.ts\n\+\+\+ b\/src\/routes\.ts\n/,
    );
  });
});

describe('tallyOf', () => {
  it('counts the lines added and removed, not the header', () => {
    expect(tallyOf(stack().files[1]?.hunks ?? [])).toEqual({
      added: 2,
      removed: 2,
    });
  });
});

describe('isLargeDiff', () => {
  const hunk = (lines: number) => ({
    id: 'h1',
    oldStart: 0,
    oldLines: 0,
    newStart: 1,
    newLines: lines,
    patch: [
      '@@ -0,0 +1 @@',
      ...Array.from({ length: lines - 1 }, () => '+x'),
    ].join('\n'),
  });

  it('hides a diff over a thousand lines', () => {
    expect(isLargeDiff([hunk(600), hunk(401)])).toBe(true);
  });

  it('shows a diff of a thousand lines or fewer', () => {
    expect(isLargeDiff([hunk(1_000)])).toBe(false);
  });
});
