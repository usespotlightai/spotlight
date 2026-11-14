import { GenerationError } from '@change-review/application/errors/generation.error';
import type {
  ChangeStackGenerationRequest,
  ChangeStackGeneratorPort,
  CohortLayersRequest,
  GeneratedChangeStack,
  GeneratedLayerDetails,
  GeneratedLayerPlan,
  GeneratedLayers,
  GeneratedOutline,
  LayerDetailsRequest,
} from '@change-review/application/ports/change-stack-generator.port';
import type {
  StackProblem,
  StackProblemCode,
} from '@change-review/domain/exceptions/invalid-change-stack.error';
import {
  connectedGroups,
  type DiffFacts,
  linkFact,
  placedHunks,
} from '@change-review/domain/services/diff-facts';
import type { PreviousStack } from '@change-review/domain/services/previous-stack';
import type { RedraftRequest } from '@change-review/domain/services/redraft-request';
import { stackPartOf } from '@change-review/domain/services/stack-part';
import {
  changedLinesOf,
  type Diff,
  type DiffHunk,
} from '@change-review/domain/value-objects/diff.vo';
import {
  COHORT_KINDS,
  LAYER_LINES,
  type DraftedLayer,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import {
  JsonSchema,
  ModelEmptyCompletionError,
} from '@platform/llm/chat-completions';
import type { InferenceCallsPort } from '@shared-kernel/application/ports/inference-calls.port';
import { z } from 'zod';

const MAX_OUTPUT = 65_536;

const REASONING = 'medium';

const LAYER = z.object({
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
  questions: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
      hunks: z.array(z.string()),
    }),
  ),
});

const COHORT = {
  kind: z.enum(COHORT_KINDS),
  title: z.string(),
  intent: z.string(),
};

const JOINED_BECAUSE = { joinedBecause: z.string().nullable() };

const STACK = new JsonSchema(
  'change_stack',
  z.object({
    cohorts: z.array(
      z.object({ ...COHORT, layers: z.array(LAYER), ...JOINED_BECAUSE }),
    ),
  }),
);

const OUTLINE = new JsonSchema(
  'change_stack_outline',
  z.object({
    cohorts: z.array(
      z.object({ ...COHORT, hunks: z.array(z.string()), ...JOINED_BECAUSE }),
    ),
  }),
);

const LAYERS = new JsonSchema(
  'cohort_layers',
  z.object({ layers: z.array(LAYER) }),
);

const PLAN = new JsonSchema(
  'cohort_layer_plan',
  z.object({ layers: z.array(LAYER.omit({ files: true, questions: true })) }),
);

const DETAILS = new JsonSchema(
  'layer_details',
  LAYER.pick({ files: true, questions: true }),
);

const PURPOSE =
  'so a reviewer can understand a large diff in minutes instead of reading files in alphabetical order';

const COHORTS = `- Cohorts are independent pieces of work. Two changes belong to the same cohort when one exists to serve the other or both serve one purpose. Changes that merely look alike, sit in the same file, or follow the same pattern are not reasons to group them. When in doubt, split: a cohort that wrongly joins unrelated work misleads the reviewer, while two cohorts that could have been one cost little.`;

const LAYERS_ARE = `- Layers are the ordered steps within one cohort, in the order a thoughtful senior engineer would walk someone through it: foundations first (schema, types, domain), then what builds on them (services, APIs), then what uses those (UI, wiring). A test belongs in the layer of the code it tests.
- A reviewer reads one layer at a time, so keep each layer to about ${LAYER_LINES} changed lines or fewer. Each hunk's heading gives its changed lines. Split a larger step into several layers, such as one for each table, service, endpoint or screen. A layer that holds most of a large cohort is a failure, because the reviewer then has no order to follow. A layer may be larger only when its hunks cannot work apart.`;

const SET_ASIDE = `Lockfiles, generated files, snapshots, whole-file renames and formatting-only changes have already been set aside, and Spotlight places them itself. Other changes that need no review of their own go in a cohort of kind "incidental". Everything else is kind "change".`;

const FACTS = `Spotlight has read the code and adds facts to each file and hunk. Treat them as fixed:`;

const COHORT_FACTS = `- "uses": the hunk uses something another hunk defines, so it belongs in the same cohort, in the same layer or a later one.
- "removes": the hunk removes something that another hunk stops using, so it belongs in the same cohort, in the same layer or a later one.
- "tests": the hunk tests the code in another hunk, so it belongs in the same cohort and the same layer as that code, in the latest layer where it tests several.
- "moves code from": the hunk is code moved from another hunk, so the two belong in the same layer. Say in the layer's summary that it moves code.
- A file marked "migration" belongs in layer 1 of its cohort.
- "uses, unchanged": code the hunk uses that this diff leaves as it was. It links the hunk to nothing, but says which part of the codebase the hunk works with.`;

const JOINED = `- Hunks nothing connects are separate pieces of work. Join them in one cohort only when they plainly serve one purpose the code does not show, and then say why in the cohort's joinedBecause; otherwise leave joinedBecause null. After the diff, Spotlight lists the groups of hunks the code connects. A cohort of kind "change" that holds hunks of more than one group is refused unless its joinedBecause says which one purpose they serve. Do not split one plain purpose into many small cohorts only because the code does not connect its hunks: keep them together and give the reason.`;

const HUNKS = 'The diff is split into hunks, each with an id such as h7.';

const LAYER_RULES = [
  'A layer depends only on earlier layers of its own cohort, named by their 1-based position within that cohort. Cohorts never depend on each other.',
  'Every dependency names in "because" the symbols (types, functions, tables, routes, components) the later layer uses from the earlier one, or removes once the earlier one stops using them.',
  `Titles are short imperative phrases ("Add the invitation data model"). A cohort's intent and a layer's summary say what changed and why in one to three plain sentences.`,
  `Give a layer exactly one entry in "files" for every file its ranges touch, and none for any other file. Its path is the file's path exactly as its ## heading shows it, and its note says in one or two plain sentences what changed in that file for this layer and why. A note never restates the path or the layer's summary.`,
  `Give each layer of kind "change" at most two questions in "questions", and give incidental layers none. The reviewer answers each question in their own words after reading the layer, so they find out what they did not understand. A question is good only when all three are true:
   - The answer is not in one hunk: the reviewer must connect two places in the change, or connect a change with code it leaves as it was.
   - A wrong answer means a real risk if the change ships, not only missing knowledge.
   - No tool finds the answer: the compiler, the linter and the existing tests cannot answer it.
   Ask about behaviour ("What happens when the member has left the workspace?") and about what silently changes for code that calls the changed code. Never ask about names, file paths, layer order or anything a reader can copy from the diff. Ask no question rather than a weak one.
   The answer is what a reviewer who understood the change would say, in one to three plain sentences. Its "hunks" are the hunk ids that show the answer, from this layer or an earlier layer of the same cohort.`,
];

const ORDER =
  'Order cohorts by how much a reviewer needs to see them, most significant first, with incidental cohorts last.';

const rules = (first: string, rest: readonly string[]): string =>
  [first, ...rest].map((rule, at) => `${at + 1}. ${rule}`).join('\n');

const SYSTEM = `You organise a code change into a change stack, ${PURPOSE}.

A change stack has two levels:

${COHORTS}
${LAYERS_ARE}

${SET_ASIDE}

${FACTS}

${COHORT_FACTS}
${JOINED}

${HUNKS} Rules the stack must follow:

${rules('Place every hunk exactly once, as a range of one layer. Never invent a hunk id.', LAYER_RULES)}

${ORDER}`;

const OUTLINE_SYSTEM = `You split a code change into the cohorts of a change stack, ${PURPOSE}. Another step orders each cohort into layers later, so give only the cohorts and the hunks in each.

${COHORTS}

${SET_ASIDE}

${FACTS}

- "uses", "removes", "tests" and "moves code from": the hunk depends on another hunk, so the two belong in the same cohort.
- "uses, unchanged": code the hunk uses that this diff leaves as it was. It links the hunk to nothing, but says which part of the codebase the hunk works with.
${JOINED}

${HUNKS} Rules the cohorts must follow:

${rules(
  'Place every hunk exactly once, in the hunks of one cohort. Never invent a hunk id.',
  [
    `Titles are short imperative phrases ("Add invitations"). A cohort's intent says what changed and why in one to three plain sentences.`,
  ],
)}

${ORDER}`;

const LAYERS_SYSTEM = `You order one cohort of a change stack into layers, ${PURPOSE}. The cohort is fixed: it holds exactly the hunks shown, and other cohorts hold the rest of the change.

${LAYERS_ARE}

${FACTS}

${COHORT_FACTS}

${HUNKS} Rules the layers must follow:

${rules('Place every hunk shown exactly once, as a range of one layer. Never invent a hunk id.', LAYER_RULES)}`;

const [DEPENDENCY_RULE, BECAUSE_RULE, TITLE_RULE, FILES_RULE, QUESTIONS_RULE] =
  LAYER_RULES;

const PLAN_SYSTEM = `You order one cohort of a change stack into layers, ${PURPOSE}. The cohort is fixed: it holds exactly the hunks shown, and other cohorts hold the rest of the change. Another step writes the file notes and the questions of each layer later, so give only the layers, their hunks and their dependencies.

${LAYERS_ARE}

${FACTS}

${COHORT_FACTS}

${HUNKS} Rules the layers must follow:

${rules(
  'Place every hunk shown exactly once, as a range of one layer. Never invent a hunk id.',
  [DEPENDENCY_RULE, BECAUSE_RULE, TITLE_RULE].filter(
    (each) => each !== undefined,
  ),
)}`;

const DETAILS_SYSTEM = `You write the file notes and the review questions of one layer of a change stack, ${PURPOSE}. The layers are fixed: the plan shows every layer of the cohort and its hunks, and the diff shows the hunks of the layer to write for.

${HUNKS} Rules the notes and questions must follow:

${rules(
  'Write only for the layer the prompt names.',
  [FILES_RULE, QUESTIONS_RULE].filter((each) => each !== undefined),
)}`;

const planOf = (plan: LayerDetailsRequest['plan'], layer: number): string =>
  plan
    .map(
      (each, at) =>
        `${at + 1}. ${each.title}${at === layer ? ' (the layer to write for)' : ''}: ${each.summary} Hunks: ${each.hunks.map((entry) => entry.hunk).join(', ')}`,
    )
    .join('\n');

const problemsPrompt = (
  problems: ChangeStackGenerationRequest['problems'],
  of: string,
): string | null =>
  problems.length > 0
    ? `A previous ${of} had these problems, so fix them:\n${problems.map((each) => `- ${describeProblem(each)}`).join('\n')}`
    : null;

const layersOf = (layers: readonly z.infer<typeof LAYER>[]): DraftedLayer[] =>
  layers.map(({ files, ranges, ...layer }) => ({
    ...layer,
    hunks: ranges,
    notes: files,
  }));

const placedIn = (facts: DiffFacts): number => placedHunks(facts).length;

const sizeOf = (hunk: DiffHunk): string => {
  const { added, removed } = changedLinesOf(hunk);
  return `+${added.length} −${removed.length}`;
};

const linesIn = (diff: Diff, facts: DiffFacts): number => {
  const placed = new Set<string>(placedHunks(facts));

  return diff.hunks
    .filter((hunk) => placed.has(hunk.id))
    .reduce((total, hunk) => {
      const { added, removed } = changedLinesOf(hunk);
      return total + added.length + removed.length;
    }, 0);
};

const toPlace = (diff: Diff, facts: DiffFacts): string =>
  `${placedIn(facts)} hunks and ${linesIn(diff, facts)} changed lines to place`;

const described = (diff: Diff, facts: DiffFacts): string => {
  const known = new Map(facts.hunks.map((each) => [each.hunk, each]));
  const uses = (hunk: string) =>
    facts.links.filter((link) => link.from === hunk).map(linkFact);

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
            `### ${hunk.id} (${sizeOf(hunk)})`,
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

export const connectionsPrompt = (facts: DiffFacts): string | null => {
  const linkable = facts.hunks
    .filter((each) => each.linkable)
    .map((each) => each.hunk);
  const groups = connectedGroups(linkable, facts.links);

  if (groups.length < 2) {
    return null;
  }

  const linked = groups.filter((group) => group.length > 1);
  const alone = groups.filter((group) => group.length === 1).flat();

  return [
    `The code connects the hunks it can read into ${groups.length} groups. A cohort of kind "change" with hunks of more than one group needs a joinedBecause. Hunks not named here are in files the code facts do not cover, so they can go in any cohort.`,
    ...linked.map((group, at) => `group ${at + 1}: ${group.join(', ')}`),
    alone.length > 0
      ? `one group each, connected to no other hunk: ${alone.join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');
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

export const redraftPrompt = (request: RedraftRequest): string =>
  [
    `Spotlight checked every layer on its own, with the layers before it, by running \`${request.command}\`. The whole change passes, but some layers do not. Fix each failing layer by moving the few changes it needs, most often a test, fixture or type its errors name, into it or an earlier layer. Keep every layer as small as it was and keep the same number of layers; join layers only where moving changes cannot make one build. Give every layer a note on each file its ranges touch once the changes have moved. Keep everything else as it was:`,
    request.stack
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
    ...request.failed.map((failure) =>
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

type PreviousScope = 'stack' | 'cohorts' | 'layers';

const PREVIOUS_ASKS: Record<PreviousScope, string> = {
  stack: `Keep its cohorts, layers, their order, titles and summaries wherever their hunks are still in the diff. Put each new or changed hunk in the layer where it belongs, or in a new layer when no layer fits. Change a layer's title or summary only when its changes make the old one wrong.
For each question, keep the question and its answer word for word when the answer is still right. Change only the answer when the changes make it wrong. Remove a question that the changes make pointless, and add a question only where a layer is new or changed.`,
  cohorts: `Keep its cohorts, their order and titles wherever their hunks are still in the diff. Put each new or changed hunk in the cohort where it belongs, or in a new cohort when no cohort fits.`,
  layers: `Keep its layers, their order, titles and summaries wherever their hunks are still in this cohort. Put each new or changed hunk in the layer where it belongs, or in a new layer when no layer fits. Change a layer's title or summary only when its changes make the old one wrong.
For each question, keep the question and its answer word for word when the answer is still right. Change only the answer when the changes make it wrong. Remove a question that the changes make pointless, and add a question only where a layer is new or changed.`,
};

export const previousStackPrompt = (
  previous: PreviousStack,
  facts: DiffFacts,
  scope: PreviousScope,
): string | null => {
  const shown = new Set<string>(placedHunks(facts));
  const cohorts = previous.cohorts
    .map((cohort) => ({
      ...cohort,
      layers: cohort.layers
        .map((layer) => ({
          ...layer,
          hunks: layer.hunks.filter((hunk) => shown.has(hunk)),
        }))
        .filter((layer) => layer.hunks.length > 0),
    }))
    .filter((cohort) => cohort.layers.length > 0);

  if (cohorts.length === 0) {
    return null;
  }

  const added = previous.addedHunks.filter((hunk) => shown.has(hunk));

  const listed = cohorts.map((cohort, c) => {
    if (scope === 'cohorts') {
      return `cohort ${c + 1} "${cohort.title}" (${cohort.layers.flatMap((layer) => layer.hunks).join(', ')})`;
    }

    const layers = cohort.layers.map((layer, l) =>
      [
        `layer ${l + 1} "${layer.title}" (${layer.hunks.join(', ')}): ${layer.summary}`,
        ...layer.questions.map(
          (each) => `  question: ${each.question}\n  answer: ${each.answer}`,
        ),
      ].join('\n'),
    );

    return scope === 'layers'
      ? layers.join('\n')
      : [`cohort ${c + 1} "${cohort.title}": ${cohort.intent}`, ...layers].join(
          '\n',
        );
  });

  return [
    `A reviewer already read an earlier version of this change, in the previous stack. Its ${scope === 'cohorts' ? 'cohorts' : 'stack'}, with each hunk named by its id in this diff:`,
    listed.join('\n\n'),
    added.length > 0
      ? `These hunks are new or changed since then: ${added.join(', ')}.`
      : 'No hunk is new or changed since then.',
    PREVIOUS_ASKS[scope],
  ].join('\n\n');
};

const REMEDIES: Partial<Record<StackProblemCode, string>> = {
  unconnected: 'split it, or set joinedBecause',
  'joined-layers':
    'move the few changes a failing layer needs instead, and join layers only where that cannot work',
};

export const describeProblem = (problem: StackProblem): string => {
  const remedy = REMEDIES[problem.code];

  return remedy ? `${problem.message}; ${remedy}` : problem.message;
};

export class ChatCompletionsChangeStackGenerator implements ChangeStackGeneratorPort {
  constructor(private readonly calls: InferenceCallsPort) {}

  availableTo(workspaceId: string): Promise<boolean> {
    return this.calls.availableTo(workspaceId);
  }

  async generate({
    workspaceId,
    diff,
    repository,
    facts,
    problems,
    redraft,
    previous,
  }: ChangeStackGenerationRequest): Promise<GeneratedChangeStack> {
    const { answer, usage } = await this.request(workspaceId, STACK, SYSTEM, [
      repository ? `Repository: ${repository.value}` : null,
      `The diff, as ${toPlace(diff, facts)}:`,
      described(diff, facts),
      connectionsPrompt(facts),
      previous ? previousStackPrompt(previous, facts, 'stack') : null,
      redraft ? redraftPrompt(redraft) : null,
      problemsPrompt(problems, 'stack for this diff'),
    ]);

    return {
      cohorts: answer.cohorts.map(({ layers, ...cohort }) => ({
        ...cohort,
        layers: layersOf(layers),
      })),
      usage,
    };
  }

  async outline({
    workspaceId,
    diff,
    repository,
    facts,
    problems,
    previous,
  }: ChangeStackGenerationRequest): Promise<GeneratedOutline> {
    const { answer, usage } = await this.request(
      workspaceId,
      OUTLINE,
      OUTLINE_SYSTEM,
      [
        repository ? `Repository: ${repository.value}` : null,
        `The diff, as ${toPlace(diff, facts)}:`,
        described(diff, facts),
        connectionsPrompt(facts),
        previous ? previousStackPrompt(previous, facts, 'cohorts') : null,
        problemsPrompt(problems, 'set of cohorts for this diff'),
      ],
    );

    return {
      cohorts: answer.cohorts,
      usage,
    };
  }

  async layers({
    workspaceId,
    part,
    repository,
    cohort,
    problems,
    redraft,
    previous,
  }: CohortLayersRequest): Promise<GeneratedLayers> {
    const { answer, usage } = await this.request(
      workspaceId,
      LAYERS,
      LAYERS_SYSTEM,
      [
        repository ? `Repository: ${repository.value}` : null,
        `The cohort, of kind "${cohort.kind}": ${cohort.title}. ${cohort.intent}`,
        `The cohort's diff, as ${toPlace(part.diff, part.facts)}:`,
        described(part.diff, part.facts),
        previous ? previousStackPrompt(previous, part.facts, 'layers') : null,
        redraft ? redraftPrompt(redraft) : null,
        problemsPrompt(problems, 'set of layers for this cohort'),
      ],
    );

    return { layers: layersOf(answer.layers), usage };
  }

  async layerPlan({
    workspaceId,
    part,
    repository,
    cohort,
    problems,
    redraft,
    previous,
  }: CohortLayersRequest): Promise<GeneratedLayerPlan> {
    const { answer, usage } = await this.request(
      workspaceId,
      PLAN,
      PLAN_SYSTEM,
      [
        repository ? `Repository: ${repository.value}` : null,
        `The cohort, of kind "${cohort.kind}": ${cohort.title}. ${cohort.intent}`,
        `The cohort's diff, as ${toPlace(part.diff, part.facts)}:`,
        described(part.diff, part.facts),
        previous ? previousStackPrompt(previous, part.facts, 'layers') : null,
        redraft ? redraftPrompt(redraft) : null,
        problemsPrompt(problems, 'set of layers for this cohort'),
      ],
    );

    return {
      layers: answer.layers.map(({ ranges, ...layer }) => ({
        ...layer,
        hunks: ranges,
      })),
      usage,
    };
  }

  async layerDetails({
    workspaceId,
    part,
    repository,
    cohort,
    plan,
    layer,
    problems,
  }: LayerDetailsRequest): Promise<GeneratedLayerDetails> {
    const shown = stackPartOf(
      part.diff,
      part.facts,
      plan[layer]?.hunks.map((entry) => entry.hunk) ?? [],
    );
    const { answer, usage } = await this.request(
      workspaceId,
      DETAILS,
      DETAILS_SYSTEM,
      [
        repository ? `Repository: ${repository.value}` : null,
        `The cohort, of kind "${cohort.kind}": ${cohort.title}. ${cohort.intent}`,
        `The cohort's layers:\n${planOf(plan, layer)}`,
        `Write the notes and questions of layer ${layer + 1}. Its diff:`,
        described(shown.diff, shown.facts),
        problemsPrompt(problems, `answer for layer ${layer + 1}`),
      ],
    );

    return {
      details: { notes: answer.files, questions: answer.questions },
      usage,
    };
  }

  private async request<T>(
    workspaceId: string,
    schema: JsonSchema<T>,
    system: string,
    sections: readonly (string | null)[],
  ) {
    return this.calls
      .json(workspaceId, {
        responseSchema: schema,
        system,
        prompt: sections.filter(Boolean).join('\n\n'),
        maxTokens: MAX_OUTPUT,
        reasoning: REASONING,
      })
      .catch((error: unknown) => {
        throw error instanceof ModelEmptyCompletionError
          ? new GenerationError(error.message, error.usage, {
              truncated: error.truncated,
            })
          : error;
      });
  }
}
