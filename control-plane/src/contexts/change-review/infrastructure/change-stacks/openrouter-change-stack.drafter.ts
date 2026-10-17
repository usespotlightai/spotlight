import { DraftingError } from '@change-review/application/errors/drafting.error';
import type {
  ChangeStackDraft,
  ChangeStackDrafted,
  ChangeStackDrafterPort,
} from '@change-review/application/ports/change-stack-drafter.port';
import type {
  StackProblem,
  StackProblemCode,
} from '@change-review/domain/exceptions/invalid-change-stack.error';
import type { DiffFacts } from '@change-review/domain/services/diff-facts';
import type { StackRevision } from '@change-review/domain/services/stack-revision';
import type { Diff } from '@change-review/domain/value-objects/diff.vo';
import { COHORT_KINDS } from '@change-review/domain/value-objects/stack-cohort.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import {
  type Fetch,
  JsonShape,
  OpenRouterUnansweredError,
  requestJson,
} from '@platform/openrouter/openrouter-json';
import { z } from 'zod';

export const DEFAULT_MODEL = 'google/gemini-3.8-flash';

const MAX_OUTPUT = 32_000;

const STACK = new JsonShape(
  'change_stack',
  z.object({
    cohorts: z.array(
      z.object({
        kind: z.enum(COHORT_KINDS),
        title: z.string(),
        intent: z.string(),
        joinedBecause: z.string().nullable(),
        layers: z.array(
          z.object({
            title: z.string(),
            summary: z.string(),
            dependsOn: z.array(
              z.object({
                layer: z.number().int(),
                because: z.array(z.string()),
              }),
            ),
            ranges: z.array(z.object({ hunk: z.string() })),
            files: z.array(z.object({ path: z.string(), note: z.string() })),
          }),
        ),
      }),
    ),
  }),
);

const SYSTEM = `You organise a code change into a change stack, so a reviewer can understand a large diff in minutes instead of reading files in alphabetical order.

A change stack has two levels:

- Cohorts are independent pieces of work. Two changes belong to the same cohort when one exists to serve the other or both serve one purpose. Changes that merely look alike, sit in the same file, or follow the same pattern are not reasons to group them. When in doubt, split: a cohort that wrongly joins unrelated work misleads the reviewer, while two cohorts that could have been one cost little.
- Layers are the ordered steps within one cohort, in the order a thoughtful senior engineer would walk someone through it: foundations first (schema, types, domain), then what builds on them (services, APIs), then what uses those (UI, wiring). A contract, the code implementing it and its tests belong in one layer, not three.

Lockfiles, generated files, snapshots, whole-file renames and formatting-only changes have already been set aside, and Spotlight places them itself. Other changes that need no review of their own go in a cohort of kind "incidental". Everything else is kind "change".

Spotlight has read the code and adds facts to each file and hunk. Treat them as fixed:

- "uses": the hunk uses something another hunk defines, so it belongs in the same cohort, in the same layer or a later one.
- "tests": the hunk tests the code in another hunk, so it belongs in the same cohort and the same layer as that code, in the latest layer where it tests several.
- "moves code from": the hunk is code moved from another hunk, so the two belong in the same layer. Say in the layer's summary that it moves code.
- A file marked "migration" belongs in layer 1 of its cohort.
- "uses, unchanged": code the hunk uses that this diff leaves as it was. It links the hunk to nothing, but says which part of the codebase the hunk works with.
- Hunks nothing connects are separate pieces of work. Join them in one cohort only when they plainly serve one purpose the code does not show, and then say why in the cohort's joinedBecause; otherwise leave joinedBecause null.

The diff is split into hunks, each with an id such as h7. Rules the stack must follow:

1. Place every hunk exactly once, as a range of one layer. Never invent a hunk id.
2. A layer depends only on earlier layers of its own cohort, named by their 1-based position within that cohort. Cohorts never depend on each other.
3. Every dependency names in "because" the symbols (types, functions, tables, routes, components) the later layer uses from the earlier one.
4. Titles are short imperative phrases ("Add the invitation data model"). A cohort's intent and a layer's summary say what changed and why in one to three plain sentences.
5. Give a layer exactly one entry in "files" for every file its ranges touch, and none for any other file. Its path is the file's path exactly as its ## heading shows it, and its note says in one or two plain sentences what changed in that file for this layer and why. A note never restates the path or the layer's summary.

Order cohorts by how much a reviewer needs to see them, most significant first, with incidental cohorts last.`;

const described = (diff: Diff, facts: DiffFacts): string => {
  const known = new Map(facts.hunks.map((each) => [each.hunk, each]));
  const uses = (hunk: string) =>
    facts.links
      .filter((link) => link.from === hunk)
      .map((link) =>
        link.kind === 'moves'
          ? `moves code from ${link.to}`
          : `${link.kind} ${link.because.join(', ')} (in ${link.to})`,
      );

  return diff.files
    .filter((file) =>
      file.hunks.some((hunk) => !known.get(hunk.id)?.incidental),
    )
    .map((file) => {
      const heading = [
        `## ${file.path}`,
        file.previousPath ? `(renamed from ${file.previousPath})` : null,
        `[${[file.status, known.get(file.hunks[0]?.id ?? '')?.fileClass, file.binary ? 'binary' : null].filter(Boolean).join(', ')}]`,
      ]
        .filter(Boolean)
        .join(' ');

      const hunks = file.hunks
        .filter((hunk) => !known.get(hunk.id)?.incidental)
        .map((hunk) => {
          const defines = known.get(hunk.id)?.defines ?? [];
          const outside = known.get(hunk.id)?.outside ?? [];
          const used = uses(hunk.id);

          return [
            `### ${hunk.id}`,
            defines.length > 0 ? `defines: ${defines.join(', ')}` : null,
            ...used,
            outside.length > 0
              ? `uses, unchanged: ${outside.join(', ')}`
              : null,
            hunk.patch || '(no lines to show)',
          ]
            .filter(Boolean)
            .join('\n');
        });

      return [heading, ...hunks].join('\n');
    })
    .join('\n\n');
};

const MAX_OUTPUT_LINES = 25;

const MAX_OUTPUT_LENGTH = 2_000;

const tail = (output: string): string =>
  output
    .trim()
    .split('\n')
    .slice(-MAX_OUTPUT_LINES)
    .join('\n')
    .slice(-MAX_OUTPUT_LENGTH);

export const revised = (revision: StackRevision): string =>
  [
    `Spotlight checked every layer on its own, with the layers before it, by running \`${revision.command}\`. The whole change passes, but some layers do not. Fix each failing layer by moving the few changes it needs, most often a test, fixture or type its errors name, into it or an earlier layer. Keep every layer as small as it was and keep the same number of layers; join layers only where moving changes cannot make one build. Give every layer a note on each file its ranges touch once the changes have moved. Keep everything else as it was:`,
    revision.stack
      .map(
        (cohort, c) =>
          `cohort ${c + 1} "${cohort.title}": ${cohort.layers
            .map(
              (layer, l) =>
                `layer ${l + 1} "${layer.title}" (${layer.hunks.join(', ')})`,
            )
            .join('; ')}`,
      )
      .join('\n'),
    ...revision.failed.map((failure) =>
      [
        `cohort ${failure.cohort + 1}, layer ${failure.layer + 1} "${failure.title}" does not build with only the layers up to it. The check printed:`,
        tail(failure.output),
        failure.named.length > 0
          ? `The changed files its errors name:\n${failure.named
              .map(
                (file) =>
                  `${file.path}: ${file.hunks
                    .map((hunk) =>
                      hunk.layer === null
                        ? `${hunk.hunk} outside this cohort`
                        : `${hunk.hunk} in layer ${hunk.layer + 1}`,
                    )
                    .join(', ')}`,
              )
              .join('\n')}`
          : null,
      ]
        .filter(Boolean)
        .join('\n'),
    ),
  ].join('\n\n');

const REMEDIES: Partial<Record<StackProblemCode, string>> = {
  unconnected: 'split it, or set joinedBecause',
  'joined-layers':
    'move the few changes a failing layer needs instead, and join layers only where that cannot work',
};

export const describeProblem = (problem: StackProblem): string => {
  const remedy = REMEDIES[problem.code];

  return remedy ? `${problem.message}; ${remedy}` : problem.message;
};

export class OpenRouterChangeStackDrafter implements ChangeStackDrafterPort {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly model: string = DEFAULT_MODEL,
    private readonly fetch: Fetch = globalThis.fetch,
  ) {}

  get available(): boolean {
    return Boolean(this.apiKey);
  }

  async draft({
    diff,
    repository,
    facts,
    problems,
    reordering,
  }: ChangeStackDraft): Promise<ChangeStackDrafted> {
    if (!this.apiKey) {
      throw new Error('No OpenRouter API key is set for change stacks');
    }

    const revision = reordering ? reordering : null;
    const prompt = [
      repository ? `Repository: ${repository.value}` : null,
      `The diff, as ${facts.hunks.filter((each) => !each.incidental).length} hunks to place:`,
      described(diff, facts),
      revision ? revised(revision) : null,
      problems.length > 0
        ? `A previous stack for this diff had these problems, so fix them:\n${problems.map((each) => `- ${describeProblem(each)}`).join('\n')}`
        : null,
    ]
      .filter(Boolean)
      .join('\n\n');

    const { answer, usage } = await requestJson({
      apiKey: this.apiKey,
      model: this.model,
      fetch: this.fetch,
      shape: STACK,
      system: SYSTEM,
      prompt,
      max: MAX_OUTPUT,
    }).catch((error: unknown) => {
      throw error instanceof OpenRouterUnansweredError
        ? new DraftingError(error.message, error.usage)
        : error;
    });

    return {
      cohorts: answer.cohorts.map((cohort) => ({
        ...cohort,
        layers: cohort.layers.map(({ files, ranges, ...layer }) => ({
          ...layer,
          ranges: ranges.map((range) => ({ hunk: HunkId.of(range.hunk) })),
          notes: files,
        })),
      })),
      usage,
    };
  }
}
