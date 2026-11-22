import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import type { INestApplication } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { eq } from 'drizzle-orm';
import fc from 'fast-check';
import type { Test } from 'supertest';
import { afterAll, beforeAll, describe, it } from 'vitest';

import { type Answer, openApp, served, TEST_USER_HEADER } from './support/app';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

type Fields = Readonly<Record<string, unknown>>;

type Stored = Fields & {
  readonly id: string;
  readonly version: number;
  readonly address: string;
};

interface Draft {
  readonly body: Fields;
  readonly expected: Fields;
}

interface ResourceKind {
  readonly kind: string;
  readonly plural: string;
  readonly keys: fc.Arbitrary<string>;
  readonly drafts: (key: string) => fc.Arbitrary<Draft>;
  readonly writable: (stored: Fields) => unknown;
  readonly parts: (
    db: DrizzleDatabase,
    id: string,
  ) => Promise<ReadonlyMap<string, string>>;
}

const RUNS = { numRuns: 12 };
const TIMEOUT = 120_000;
const CONFLICT = 'urn:spotlight:problem:version-conflict';
const NOT_FOUND = 'urn:spotlight:problem:not-found';

const slug = fc.stringMatching(/^[a-z][a-z0-9]{0,7}(-[a-z0-9]{1,6}){0,2}$/);

const padding = fc.constantFrom('', ' ', '  ', '\t', '\n');

const written = fc
  .tuple(padding, fc.string({ minLength: 1, maxLength: 30 }), padding)
  .filter(([, text]) => text.trim().length > 0);

const share = fc.double({ min: 0, max: 1, noNaN: true });
const positiveShare = fc.double({
  min: 0,
  max: 1,
  minExcluded: true,
  noNaN: true,
});

const someOf = <T>(items: readonly T[], most: number): fc.Arbitrary<T[]> =>
  fc.shuffledSubarray([...items], {
    maxLength: Math.min(most, items.length),
  });

const WORK_KEYS = [
  'triage',
  'implementation',
  'code-review',
  'verify',
  'ship',
] as const;
const PLAIN_COLOR = '#a3a8b0';
const TOOLS = [
  'pull-request',
  'checks',
  'open-tasks',
  'review',
  'review-comment',
  'linear.comment',
];
const SKILLS = ['grafana', 'runbooks', 'deploys'];
const HAPPENINGS = [
  'github.checks.failed',
  'github.pull_request.merged',
  'linear.issue.created',
];
const REPOSITORIES = [
  'acme/api',
  'acme/web',
  'Acme/Docs',
  'tools/cli',
  'acme/infra',
];
const IMAGES = [
  'ghcr.io/acme/runner:main',
  `ghcr.io/acme/runner@sha256:${'e'.repeat(64)}`,
];
const MEASURES = [
  'sent_back_rate',
  'accepted_rate',
  'checks_failed_rate',
  'failed_rate',
  'merged_rate',
  'cost_per_run',
] as const;
const CONDITIONS = ['risesBy', 'above', 'fallsBy', 'below'] as const;

const alert = fc
  .record({
    measure: fc.constantFrom(...MEASURES),
    condition: fc.constantFrom(...CONDITIONS),
    rate: positiveShare,
    amount: fc.double({ min: 0, max: 500, minExcluded: true, noNaN: true }),
    over: fc.integer({ min: 1, max: 500 }),
  })
  .map(({ measure, condition, rate, amount, over }) => ({
    measure,
    [condition]: measure === 'cost_per_run' ? amount : rate,
    over,
  }));

const alerts = fc.uniqueArray(alert, {
  maxLength: 3,
  selector: (each) =>
    `${each.measure}:${CONDITIONS.find((condition) => condition in each)}`,
});

const judge = fc.record({
  claims: fc.array(written, { minLength: 1, maxLength: 3 }),
  passThreshold: fc.option(positiveShare, { nil: undefined }),
  sample: share,
  minAgreement: share,
});

type Judge = typeof judge extends fc.Arbitrary<infer T> ? T : never;

const writtenJudge = (each: Judge) => ({
  claims: each.claims.map(([before, text, after]) => before + text + after),
  ...(each.passThreshold === undefined
    ? {}
    : { passThreshold: each.passThreshold }),
  sample: each.sample,
  minAgreement: each.minAgreement,
});

const storedJudge = (each: Judge) => ({
  claims: each.claims.map(([before, text, after]) =>
    (before + text + after).trim(),
  ),
  passThreshold: each.passThreshold ?? 1,
  sample: each.sample,
  minAgreement: each.minAgreement,
});

const color = fc.option(
  fc
    .tuple(fc.stringMatching(/^#[0-9a-f]{6}$/), fc.boolean())
    .map(([hex, upper]) => ({ hex, written: upper ? hex.toUpperCase() : hex })),
  { nil: undefined },
);

const workStation = (key: string, keys: readonly string[]) =>
  fc.record({
    key: fc.constant(key),
    name: written,
    color,
    kindWritten: fc.boolean(),
    explicit: fc.boolean(),
    description: fc.option(written, { nil: undefined }),
    harness: fc.option(fc.constantFrom('claude-code', 'codex'), {
      nil: undefined,
    }),
    model: fc.option(fc.constantFrom('opus', 'gpt-5', 'sonnet-4'), {
      nil: undefined,
    }),
    effort: fc.option(fc.constantFrom('low', 'medium', 'high', 'max'), {
      nil: undefined,
    }),
    profile: fc.option(fc.constantFrom('careful', 'fast'), { nil: undefined }),
    prompt: fc.option(
      fc
        .tuple(written, fc.constantFrom('', '\n'))
        .map(([parts, ending]) => [...parts, ending]),
      { nil: undefined },
    ),
    check: fc.option(fc.constantFrom('npm test', 'make check\n'), {
      nil: undefined,
    }),
    diffs: fc.boolean(),
    decisions: fc.boolean(),
    memories: fc.boolean(),
    judge: fc.option(judge, { nil: undefined }),
    alerts,
    tools: someOf(TOOLS, 3),
    skills: someOf(SKILLS, 2),
    passesTo: someOf(
      keys.filter((each) => each !== key),
      3,
    ),
    ends: fc.boolean(),
  });

type WorkStation =
  ReturnType<typeof workStation> extends fc.Arbitrary<infer T> ? T : never;

const repository = fc.record({
  imaged: fc.boolean(),
  setup: fc.option(fc.constantFrom('npm ci', 'pnpm install\n'), {
    nil: undefined,
  }),
  dotGit: fc.boolean(),
});

const line = (keys: readonly string[]) => {
  const stationKeys = ['backlog', ...keys, 'completed'];

  return fc.record({
    name: written,
    backlogName: written,
    completedName: written,
    backlogColor: color,
    backlogPassesTo: someOf(keys, 3),
    work: fc.tuple(...keys.map((key) => workStation(key, keys))),
    repositories: someOf(REPOSITORIES, 3).chain((names) =>
      fc.tuple(
        ...names.map((name) => repository.map((each) => ({ name, ...each }))),
      ),
    ),
    image: fc.constantFrom(...IMAGES),
    reactions: fc.uniqueArray(
      fc.record({
        happening: fc.constantFrom(...HAPPENINGS),
        from: fc.option(fc.constantFrom(...stationKeys), { nil: null }),
        to: fc.constantFrom(...stationKeys),
      }),
      {
        maxLength: 4,
        selector: (each) => `${each.happening}@${each.from ?? ''}`,
      },
    ),
    warmSandboxes: fc.option(fc.integer({ min: 0, max: 5 }), {
      nil: undefined,
    }),
    replayCheck: fc.option(
      fc.record(
        {
          maxRegressions: fc.integer({ min: 0, max: 5 }),
          ceiling: fc.double({
            min: 0,
            max: 1000,
            minExcluded: true,
            noNaN: true,
          }),
          currency: fc.constantFrom('usd', 'EUR', 'Gbp'),
          minGain: positiveShare,
        },
        { requiredKeys: [], noNullPrototype: true },
      ),
      { nil: undefined },
    ),
    source: fc.option(
      fc.record(
        {
          repository: fc.constantFrom('acme/platform', 'acme/config'),
          path: fc.constantFrom('main.tf', 'teams/core/delivery.tf'),
        },
        { noNullPrototype: true },
      ),
      { nil: undefined },
    ),
  });
};

type LineModel =
  ReturnType<typeof line> extends fc.Arbitrary<infer T> ? T : never;

const joined = (parts: readonly string[]): string => parts.join('');

const trimmed = (parts: readonly string[]): string => joined(parts).trim();

const present = <V>(key: string, value: V | undefined): Fields =>
  value === undefined ? {} : { [key]: value };

const lineDraft = (
  key: string,
  keys: readonly string[],
  model: LineModel,
): Draft => {
  const position = (station: string): number =>
    ['backlog', ...keys, 'completed'].indexOf(station);
  const byPosition = (stations: readonly string[]): string[] =>
    [...stations].sort((one, other) => position(one) - position(other));
  const checksLayers = model.work.some(
    (each) => each.check !== undefined && each.diffs,
  );
  const repositories = model.repositories.map((each) => ({
    name: each.name,
    image: each.imaged ? model.image : undefined,
    setup: each.setup ?? (checksLayers ? 'npm ci' : undefined),
    written: each.dotGit ? `${each.name}.git` : each.name,
  }));

  const writtenWork = (each: WorkStation): Fields => ({
    key: each.key,
    name: joined(each.name),
    ...(each.kindWritten ? { kind: 'work' } : {}),
    ...present('color', each.color?.written),
    ...present('description', each.description && joined(each.description)),
    ...present('harness', each.harness),
    ...present('model', each.model),
    ...present('effort', each.effort),
    ...present('profile', each.profile),
    ...present('prompt', each.prompt && joined(each.prompt)),
    ...present('check', each.check),
    ...(each.explicit || !each.diffs ? { diffs: each.diffs } : {}),
    ...(each.explicit || !each.decisions ? { decisions: each.decisions } : {}),
    ...(each.explicit || !each.memories ? { memories: each.memories } : {}),
    ...present('judge', each.judge && writtenJudge(each.judge)),
    ...(each.explicit || each.alerts.length > 0 ? { alerts: each.alerts } : {}),
    ...(each.explicit || each.tools.length > 0 ? { tools: each.tools } : {}),
    ...(each.explicit || each.skills.length > 0 ? { skills: each.skills } : {}),
    ...(each.explicit || each.passesTo.length > 0
      ? { passesTo: each.passesTo }
      : {}),
    ...(each.explicit || each.ends ? { ends: each.ends } : {}),
  });

  const storedWork = (each: WorkStation): Fields => ({
    key: each.key,
    name: trimmed(each.name),
    kind: 'work',
    color: each.color?.hex ?? PLAIN_COLOR,
    ...present('description', each.description && joined(each.description)),
    ...present('harness', each.harness),
    ...present('model', each.model),
    ...present('effort', each.effort),
    ...present('profile', each.profile),
    ...present('prompt', each.prompt && joined(each.prompt)),
    ...present('check', each.check),
    diffs: each.diffs,
    decisions: each.decisions,
    memories: each.memories,
    ...present('judge', each.judge && storedJudge(each.judge)),
    alerts: each.alerts,
    tools: each.tools,
    skills: each.skills,
    passesTo: byPosition(each.passesTo),
    ends: each.ends,
  });

  const idle = (
    station: 'backlog' | 'completed',
    name: readonly string[],
    shown: LineModel['backlogColor'],
    passesTo: readonly string[],
  ) => ({
    body: {
      key: station,
      name: joined(name),
      kind: station,
      ...present('color', shown?.written),
      ...(passesTo.length > 0 ? { passesTo } : {}),
    },
    expected: {
      key: station,
      name: trimmed(name),
      kind: station,
      color: shown?.hex ?? PLAIN_COLOR,
      diffs: false,
      decisions: false,
      memories: false,
      alerts: [],
      tools: [],
      skills: [],
      passesTo: byPosition(passesTo),
      ends: false,
    },
  });

  const backlog = idle(
    'backlog',
    model.backlogName,
    model.backlogColor,
    model.backlogPassesTo,
  );
  const completed = idle('completed', model.completedName, undefined, []);
  const replayCheck = model.replayCheck && {
    maxRegressions: model.replayCheck.maxRegressions ?? 0,
    ceiling: model.replayCheck.ceiling ?? 10,
    currency: (model.replayCheck.currency ?? 'usd').toUpperCase(),
    minGain: model.replayCheck.minGain ?? 0.05,
  };
  const reactionOrder = (
    one: LineModel['reactions'][number],
    other: LineModel['reactions'][number],
  ): number =>
    (one.happening < other.happening ? -1 : 0) ||
    (one.happening > other.happening ? 1 : 0) ||
    (one.from === null ? -1 : position(one.from)) -
      (other.from === null ? -1 : position(other.from)) ||
    position(one.to) - position(other.to);

  return {
    body: {
      key,
      name: joined(model.name),
      ...(repositories.length > 0
        ? {
            repositories: repositories.map((each) => ({
              name: each.written,
              ...present('image', each.image),
              ...present('setup', each.setup),
            })),
          }
        : {}),
      stations: [backlog.body, ...model.work.map(writtenWork), completed.body],
      ...(model.reactions.length > 0
        ? {
            reactions: model.reactions.map((each) => ({
              happening: each.happening,
              ...(each.from === null ? {} : { from: each.from }),
              to: each.to,
            })),
          }
        : {}),
      ...present('warmSandboxes', model.warmSandboxes),
      ...present('replayCheck', model.replayCheck),
      ...present('source', model.source),
    },
    expected: {
      key,
      name: trimmed(model.name),
      repositories: [...repositories]
        .sort((one, other) => (one.name < other.name ? -1 : 1))
        .map((each) => ({
          name: each.name,
          ...present('image', each.image),
          ...present('setup', each.setup),
        })),
      warmSandboxes: model.warmSandboxes ?? 0,
      stations: [
        backlog.expected,
        ...model.work.map(storedWork),
        completed.expected,
      ],
      reactions: [...model.reactions].sort(reactionOrder).map((each) => ({
        happening: each.happening,
        ...(each.from === null ? {} : { from: each.from }),
        to: each.to,
      })),
      ...present('replayCheck', replayCheck),
      ...present('source', model.source),
    },
  };
};

const LINES: ResourceKind = {
  kind: 'line',
  plural: 'lines',
  keys: slug,
  drafts: (key) =>
    fc
      .uniqueArray(fc.constantFrom(...WORK_KEYS), { maxLength: 4 })
      .chain((keys) => line(keys).map((model) => lineDraft(key, keys, model))),
  writable: (stored) => stored.definition,
  parts: async (db, id) =>
    new Map(
      (
        await db
          .select({ key: schema.station.key, id: schema.station.id })
          .from(schema.station)
          .where(eq(schema.station.lineId, id))
      ).map((each) => [each.key, each.id]),
    ),
};

const RULE_KINDS = ['read', 'edit', 'execute'] as const;
const DECISIONS = ['allow', 'ask', 'deny'] as const;
const PATTERNS = [
  'npm test *',
  '.env',
  'git push *',
  'src/**',
  'docs/*.md',
  'secrets/**',
];
const NATIVE: readonly Fields[] = [
  {},
  { 'claude-code': { includeCoAuthoredBy: false } },
  { codex: 'model_verbosity = "low"\n' },
  {
    'claude-code': { includeCoAuthoredBy: false, env: { FOO: 'bar' } },
    codex: 'model_verbosity = "low"\n',
  },
];

const rule = fc.record({
  decision: fc.constantFrom(...DECISIONS),
  kind: fc.constantFrom(...RULE_KINDS),
  pattern: fc.option(fc.constantFrom(...PATTERNS), { nil: null }),
  inside: padding,
  outside: padding,
});

const server = fc.record({
  name: fc.constantFrom('linear', 'github', 'sentry', 'grafana-cloud'),
  command: fc.constantFrom('npx', 'uvx', 'node'),
  around: padding,
  args: fc.array(fc.string({ maxLength: 12 }), { maxLength: 3 }),
  env: fc.dictionary(
    fc.stringMatching(/^[A-Z_][A-Z0-9_]{0,10}$/),
    fc.stringMatching(/^[a-z0-9 ._-]{0,12}$/),
    { maxKeys: 3, noNullPrototype: true },
  ),
  explicit: fc.boolean(),
});

const profile = fc.record({
  rules: fc.uniqueArray(rule, {
    maxLength: 6,
    selector: (each) => `${each.kind}(${each.pattern ?? ''})`,
  }),
  servers: fc.uniqueArray(server, {
    maxLength: 3,
    selector: (each) => each.name,
  }),
  native: fc.constantFrom(...NATIVE),
  explicit: fc.boolean(),
});

type ProfileModel = typeof profile extends fc.Arbitrary<infer T> ? T : never;

const profileDraft = (key: string, model: ProfileModel): Draft => {
  const listed = (decision: (typeof DECISIONS)[number], shown: boolean) =>
    model.rules
      .filter((each) => each.decision === decision)
      .map((each) =>
        shown
          ? `${each.kind}${each.pattern === null ? '' : `(${each.pattern})`}`
          : `${each.outside}${each.kind}${each.pattern === null ? '' : `(${each.inside}${each.pattern}${each.inside})`}${each.outside}`,
      );
  const permissions = (shown: boolean) =>
    Object.fromEntries(
      DECISIONS.flatMap((decision) => {
        const rules = listed(decision, shown);

        return shown || model.explicit || rules.length > 0
          ? [[decision, rules]]
          : [];
      }),
    );

  return {
    body: {
      key,
      ...(model.explicit || model.rules.length > 0
        ? { permissions: permissions(false) }
        : {}),
      ...(model.explicit || model.servers.length > 0
        ? {
            mcpServers: model.servers.map((each) => ({
              name: `${each.around}${each.name}${each.around}`,
              command: `${each.around}${each.command}${each.around}`,
              ...(each.explicit || each.args.length > 0
                ? { args: each.args }
                : {}),
              ...(each.explicit || Object.keys(each.env).length > 0
                ? { env: each.env }
                : {}),
            })),
          }
        : {}),
      ...(model.explicit || Object.keys(model.native).length > 0
        ? { native: model.native }
        : {}),
    },
    expected: {
      key,
      permissions: permissions(true),
      mcpServers: model.servers.map((each) => ({
        name: each.name,
        command: each.command,
        args: each.args,
        env: each.env,
      })),
      native: model.native,
    },
  };
};

const PROFILES: ResourceKind = {
  kind: 'harness profile',
  plural: 'harness-profiles',
  keys: slug,
  drafts: (key) => profile.map((model) => profileDraft(key, model)),
  writable: (stored) => ({
    key: stored.key,
    permissions: stored.permissions,
    mcpServers: stored.mcpServers,
    native: stored.native,
  }),
  parts: async () => new Map(),
};

const same = (one: unknown, other: unknown): boolean =>
  isDeepStrictEqual(one, other);

const sameButVersion = (one: Stored, other: Stored): boolean =>
  same({ ...one, version: other.version }, other);

const keptAcross = (
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>,
): boolean =>
  [...before].every(([key, id]) => !after.has(key) || after.get(key) === id);

let app: INestApplication;
let db: DrizzleDatabase;

beforeAll(async () => {
  app = await openApp();
  db = app.get<DrizzleDatabase>(DRIZZLE);
}, 60_000);

afterAll(async () => {
  await app?.close();
});

const opened = async (resource: ResourceKind) => {
  const workspaceId = `round-trips-${randomUUID().slice(0, 8)}`;
  const { owner } = await seatTeam(db, workspaceId);
  const item = (id: string) => `/api/v1/resources/${resource.plural}/${id}`;
  const signed = <T extends Test>(test: T): T =>
    test.set(TEST_USER_HEADER, owner);

  return {
    create: async (body: Fields): Promise<Answer<Stored>> =>
      signed(
        served(app).post(
          `/api/v1/resources/teams/${workspaceId}/${resource.plural}`,
        ),
      )
        .set('Idempotency-Key', randomUUID())
        .send(body),
    read: async (id: string): Promise<Answer<Stored>> =>
      signed(served(app).get(item(id))),
    update: async (
      id: string,
      version: number,
      body: unknown,
    ): Promise<Answer<Stored>> =>
      signed(served(app).put(item(id)))
        .set('If-Match', `"${version}"`)
        .send(body as object),
    remove: async (id: string, version: number): Promise<Answer<Fields>> =>
      signed(served(app).delete(item(id))).set('If-Match', `"${version}"`),
    imported: async (address: string): Promise<Answer<Fields>> =>
      signed(
        served(app).get(
          `/api/v1/resources/workspaces/${workspaceId}/${resource.plural}/import?address=${encodeURIComponent(address)}`,
        ),
      ),
  };
};

const refusedAs = (answer: Answer<Fields>, status: number, type: string) =>
  answer.status === status && answer.body.type === type;

describe.each([LINES, PROFILES])(
  'a $kind written through the resource API as Terraform writes it (e2e)',
  (resource) => {
    const twoDrafts = resource.keys.chain((key) =>
      fc.tuple(resource.drafts(key), resource.drafts(key)),
    );

    it(
      'reads back each create and change as written, but for the normalisation the API documents',
      async () => {
        await fc.assert(
          fc.asyncProperty(twoDrafts, async ([first, second]) => {
            const api = await opened(resource);
            const created = await api.create(first.body);

            if (created.status !== 201) {
              return false;
            }

            const readAfterCreate = await api.read(created.body.id);
            const partsBefore = await resource.parts(db, created.body.id);
            const changed = await api.update(
              created.body.id,
              created.body.version,
              second.body,
            );
            const readAfterChange = await api.read(created.body.id);
            const partsAfter = await resource.parts(db, created.body.id);

            return (
              same(resource.writable(created.body), first.expected) &&
              same(readAfterCreate.body, created.body) &&
              changed.status === 200 &&
              same(resource.writable(changed.body), second.expected) &&
              same(readAfterChange.body, changed.body) &&
              changed.body.version > created.body.version &&
              keptAcross(partsBefore, partsAfter)
            );
          }),
          RUNS,
        );
      },
      TIMEOUT,
    );

    it(
      'changes nothing but its version when the same definition, or the one it read back, is applied again',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            resource.keys.chain((key) => resource.drafts(key)),
            fc.constantFrom('the same body', 'the read-back definition'),
            async (draft, again) => {
              const api = await opened(resource);
              const created = await api.create(draft.body);
              const partsBefore = await resource.parts(db, created.body.id);
              const reapplied = await api.update(
                created.body.id,
                created.body.version,
                again === 'the same body'
                  ? draft.body
                  : resource.writable(created.body),
              );
              const readBack = await api.read(created.body.id);
              const partsAfter = await resource.parts(db, created.body.id);

              return (
                created.status === 201 &&
                reapplied.status === 200 &&
                sameButVersion(reapplied.body, created.body) &&
                same(readBack.body, reapplied.body) &&
                reapplied.body.version > created.body.version &&
                same(partsAfter, partsBefore)
              );
            },
          ),
          RUNS,
        );
      },
      TIMEOUT,
    );

    it(
      'refuses a change or delete at a version that is not current, naming the current one, and keeps what it stored',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            twoDrafts,
            fc.constantFrom('change', 'delete'),
            fc.oneof(
              fc.constant('its first version'),
              fc.integer({ min: 1, max: 1_000 }),
            ),
            async ([first, second], refused, stale) => {
              const api = await opened(resource);
              const created = await api.create(first.body);
              const changed = await api.update(
                created.body.id,
                created.body.version,
                second.body,
              );
              const version =
                stale === 'its first version'
                  ? created.body.version
                  : changed.body.version + stale;
              const attempt =
                refused === 'change'
                  ? await api.update(created.body.id, version, first.body)
                  : await api.remove(created.body.id, version);
              const readBack = await api.read(created.body.id);

              return (
                changed.status === 200 &&
                refusedAs(attempt, 409, CONFLICT) &&
                attempt.body.currentVersion === changed.body.version &&
                same(readBack.body, changed.body)
              );
            },
          ),
          RUNS,
        );
      },
      TIMEOUT,
    );

    it(
      'lets exactly one of several changes at the same version through, and keeps that one',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            resource.keys.chain((key) =>
              fc.tuple(
                resource.drafts(key),
                fc.array(resource.drafts(key), { minLength: 2, maxLength: 4 }),
              ),
            ),
            async ([first, racing]) => {
              const api = await opened(resource);
              const created = await api.create(first.body);
              const answers = await Promise.all(
                racing.map((each) =>
                  api.update(created.body.id, created.body.version, each.body),
                ),
              );
              const won = answers.flatMap((answer, at) =>
                answer.status === 200 ? [{ answer, draft: racing[at] }] : [],
              );
              const [winner] = won;
              const readBack = await api.read(created.body.id);

              return (
                won.length === 1 &&
                winner !== undefined &&
                same(
                  resource.writable(winner.answer.body),
                  winner.draft?.expected,
                ) &&
                answers
                  .filter((answer) => answer !== winner.answer)
                  .every(
                    (answer) =>
                      refusedAs(answer, 409, CONFLICT) &&
                      answer.body.currentVersion === winner.answer.body.version,
                  ) &&
                same(readBack.body, winner.answer.body)
              );
            },
          ),
          RUNS,
        );
      },
      TIMEOUT,
    );

    it(
      'is gone after a delete, finds nothing for any other delete, and can be created again at its address',
      async () => {
        await fc.assert(
          fc.asyncProperty(
            twoDrafts,
            fc.integer({ min: 1, max: 3 }),
            async ([first, second], deletes) => {
              const api = await opened(resource);
              const created = await api.create(first.body);
              const removed = await Promise.all(
                Array.from({ length: deletes }, () =>
                  api.remove(created.body.id, created.body.version),
                ),
              );
              const read = await api.read(created.body.id);
              const imported = await api.imported(created.body.address);
              const again = await api.remove(
                created.body.id,
                created.body.version,
              );
              const recreated = await api.create(second.body);

              return (
                removed.filter((each) => each.status === 204).length === 1 &&
                removed
                  .filter((each) => each.status !== 204)
                  .every((each) => refusedAs(each, 404, NOT_FOUND)) &&
                refusedAs(read, 404, NOT_FOUND) &&
                refusedAs(imported, 404, NOT_FOUND) &&
                refusedAs(again, 404, NOT_FOUND) &&
                recreated.status === 201 &&
                recreated.body.id !== created.body.id &&
                recreated.body.address === created.body.address &&
                same(resource.writable(recreated.body), second.expected)
              );
            },
          ),
          RUNS,
        );
      },
      TIMEOUT,
    );
  },
);

describe('a line definition sent through the resource API (e2e)', () => {
  const repeatingARoute = slug.chain((key) =>
    fc
      .uniqueArray(fc.constantFrom(...WORK_KEYS), {
        minLength: 1,
        maxLength: 4,
      })
      .chain((keys) =>
        line(keys).map((model) => {
          const [twice = 'ship'] = keys;

          return lineDraft(key, keys, {
            ...model,
            backlogPassesTo: [
              twice,
              ...model.backlogPassesTo.filter((each) => each !== twice),
              twice,
            ],
          });
        }),
      ),
  );

  it(
    'refuses a line that writes a route twice',
    async () => {
      await fc.assert(
        fc.asyncProperty(repeatingARoute, async (draft) => {
          const api = await opened(LINES);
          const created = await api.create(draft.body);

          return created.status === 422;
        }),
        RUNS,
      );
    },
    TIMEOUT,
  );
});
