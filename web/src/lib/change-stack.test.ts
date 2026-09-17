import { describe, expect, it } from 'vitest';
import {
  type ChangeStack,
  changeStackPath,
  currentStacks,
  drafting,
  filesOf,
  layerAt,
  layerCheckOf,
  patchOf,
  settling,
  tallyOf,
  tookFor,
} from '@/lib/change-stack';

const stack = (over: Partial<ChangeStack> = {}): ChangeStack => ({
  id: 'stack_1',
  repository: null,
  state: 'ready',
  failure: null,
  draftedAt: '2026-09-16T10:00:00Z',
  settledAt: '2026-09-16T10:01:00Z',
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
          dependsOn: [],
          ranges: [{ hunk: 'h1', summary: 'The model itself' }],
        },
        {
          id: 'c1.l2',
          title: 'Mount the invitation routes',
          summary: 'The routes',
          dependsOn: [{ layer: 'c1.l1', because: ['Invite'] }],
          ranges: [
            { hunk: 'h3', summary: null },
            { hunk: 'h2', summary: null },
          ],
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
    const waiting = {
      command: 'npx tsc --noEmit',
      state: 'waiting' as const,
      reason: null,
      whole: null,
      layers: [],
    };

    expect(settling([stack({ check: waiting })])).toBe(true);
    expect(settling([stack({ check: { ...waiting, state: 'checked' } })])).toBe(
      false,
    );
    expect(settling([stack()])).toBe(false);
  });
});

describe('layerCheckOf', () => {
  const checked = stack({
    check: {
      command: 'npx tsc --noEmit',
      state: 'checked',
      reason: null,
      whole: { step: 'whole', passed: true, output: '', tookMs: 10 },
      layers: [
        { step: 'c1.l1', passed: false, output: 'TS2304', tookMs: 2400 },
      ],
    },
  });

  it('says what the check found for the layer', () => {
    expect(layerCheckOf(checked, layerAt(checked, 'c1.l1') as never)).toEqual({
      state: 'failed',
      command: 'npx tsc --noEmit',
      output: 'TS2304',
      tookMs: 2400,
    });
  });

  it('says why a layer went unchecked, and nothing where no check was named', () => {
    const skipped = stack({
      check: {
        command: 'go build ./...',
        state: 'skipped',
        reason: 'No runner checked the layers in time.',
        whole: null,
        layers: [],
      },
    });

    expect(layerCheckOf(skipped, layerAt(skipped, 'c1.l2') as never)).toEqual({
      state: 'skipped',
      command: 'go build ./...',
      reason: 'No runner checked the layers in time.',
    });
    expect(layerCheckOf(stack(), layerAt(stack(), 'c1.l1') as never)).toEqual({
      state: 'none',
    });
  });

  it('reads how long a check took', () => {
    expect(tookFor(400)).toBe('1s');
    expect(tookFor(41_000)).toBe('41s');
    expect(tookFor(125_000)).toBe('2m 5s');
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
    expect(files[0]?.hunks.map((each) => each.hunk.id)).toEqual(['h2', 'h3']);
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
