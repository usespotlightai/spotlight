import type { HclLiteral } from '@platform/hcl/hcl.parse';
import {
  editedHclBlock,
  type HclEditRefusalCode,
  type HclField,
  type HclGuardedBlock,
  type HclReferenceRule,
} from '@platform/hcl/hcl-edit';
import type {
  StationSourceEdit,
  StationSourceEdited,
  StationSourceEditorPort,
} from '@replays/application/ports/station-source-editor.port';
import { SEARCHABLE_FIELDS } from '@replays/domain/services/searchable-changes';
import { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import type { ConfigPullRequestRefusal } from '@replays/domain/value-objects/config-pull-request-state';

type Searchable = (typeof SEARCHABLE_FIELDS)[number];

type Block = Readonly<Record<string, unknown>>;

const UNSET: Readonly<Record<Searchable, HclLiteral>> = {
  prompt: null,
  harness: null,
  model: null,
  effort: null,
  profile: null,
  skills: [],
  tools: [],
  decisions: false,
  memories: false,
  description: null,
};

const REFERENCES: Partial<Record<Searchable, HclReferenceRule>> = {
  profile: {
    type: 'spotlight_harness_profile',
    attribute: 'key',
    heldAt: 'key',
    tool: false,
  },
  skills: {
    type: 'spotlight_skill',
    attribute: 'key',
    heldAt: 'key',
    tool: false,
  },
  tools: {
    type: 'spotlight_integration',
    attribute: 'source',
    heldAt: 'definition.integration',
    tool: true,
  },
};

const GUARDED: readonly {
  readonly name: string;
  readonly from: string;
  readonly unset: HclLiteral;
}[] = [
  { name: 'check', from: 'check', unset: null },
  { name: 'passes_to', from: 'passesTo', unset: [] },
];

const JUDGE_FIELDS = ['rubric', 'sample', 'trust'] as const;

const REFUSALS: Readonly<Record<HclEditRefusalCode, ConfigPullRequestRefusal>> =
  {
    unparsable: 'file-unparsable',
    'block-not-found': 'block-not-found',
    'blocks-ambiguous': 'blocks-ambiguous',
    'computed-attribute': 'computed-attribute',
    drifted: 'drifted',
    'file-missing': 'file-missing',
    'edit-failed': 'edit-failed',
  };

class UnwritableValue extends Error {}

const FILE_HELD: ReadonlySet<string> = new Set([
  'prompt',
  'description',
  'harness',
  'model',
  'effort',
  'profile',
]);

const isLiteral = (value: unknown): value is HclLiteral =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean' ||
  (Array.isArray(value) && value.every(isLiteral));

const literalIn = (block: Block, field: string, unset: HclLiteral) => {
  const value = block[field] ?? unset;

  if (!isLiteral(value)) {
    throw new UnwritableValue(
      `The station block holds a ${field} Spotlight cannot write into Terraform; change it by hand`,
    );
  }

  return value;
};

const fieldsOf = (edit: StationSourceEdit): readonly HclField[] => {
  const seed = edit.seed.value;
  const candidate = edit.candidate.value;

  return [
    ...SEARCHABLE_FIELDS.map(
      (name): HclField => ({
        name,
        was: literalIn(seed, name, UNSET[name]),
        now: literalIn(candidate, name, UNSET[name]),
        unset: UNSET[name],
        ...(REFERENCES[name] ? { references: REFERENCES[name] } : {}),
        ...(FILE_HELD.has(name)
          ? {
              freshFile: `prompts/${edit.teamKey}/${edit.lineKey}/${edit.stationKey}${name === 'prompt' ? '' : `.${name}`}.md`,
            }
          : {}),
      }),
    ),
    ...GUARDED.map(({ name, from, unset }): HclField => {
      const was = literalIn(seed, from, unset);

      return { name, was, now: was, unset };
    }),
  ];
};

const judgeOf = (seed: Block): HclGuardedBlock => {
  const judge = seed.judge;

  if (typeof judge !== 'object' || judge === null) {
    return { type: 'judge', was: null };
  }

  return {
    type: 'judge',
    was: Object.fromEntries(
      JUDGE_FIELDS.map((each) => [each, literalIn(judge as Block, each, null)]),
    ),
  };
};

export class HclStationSourceEditor implements StationSourceEditorPort {
  async edited(edit: StationSourceEdit): Promise<StationSourceEdited> {
    let fields: readonly HclField[];
    let judge: HclGuardedBlock;

    try {
      fields = fieldsOf(edit);
      judge = judgeOf(edit.seed.value);
    } catch (error) {
      if (error instanceof UnwritableValue) {
        return {
          ok: false,
          reason: ConfigPullRequestReason.of({
            code: 'edit-failed',
            message: error.message,
          }),
        };
      }
      throw error;
    }

    const edited = await editedHclBlock({
      file: edit.file,
      owner: {
        attribute: 'team_id',
        type: 'spotlight_team',
        key: edit.teamKey,
      },
      resource: { type: 'spotlight_line', key: edit.lineKey },
      block: { type: 'station', key: edit.stationKey },
      fields,
      blocks: [judge],
      read: edit.read,
    });

    return edited.ok
      ? { ok: true, files: edited.files, unchecked: edited.unchecked }
      : {
          ok: false,
          reason: ConfigPullRequestReason.of({
            code: REFUSALS[edited.refusal.code],
            message: edited.refusal.message,
            attribute: edited.refusal.attribute,
            expression: edited.refusal.expression,
            wanted: edited.refusal.wanted,
          }),
        };
  }
}
