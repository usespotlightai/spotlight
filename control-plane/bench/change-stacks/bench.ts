// oxlint-disable no-console, node/no-process-env -- a command-line tool reports on the terminal and reads its model from the environment
/// <reference types="node" />
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import type { ChangeStackGeneratorPort } from '@change-review/application/ports/change-stack-generator.port';
import { exceedsOneCall } from '@change-review/application/services/cohort-layering';
import { GenerateChangeStack } from '@change-review/application/services/generate-change-stack.service';
import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import { placedHunks } from '@change-review/domain/services/diff-facts';
import { ChatCompletionsChangeStackGenerator } from '@change-review/infrastructure/change-stacks/chat-completions-change-stack.generator';
import { GitDiffReader } from '@change-review/infrastructure/change-stacks/git-diff.reader';
import { PatternCodeReading } from '@change-review/infrastructure/change-stacks/pattern-code.reading';
import { TreeSitterSymbolIndexer } from '@change-review/infrastructure/change-stacks/tree-sitter/tree-sitter-symbol.indexer';
import type { ModelEndpoint } from '@platform/llm/chat-completions';
import { ModelsDevPrices } from '@platform/llm/models-dev.prices';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

import { type CheckedDraft, problemsOf, RecordingGenerator } from './drafts';
import {
  type DiffShape,
  diffShape,
  mean,
  type MeasuredHunk,
  median,
  type SizeBucket,
  type StackShape,
  stackShape,
} from './stack-metrics';

const HERE = __dirname;
const CORPUS = join(HERE, 'corpus.json');
const RESULTS = join(HERE, 'results');
const REPOSITORY_ROOT = resolve(HERE, '../../..');
const DEFAULT_MODEL = 'google/gemini-3.8-flash';
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_PRICES_URL = 'https://models.dev/api.json';
const JOB_ATTEMPTS = 4;
const MAX_WHOLE_CONTEXT_DIFF = 5 * 1024 * 1024;
const BUCKETS: readonly SizeBucket[] = ['small', 'medium', 'large'];

const USAGE = `Usage:
  npm run bench:change-stacks -- run [--label <name>] [--cases <a,b>] [--repeats <n>] [--concurrency <n>] [--model <id>] [--env <file>]
  npm run bench:change-stacks -- compare <before.json> <after.json>
  npm run bench:change-stacks -- show <result.json> <case>
  npm run bench:change-stacks -- recheck <result.json> [--verbose]`;

interface CorpusCase {
  readonly name: string;
  readonly commit?: string;
  readonly patch?: string;
  readonly repository?: string;
  readonly title?: string;
}

interface Sample {
  readonly case: string;
  readonly repeat: number;
  readonly state: string;
  readonly failure: string | null;
  readonly error: string | null;
  readonly problems: readonly string[];
  readonly split: boolean;
  readonly seconds: number;
  readonly calls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
  readonly unpriced: number;
  readonly stack: StackShape | null;
}

interface SampleDrafts {
  readonly case: string;
  readonly repeat: number;
  readonly drafts: readonly CheckedDraft[];
}

interface CaseSummary {
  readonly case: string;
  readonly diff: DiffShape;
  readonly samples: number;
  readonly ready: number;
  readonly largestLayerShare: number | null;
  readonly effectiveLayers: number | null;
  readonly oversizedLayers: number | null;
  readonly layers: number | null;
  readonly cohorts: number | null;
  readonly tokens: number;
  readonly costUsd: number;
  readonly costPerReady: number | null;
  readonly seconds: number | null;
}

interface BucketSummary {
  readonly bucket: SizeBucket;
  readonly cases: number;
  readonly readyRate: number | null;
  readonly largestLayerShare: number | null;
  readonly effectiveLayers: number | null;
  readonly oversizedLayers: number | null;
  readonly floor: number | null;
  readonly costPerReady: number | null;
}

interface BenchResult {
  readonly label: string;
  readonly model: string;
  readonly code: string;
  readonly startedAt: string;
  readonly repeats: number;
  readonly cases: readonly CaseSummary[];
  readonly buckets: readonly BucketSummary[];
  readonly samples: readonly Sample[];
}

const PROBLEM_KINDS: readonly [string, RegExp][] = [
  ['leaves a hunk out', /^leaves /],
  ['places a hunk twice', /^assigns /],
  ['invents a hunk', /which is not in the diff/],
  ['gets file notes wrong', / notes |has no note on|needs a note on/],
  ['writes too long a title or summary', /needs an? (title|intent|summary)/],
  ['names a wrong dependency', / depends on layer /],
  ['leaves a layer empty', /has no (hunks|layers)/],
  ['splits linked hunks across cohorts', /belong in the same cohort/],
  ['orders a user before its definition', /cannot come in an earlier layer/],
  ['moves a test away from its code', /with the code it covers/],
  ['splits moved code', /code moved from/],
  ['puts a migration after layer 1', /is a migration/],
  ['joins unconnected hunks', /joins hunks the code does not connect/],
  ['joins layers in a redraft', /joins layers/],
];

const kindOf = (problem: string): string =>
  PROBLEM_KINDS.find(([, pattern]) => pattern.test(problem))?.[0] ?? 'other';

const recording = () => {
  const problems: string[] = [];
  const failures: string[] = [];
  const kept = (fields: Record<string, unknown>) => {
    if (Array.isArray(fields.problems)) {
      problems.push(...fields.problems.map(String));
    }
    for (const error of [fields.err, fields.error]) {
      if (error !== undefined) {
        failures.push(
          error instanceof Error ? error.message : JSON.stringify(error),
        );
      }
    }
  };

  return {
    problems,
    failures,
    logger: {
      debug: () => undefined,
      info: () => undefined,
      warn: kept,
      error: kept,
    },
  };
};

const CLOCK = {
  now: () => new Date(),
  sleep: (ms: number) =>
    new Promise<void>((done) => setTimeout(done, Math.min(ms, 5_000))),
};

const git = (...args: string[]): string =>
  execFileSync('git', ['-C', REPOSITORY_ROOT, ...args], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
  });

const diffOf = (each: CorpusCase): string => {
  if (each.patch) {
    return readFileSync(resolve(HERE, each.patch), 'utf8');
  }
  if (!each.commit) {
    throw new Error(`Case ${each.name} names neither a commit nor a patch`);
  }

  const whole = git(
    'diff',
    '-M',
    '--unified=100000',
    `${each.commit}^`,
    each.commit,
  );

  return whole.length > MAX_WHOLE_CONTEXT_DIFF
    ? git('diff', '-M', `${each.commit}^`, each.commit)
    : whole;
};

const memoryStacks = (): ChangeStackRepository => {
  const stacks = new Map<string, ChangeStack>();

  return {
    add: async (stack) => {
      stacks.set(stack.id.value, stack);
    },
    save: async (stack) => {
      stacks.set(stack.id.value, stack);
    },
    find: async (id) => stacks.get(id.value) ?? null,
    nextDueJob: async () => null,
    ofRun: async () => [],
    ofTask: async () => [],
    ofTeam: async () => [],
    remove: async (stack) => {
      stacks.delete(stack.id.value);
    },
  };
};

const hunksOf = (stack: ChangeStack): MeasuredHunk[] =>
  stack.diff.files.flatMap((file) =>
    file.hunks.map((hunk) => ({
      id: String(hunk.id),
      path: file.path,
      patch: hunk.patch,
    })),
  );

const placedOf = (stack: ChangeStack): Set<string> =>
  new Set(placedHunks(stack.facts).map(String));

const usdOf = (stack: ChangeStack): number =>
  stack.usage.costs
    .filter((cost) => cost.currency === 'USD')
    .reduce((total, cost) => total + cost.amount, 0);

const endpointOf = (
  model: string | undefined,
  prices: ModelsDevPrices,
): ModelEndpoint => {
  const apiKey = process.env.LLM_API_KEY ?? process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Set LLM_API_KEY or OPENROUTER_API_KEY, or pass --env <file> that sets one',
    );
  }

  return {
    baseUrl: process.env.LLM_BASE_URL ?? DEFAULT_BASE_URL,
    apiKey,
    model:
      model ??
      process.env.CHANGE_STACK_MODEL ??
      process.env.LLM_MODEL ??
      DEFAULT_MODEL,
    supportsReasoningEffort:
      process.env.LLM_SUPPORTS_REASONING_EFFORT === 'true',
    prices,
  };
};

const serviceOf = (
  stacks: ChangeStackRepository,
  generator: ChangeStackGeneratorPort,
  logger: ReturnType<typeof recording>['logger'],
) =>
  new GenerateChangeStack(
    stacks,
    generator,
    new GitDiffReader(),
    new PatternCodeReading(),
    new TreeSitterSymbolIndexer(),
    { generate: () => randomUUID() },
    CLOCK,
    logger,
  );

const begun = (
  service: GenerateChangeStack,
  each: CorpusCase,
  diff: string,
): Promise<ChangeStack> =>
  service.begin(
    {
      id: RunId.of(`bench-${randomUUID()}`),
      taskId: null,
      teamOfRun: TeamId.of('bench'),
      trial: false,
      checkouts: 1,
      workspaceId: WorkspaceId.of('bench'),
    },
    {
      diff,
      repository: each.repository ?? null,
      base: null,
      request: null,
    },
  );

const sampled = async (
  endpoint: ModelEndpoint,
  each: CorpusCase,
  diff: string,
  repeat: number,
): Promise<{ sample: Sample; diff: DiffShape; drafts: SampleDrafts }> => {
  const stacks = memoryStacks();
  const log = recording();
  const generator = new RecordingGenerator(
    new ChatCompletionsChangeStackGenerator(endpoint),
  );
  const service = serviceOf(stacks, generator, log.logger);
  const started = Date.now();

  let stack = await begun(service, each, diff);
  const hunks = hunksOf(stack);
  const placed = placedOf(stack);
  const split = exceedsOneCall(stack.diff, stack.facts);
  let error: string | null = null;

  for (
    let attempt = 1;
    attempt <= JOB_ATTEMPTS && stack.state === 'generating';
    attempt += 1
  ) {
    try {
      stack = await service.generated(stack);
      await stacks.save(stack);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
      break;
    }
  }

  return {
    diff: diffShape(hunks, placed),
    drafts: { case: each.name, repeat, drafts: generator.drafts },
    sample: {
      case: each.name,
      repeat,
      state: stack.state,
      failure: stack.failure,
      error: error ?? log.failures[log.failures.length - 1] ?? null,
      problems: log.problems,
      split,
      seconds: (Date.now() - started) / 1000,
      calls: stack.usage.calls,
      inputTokens: stack.usage.inputTokens,
      outputTokens: stack.usage.outputTokens,
      costUsd: usdOf(stack),
      unpriced: stack.usage.unpriced,
      stack:
        stack.state === 'ready'
          ? stackShape(hunks, placed, stack.cohorts)
          : null,
    },
  };
};

const pooled = async <T>(
  jobs: readonly (() => Promise<T>)[],
  size: number,
): Promise<T[]> => {
  const done = new Map<number, T>();
  let next = 0;

  await Promise.all(
    Array.from({ length: Math.min(size, jobs.length) }, async () => {
      for (let job = jobs[next]; job; job = jobs[next]) {
        const at = next;
        next += 1;
        done.set(at, await job());
      }
    }),
  );

  return [...done.entries()].sort(([x], [y]) => x - y).map(([, each]) => each);
};

const ofReady = (
  samples: readonly Sample[],
  pick: (stack: StackShape) => number,
): number[] =>
  samples.flatMap((each) => (each.stack ? [pick(each.stack)] : []));

const costsOf = (samples: readonly Sample[]) => {
  const costUsd = samples.reduce((total, each) => total + each.costUsd, 0);
  const ready = samples.filter((each) => each.state === 'ready').length;

  return { costUsd, costPerReady: ready > 0 ? costUsd / ready : null };
};

const summarised = (
  name: string,
  diff: DiffShape,
  samples: readonly Sample[],
): CaseSummary => ({
  case: name,
  diff,
  samples: samples.length,
  ready: samples.filter((each) => each.state === 'ready').length,
  largestLayerShare: median(ofReady(samples, (s) => s.largestLayerShare)),
  effectiveLayers: median(ofReady(samples, (s) => s.effectiveLayers)),
  oversizedLayers: median(ofReady(samples, (s) => s.oversizedLayers)),
  layers: median(ofReady(samples, (s) => s.layers)),
  cohorts: median(ofReady(samples, (s) => s.cohorts)),
  tokens:
    median(samples.map((each) => each.inputTokens + each.outputTokens)) ?? 0,
  ...costsOf(samples),
  seconds: median(samples.map((each) => each.seconds)),
});

const present = (values: readonly (number | null)[]): number[] =>
  values.filter((each): each is number => each !== null);

const bucketed = (cases: readonly CaseSummary[]): BucketSummary[] =>
  BUCKETS.map((bucket) => {
    const inBucket = cases.filter((each) => each.diff.bucket === bucket);
    const samples = inBucket.reduce((total, each) => total + each.samples, 0);
    const ready = inBucket.reduce((total, each) => total + each.ready, 0);
    const cost = inBucket.reduce((total, each) => total + each.costUsd, 0);

    return {
      bucket,
      cases: inBucket.length,
      readyRate: samples > 0 ? ready / samples : null,
      largestLayerShare: mean(
        present(inBucket.map((e) => e.largestLayerShare)),
      ),
      effectiveLayers: mean(present(inBucket.map((e) => e.effectiveLayers))),
      oversizedLayers: mean(present(inBucket.map((e) => e.oversizedLayers))),
      floor: mean(inBucket.map((e) => e.diff.largestHunkShare)),
      costPerReady: ready > 0 ? cost / ready : null,
    };
  });

const fixed = (value: number | null, digits = 2): string =>
  value === null ? '–' : value.toFixed(digits);

const dollars = (value: number | null): string =>
  value === null ? '–' : '$' + value.toFixed(3);

const percent = (value: number | null): string =>
  value === null ? '–' : `${Math.round(value * 100)}%`;

const printed = (result: BenchResult): void => {
  console.log(
    `\n${result.label} · ${result.model} · code ${result.code} · ${result.repeats} repeats\n`,
  );
  console.table(
    result.cases.map((each) => ({
      case: each.case,
      bucket: each.diff.bucket,
      lines: each.diff.lines,
      hunks: each.diff.hunks,
      'biggest hunk': percent(each.diff.largestHunkShare),
      ready: `${each.ready}/${each.samples}`,
      layers: fixed(each.layers, 1),
      'biggest layer': percent(each.largestLayerShare),
      'effective layers': fixed(each.effectiveLayers, 1),
      'over 400 lines': fixed(each.oversizedLayers, 1),
      'k tokens': fixed(each.tokens / 1000, 0),
      'cost / ready': dollars(each.costPerReady),
      seconds: fixed(each.seconds, 0),
    })),
  );
  console.table(
    result.buckets.map((each) => ({
      bucket: each.bucket,
      cases: each.cases,
      ready: percent(each.readyRate),
      'biggest layer': percent(each.largestLayerShare),
      'floor (biggest hunk)': percent(each.floor),
      'effective layers': fixed(each.effectiveLayers, 1),
      'over 400 lines': fixed(each.oversizedLayers, 1),
      'cost / ready': dollars(each.costPerReady),
    })),
  );

  const spent = result.samples.reduce((total, each) => total + each.costUsd, 0);
  const unpriced = result.samples.reduce(
    (total, each) => total + (each.unpriced ?? 0),
    0,
  );
  console.log(
    '\nSpent ' +
      dollars(spent) +
      (unpriced > 0 ? ', and ' + unpriced + ' model calls have no price' : '') +
      '.',
  );

  const broken = result.samples.filter((each) => each.problems.length > 0);
  const kinds = new Map<string, { problems: number; drafts: number }>();

  for (const sample of broken) {
    const mine = sample.problems.map(kindOf);

    for (const kind of new Set(mine)) {
      const seen = kinds.get(kind) ?? { problems: 0, drafts: 0 };
      kinds.set(kind, {
        problems: seen.problems + mine.filter((each) => each === kind).length,
        drafts: seen.drafts + 1,
      });
    }
  }

  if (kinds.size > 0) {
    console.log(`\nWhy ${broken.length} drafts broke the rules:`);
    console.table(
      [...kinds.entries()]
        .sort(([, a], [, b]) => b.drafts - a.drafts)
        .map(([kind, seen]) => ({ problem: kind, ...seen })),
    );
  }
};

const run = async (values: Record<string, string | undefined>) => {
  if (values.env) {
    process.loadEnvFile(resolve(values.env));
  }

  const corpus = JSON.parse(readFileSync(CORPUS, 'utf8')) as {
    cases: CorpusCase[];
  };
  const wanted = values.cases?.split(',').map((each) => each.trim());
  const cases = wanted
    ? corpus.cases.filter((each) => wanted.includes(each.name))
    : corpus.cases;
  const repeats = Number(values.repeats ?? 3);
  const prices = new ModelsDevPrices(
    process.env.LLM_PRICES_URL ?? DEFAULT_PRICES_URL,
  );
  await prices.refresh();
  const endpoint = endpointOf(values.model, prices);
  const diffs = new Map(cases.map((each) => [each.name, diffOf(each)]));

  console.log(
    `Drafting ${cases.length} cases × ${repeats} with ${endpoint.model}…`,
  );

  const outcomes = await pooled(
    cases.flatMap((each) =>
      Array.from({ length: repeats }, (_, repeat) => async () => {
        const outcome = await sampled(
          endpoint,
          each,
          diffs.get(each.name) ?? '',
          repeat + 1,
        );
        const { sample } = outcome;
        console.log(
          `  ${sample.case} #${sample.repeat}: ${sample.state}${sample.failure ? ` (${sample.failure})` : ''}${sample.error ? ` (${sample.error})` : ''} in ${sample.seconds.toFixed(0)}s`,
        );
        return outcome;
      }),
    ),
    Number(values.concurrency ?? 4),
  );

  const caseSummaries = cases.map((each) => {
    const mine = outcomes.filter((o) => o.sample.case === each.name);
    const shape = mine[0]?.diff;

    if (!shape) {
      throw new Error(`No samples for ${each.name}`);
    }
    return summarised(
      each.name,
      shape,
      mine.map((o) => o.sample),
    );
  });

  const startedAt = new Date().toISOString();
  const label = values.label ?? 'run';
  const result: BenchResult = {
    label,
    model: endpoint.model,
    code: git('rev-parse', '--short', 'HEAD').trim(),
    startedAt,
    repeats,
    cases: caseSummaries,
    buckets: bucketed(caseSummaries),
    samples: outcomes.map((o) => o.sample),
  };

  mkdirSync(RESULTS, { recursive: true });
  const file = join(
    RESULTS,
    `${label}-${startedAt.replace(/[:.]/g, '-')}.json`,
  );
  writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);
  writeFileSync(
    draftsFileOf(file),
    JSON.stringify(outcomes.map((o) => o.drafts)),
  );

  printed(result);
  console.log(`\nWrote ${file}`);
};

const draftsFileOf = (file: string): string =>
  file.replace(/\.json$/, '.drafts.json');

const loaded = (file: string): BenchResult =>
  JSON.parse(readFileSync(resolve(file), 'utf8')) as BenchResult;

const delta = (
  before: number | null,
  after: number | null,
  format: (value: number | null) => string,
): string => `${format(before)} → ${format(after)}`;

const compare = (beforeFile: string, afterFile: string): void => {
  const before = loaded(beforeFile);
  const after = loaded(afterFile);

  console.log(
    `\n${before.label} (${before.code}) → ${after.label} (${after.code})\n`,
  );
  console.table(
    BUCKETS.map((bucket) => {
      const a = before.buckets.find((each) => each.bucket === bucket);
      const b = after.buckets.find((each) => each.bucket === bucket);

      return {
        bucket,
        ready: delta(a?.readyRate ?? null, b?.readyRate ?? null, percent),
        'biggest layer': delta(
          a?.largestLayerShare ?? null,
          b?.largestLayerShare ?? null,
          percent,
        ),
        'effective layers': delta(
          a?.effectiveLayers ?? null,
          b?.effectiveLayers ?? null,
          (v) => fixed(v, 1),
        ),
        'over 400 lines': delta(
          a?.oversizedLayers ?? null,
          b?.oversizedLayers ?? null,
          (v) => fixed(v, 1),
        ),
        floor: delta(a?.floor ?? null, b?.floor ?? null, percent),
        'cost / ready': delta(
          a?.costPerReady ?? null,
          b?.costPerReady ?? null,
          dollars,
        ),
      };
    }),
  );
  console.table(
    after.cases.map((b) => {
      const a = before.cases.find((each) => each.case === b.case);

      return {
        case: b.case,
        bucket: b.diff.bucket,
        ready: `${a ? `${a.ready}/${a.samples}` : '–'} → ${b.ready}/${b.samples}`,
        'biggest layer': delta(
          a?.largestLayerShare ?? null,
          b.largestLayerShare,
          percent,
        ),
        'effective layers': delta(
          a?.effectiveLayers ?? null,
          b.effectiveLayers,
          (v) => fixed(v, 1),
        ),
        'cost / ready': delta(a?.costPerReady ?? null, b.costPerReady, dollars),
        'k tokens': delta(a ? a.tokens / 1000 : null, b.tokens / 1000, (v) =>
          fixed(v, 0),
        ),
      };
    }),
  );
};

const show = (file: string, name: string): void => {
  const result = loaded(file);

  for (const sample of result.samples.filter((each) => each.case === name)) {
    console.log(
      `\n${sample.case} #${sample.repeat}: ${sample.state}${sample.failure ? ` (${sample.failure})` : ''}`,
    );
    for (const layer of sample.stack?.layout ?? []) {
      console.log(
        `  cohort ${layer.cohort} · ${String(layer.lines).padStart(5)} lines · ${String(layer.hunks).padStart(3)} hunks · ${String(layer.files).padStart(2)} files · ${layer.title}`,
      );
    }
  }
};

const NO_MODEL: ChangeStackGeneratorPort = {
  available: true,
  generate: () => Promise.reject(new Error('A recheck calls no model')),
  outline: () => Promise.reject(new Error('A recheck calls no model')),
  layers: () => Promise.reject(new Error('A recheck calls no model')),
  layerPlan: () => Promise.reject(new Error('A recheck calls no model')),
  layerDetails: () => Promise.reject(new Error('A recheck calls no model')),
};

const recheck = async (file: string, verbose: boolean): Promise<void> => {
  const recorded = JSON.parse(
    readFileSync(draftsFileOf(resolve(file)), 'utf8'),
  ) as SampleDrafts[];
  const corpus = JSON.parse(readFileSync(CORPUS, 'utf8')) as {
    cases: CorpusCase[];
  };
  const service = serviceOf(memoryStacks(), NO_MODEL, recording().logger);
  const tally = new Map<
    string,
    {
      drafts: number;
      refusedThen: number;
      refusedNow: number;
      fixed: number;
      broken: number;
    }
  >();
  const kinds = new Map<string, { problems: number; drafts: number }>();

  for (const each of corpus.cases) {
    const mine = recorded.filter((sample) => sample.case === each.name);

    if (mine.length === 0) {
      continue;
    }

    const stack = await begun(service, each, diffOf(each));

    for (const sample of mine) {
      for (const [at, draft] of sample.drafts.entries()) {
        const now = problemsOf(stack.diff, stack.facts, draft);
        const seen = tally.get(draft.kind) ?? {
          drafts: 0,
          refusedThen: 0,
          refusedNow: 0,
          fixed: 0,
          broken: 0,
        };
        const then = draft.problems.length > 0;

        tally.set(draft.kind, {
          drafts: seen.drafts + 1,
          refusedThen: seen.refusedThen + (then ? 1 : 0),
          refusedNow: seen.refusedNow + (now.length > 0 ? 1 : 0),
          fixed: seen.fixed + (then && now.length === 0 ? 1 : 0),
          broken: seen.broken + (!then && now.length > 0 ? 1 : 0),
        });

        const named = now.map(kindOf);
        for (const kind of new Set(named)) {
          const counted = kinds.get(kind) ?? { problems: 0, drafts: 0 };
          kinds.set(kind, {
            problems: counted.problems + named.filter((k) => k === kind).length,
            drafts: counted.drafts + 1,
          });
        }

        if (verbose && now.length > 0) {
          console.log(
            `\n${sample.case} #${sample.repeat} draft ${at + 1} (${draft.kind}):`,
          );
          for (const problem of now.slice(0, 8)) {
            console.log(`  ${problem}`);
          }
          if (now.length > 8) {
            console.log(`  … and ${now.length - 8} more`);
          }
        }
      }
    }
  }

  console.log('\nDrafts the current code refuses:');
  console.table(
    [...tally.entries()].map(([kind, seen]) => ({ draft: kind, ...seen })),
  );
  if (kinds.size > 0) {
    console.table(
      [...kinds.entries()]
        .sort(([, a], [, b]) => b.drafts - a.drafts)
        .map(([kind, seen]) => ({ problem: kind, ...seen })),
    );
  }
};

const main = async (): Promise<void> => {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      label: { type: 'string' },
      cases: { type: 'string' },
      repeats: { type: 'string' },
      concurrency: { type: 'string' },
      model: { type: 'string' },
      env: { type: 'string' },
      verbose: { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });
  const [command, ...rest] = positionals;

  if (values.help || !command) {
    console.log(USAGE);
    return;
  }

  if (command === 'run') {
    await run(values as Record<string, string | undefined>);
  } else if (command === 'compare' && rest[0] && rest[1]) {
    compare(rest[0], rest[1]);
  } else if (command === 'recheck' && rest[0]) {
    await recheck(rest[0], values.verbose === true);
  } else if (command === 'show' && rest[0] && rest[1]) {
    show(rest[0], rest[1]);
  } else {
    console.log(USAGE);
    process.exitCode = 1;
  }
};

if (!existsSync(CORPUS)) {
  throw new Error(`No corpus at ${CORPUS}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
