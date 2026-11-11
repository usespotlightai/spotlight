import type { LineDefinition } from '@lines/application/contracts/line-definition.contract';
import type { Line } from '@lines/domain/aggregates/line.aggregate';
import { createLine } from '@lines/domain/services/reconcile-line';
import { LineSearchPolicy } from '@lines/domain/value-objects/search-policy.vo';
import { compileLine } from '@lines/infrastructure/lines/line.compile';
import { renderLine } from '@lines/infrastructure/lines/line-definition.render';
import type { LineFields } from '@lines/infrastructure/lines/line-definition.schema';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

type SameKeys<A, B> = [keyof A] extends [keyof B]
  ? [keyof B] extends [keyof A]
    ? true
    : false
  : false;

type DeeplySameKeys<A, B> = [A] extends [readonly (infer OfA)[]]
  ? [B] extends [readonly (infer OfB)[]]
    ? DeeplySameKeys<OfA, OfB>
    : false
  : [A] extends [object]
    ? [B] extends [object]
      ? SameKeys<A, B> extends true
        ? false extends {
            [K in keyof A & keyof B]-?: DeeplySameKeys<
              NonNullable<A[K]>,
              NonNullable<B[K]>
            >;
          }[keyof A & keyof B]
          ? false
          : true
        : false
      : false
    : true;

const WORKSPACE = WorkspaceId.of('ws_1');

const lineOf = (definition: unknown): Line => {
  const compiled = compileLine(definition);

  if (!compiled.ok) {
    throw new Error(compiled.problems.map((each) => each.reason).join('; '));
  }

  let next = 0;

  return createLine({
    identity: {
      id: LineId.of('line_1'),
      workspaceId: WORKSPACE,
      teamId: TeamId.of('team_1'),
    },
    plan: compiled.line,
    newId: () => `station_${++next}`,
    by: ChangeActor.spotlight(WORKSPACE),
  });
};

const BUILD = {
  key: 'build',
  name: 'Build',
  harness: 'claude-code',
  prompt: 'Build it.',
  tools: ['linear.comment'],
  skills: ['grafana'],
  ends: true,
};

const DELIVERY = {
  key: 'delivery',
  name: 'Delivery',
  repositories: [{ name: 'acme/api' }],
  stations: [
    { key: 'backlog', name: 'Backlog', kind: 'backlog', passesTo: ['build'] },
    BUILD,
    { key: 'completed', name: 'Completed', kind: 'completed' },
  ],
  reactions: [{ happening: 'github.pull_request.merged', to: 'completed' }],
};

const rendered = (over: Record<string, unknown> = {}): LineDefinition =>
  renderLine(lineOf({ ...DELIVERY, ...over }));

const withBuild = (build: Record<string, unknown>) => ({
  stations: [
    DELIVERY.stations[0],
    { ...BUILD, ...build },
    DELIVERY.stations[2],
  ],
});

describe('renderLine', () => {
  it('reads the same keys the published definition has', () => {
    const matches: DeeplySameKeys<LineFields, LineDefinition> = true;

    expect(matches).toBe(true);
  });

  it('renders a line as a definition, naming stations by key', () => {
    const definition = rendered();

    expect(definition.stations.map((each) => each.passesTo)).toEqual([
      ['build'],
      [],
      [],
    ]);
    expect(definition.stations[1]).toMatchObject({
      harness: 'claude-code',
      prompt: 'Build it.',
      tools: ['linear.comment'],
      skills: ['grafana'],
      ends: true,
    });
    expect(definition.reactions).toEqual([
      { happening: 'github.pull_request.merged', to: 'completed' },
    ]);
  });

  it('renders back the definition it was compiled from', () => {
    const definition = {
      key: 'delivery',
      name: 'Delivery',
      repositories: [{ name: 'acme/api' }],
      warmSandboxes: 0,
      stations: [
        {
          key: 'backlog',
          name: 'Backlog',
          kind: 'backlog',
          color: '#a3a8b0',
          diffs: false,
          decisions: false,
          memories: false,
          alerts: [],
          tools: [],
          skills: [],
          passesTo: ['build'],
          ends: false,
        },
        {
          key: 'build',
          name: 'Build',
          kind: 'work',
          color: '#6d78d5',
          harness: 'claude-code',
          prompt: 'Build it.\n',
          diffs: false,
          decisions: false,
          memories: false,
          alerts: [],
          tools: ['linear.comment'],
          skills: ['grafana'],
          passesTo: [],
          ends: true,
        },
        {
          key: 'completed',
          name: 'Completed',
          kind: 'completed',
          color: '#a3a8b0',
          diffs: false,
          decisions: false,
          memories: false,
          alerts: [],
          tools: [],
          skills: [],
          passesTo: [],
          ends: false,
        },
      ],
      reactions: [{ happening: 'github.pull_request.merged', to: 'completed' }],
    };

    expect(renderLine(lineOf(definition))).toEqual(definition);
  });

  it('renders the threshold a planned change is checked against only where the line has one, with the domain defaults', () => {
    expect(rendered({ replayCheck: {} }).replayCheck).toEqual({
      maxRegressions: 0,
      ceiling: 10,
      currency: 'USD',
      minGain: 0.05,
    });
    expect(
      rendered({ replayCheck: { maxRegressions: 1, ceiling: 12.5 } })
        .replayCheck,
    ).toEqual({
      maxRegressions: 1,
      ceiling: 12.5,
      currency: 'USD',
      minGain: 0.05,
    });
    expect(Object.keys(rendered())).not.toContain('replayCheck');
  });

  it('renders the line’s search policy whole wherever the line has one, and a station’s own search settings with only what it sets', () => {
    const definition = rendered({
      search: { monthlyCeiling: 80, onAlert: false },
      ...withBuild({
        search: {
          enabled: false,
          period: '12h',
          cooldown: '6h',
          agent: { harness: 'claude-code', effort: 'high' },
          iterations: 4,
          objective: 'cost',
        },
      }),
    });

    expect(definition.search).toEqual({
      enabled: true,
      monthlyCeiling: 80,
      currency: 'USD',
      ceiling: 10,
      period: '7d',
      onAlert: false,
      cooldown: '3d',
    });
    expect(definition.stations[1]?.search).toEqual({
      enabled: false,
      period: '12h',
      cooldown: '6h',
      agent: { harness: 'claude-code', effort: 'high' },
      iterations: 4,
      objective: 'cost',
    });
    expect(Object.keys(definition.stations[0] ?? {})).not.toContain('search');
    expect(Object.keys(rendered())).not.toContain('search');
    expect(rendered({ search: {} }).search).toEqual(
      LineSearchPolicy.DEFAULT.toPrimitives(),
    );
    expect(compileLine(definition).ok).toBe(true);
  });

  it('renders where the line’s Terraform lives only where it says', () => {
    expect(
      rendered({
        source: { repository: 'acme/platform', path: 'teams/core.tf' },
      }).source,
    ).toEqual({ repository: 'acme/platform', path: 'teams/core.tf' });
    expect(Object.keys(rendered())).not.toContain('source');
  });

  it('leaves out what a station does not have', () => {
    expect(Object.keys(rendered().stations[0] ?? {})).not.toContain('harness');
  });

  it('renders how many warm sandboxes a line keeps, 0 where it names none', () => {
    expect(rendered({ warmSandboxes: 3 }).warmSandboxes).toBe(3);
    expect(rendered().warmSandboxes).toBe(0);
  });

  it('renders where a line and its stations may run, and leaves it out when anywhere', () => {
    const definition = rendered({
      runners: ['vpc-internal'],
      ...withBuild({ runners: ['gpu'] }),
    });

    expect(definition.runners).toEqual(['vpc-internal']);
    expect(definition.stations[1]?.runners).toEqual(['gpu']);
    expect(Object.keys(definition.stations[0] ?? {})).not.toContain('runners');
    expect(Object.keys(rendered())).not.toContain('runners');
  });

  it('renders a judge only where there is one, and alerts in their order with only the threshold they set', () => {
    const definition = rendered(
      withBuild({
        judge: {
          rubric: 'A good run is small.\n',
          sample: 0.2,
          minAgreement: 0.6,
        },
        alerts: [
          { measure: 'sent_back_rate', risesBy: 0.2, over: 20 },
          { measure: 'cost_per_run', above: 2, over: 10 },
          { measure: 'accepted_rate', fallsBy: 0.1, over: 20 },
          { measure: 'merged_rate', below: 0.4, over: 20 },
        ],
      }),
    );

    expect(definition.stations[1]?.judge).toEqual({
      rubric: 'A good run is small.\n',
      sample: 0.2,
      minAgreement: 0.6,
    });
    expect(definition.stations[1]?.alerts).toEqual([
      { measure: 'sent_back_rate', risesBy: 0.2, over: 20 },
      { measure: 'cost_per_run', above: 2, over: 10 },
      { measure: 'accepted_rate', fallsBy: 0.1, over: 20 },
      { measure: 'merged_rate', below: 0.4, over: 20 },
    ]);
    expect(Object.keys(definition.stations[0] ?? {})).not.toContain('judge');
    expect(definition.stations[0]?.alerts).toEqual([]);
  });

  it('renders a judge’s claims and pass threshold only where it lists claims, and no rubric where it has none', () => {
    expect(
      rendered(
        withBuild({
          judge: {
            claims: ['It adds a test.'],
            passThreshold: 0.5,
            sample: 0.2,
            minAgreement: 0.6,
          },
        }),
      ).stations[1]?.judge,
    ).toEqual({
      claims: ['It adds a test.'],
      passThreshold: 0.5,
      sample: 0.2,
      minAgreement: 0.6,
    });
  });

  it('renders routes and reactions in station order, whatever order they were written in', () => {
    const definition = rendered({
      stations: [
        {
          key: 'backlog',
          name: 'Backlog',
          kind: 'backlog',
          passesTo: ['check', 'build'],
        },
        { ...BUILD, ends: false, passesTo: ['check'] },
        { key: 'check', name: 'Check', ends: true },
        { key: 'completed', name: 'Completed', kind: 'completed' },
      ],
      reactions: [
        {
          happening: 'github.pull_request.merged',
          from: 'build',
          to: 'completed',
        },
        { happening: 'github.checks.failed', from: 'check', to: 'build' },
        { happening: 'github.pull_request.merged', to: 'completed' },
      ],
    });

    expect(definition.stations[0]?.passesTo).toEqual(['build', 'check']);
    expect(definition.reactions).toEqual([
      { happening: 'github.checks.failed', from: 'check', to: 'build' },
      { happening: 'github.pull_request.merged', to: 'completed' },
      {
        happening: 'github.pull_request.merged',
        from: 'build',
        to: 'completed',
      },
    ]);
  });

  it('renders repositories in code point order, with the image and setup each names', () => {
    const definition = rendered({
      repositories: [
        {
          name: 'acme/web',
          image: 'ghcr.io/acme/app:1',
          setup: 'pnpm install\n',
        },
        { name: 'acme/api', image: 'ghcr.io/acme/app:1' },
      ],
    });

    expect(definition.repositories).toEqual([
      { name: 'acme/api', image: 'ghcr.io/acme/app:1' },
      {
        name: 'acme/web',
        image: 'ghcr.io/acme/app:1',
        setup: 'pnpm install\n',
      },
    ]);
    expect(compileLine(definition).ok).toBe(true);
  });

  it('renders the text a station was defined with byte for byte, trailing newlines included', () => {
    const written = {
      description: 'Builds the change.\n',
      prompt: 'Implement the task.\n',
      check: 'npm test\n',
    };

    expect(
      rendered({
        repositories: [{ name: 'acme/api', setup: 'npm ci\n' }],
        ...withBuild({ ...written, diffs: true }),
      }).stations[1],
    ).toMatchObject(written);
  });

  it('renders a review policy only on the line that has one', () => {
    const definition = rendered({
      role: 'review',
      reviews: { start: 'opened', skip: { authors: ['Dependabot[bot]'] } },
    });

    expect(definition.reviews).toEqual({
      start: 'opened',
      mention: '@spotlight',
      label: 'spotlight',
      skip: { spotlight: true, drafts: true, authors: ['dependabot[bot]'] },
    });
    expect(Object.keys(rendered())).not.toContain('reviews');
  });
});
