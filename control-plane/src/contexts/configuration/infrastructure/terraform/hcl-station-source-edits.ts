import type {
  StationSourceEdited,
  StationSourceEditFailureCode,
  StationSourceEditRequest,
  StationSourceEditsPort,
  StationSourceField,
} from '@configuration/application/ports/station-source-edits.port';
import {
  stationFileOf,
  terraformAttributeOf,
  terraformNameOf,
  terraformTypeOf,
} from '@configuration/application/rendering/terraform-layout';
import {
  LINE_DEFINITION_STATION_DEFAULTS,
  type LineDefinitionJudge,
  type LineDefinitionStation,
} from '@lines/application/contracts/line-definition.contract';
import type { HclLiteral } from '@platform/hcl/hcl.parse';
import {
  editedHclBlock,
  type HclEditErrorCode,
  type HclField,
  type HclGuardedBlock,
  type HclReferenceRule,
} from '@platform/hcl/hcl-edit';

const TERRAFORM_FILE = '.tf';

const directoryOf = (path: string): string =>
  path.slice(0, Math.max(path.lastIndexOf('/'), 0));

const UNSET: Readonly<Record<StationSourceField, HclLiteral>> = {
  prompt: null,
  harness: null,
  model: null,
  effort: null,
  profile: null,
  skills: [],
  tools: [],
  decisions: LINE_DEFINITION_STATION_DEFAULTS.decisions,
  memories: LINE_DEFINITION_STATION_DEFAULTS.memories,
  description: null,
};

const REFERENCES: Partial<Record<StationSourceField, HclReferenceRule>> = {
  profile: {
    type: terraformTypeOf('harness-profile'),
    attribute: 'key',
    storedAt: 'key',
    suffixed: false,
  },
  skills: {
    type: terraformTypeOf('skill'),
    attribute: 'key',
    storedAt: 'key',
    suffixed: false,
  },
  tools: {
    type: terraformTypeOf('integration'),
    attribute: 'integration',
    storedAt: 'definition.integration',
    suffixed: true,
  },
};

const FILE_FIELDS: ReadonlySet<StationSourceField> = new Set([
  'prompt',
  'description',
  'harness',
  'model',
  'effort',
  'profile',
]);

const GUARDED: readonly {
  readonly from: keyof LineDefinitionStation;
  readonly unset: HclLiteral;
}[] = [
  { from: 'check', unset: null },
  { from: 'passesTo', unset: [] },
];

const JUDGE_FIELDS: readonly (keyof LineDefinitionJudge)[] = [
  'rubric',
  'claims',
  'sample',
  'minAgreement',
];

const ALL_CLAIMS = LINE_DEFINITION_STATION_DEFAULTS.judgePassThreshold;

const FAILURES: Readonly<
  Record<HclEditErrorCode, StationSourceEditFailureCode>
> = {
  unparsable: 'unparsable',
  'block-not-found': 'block-not-found',
  'blocks-ambiguous': 'blocks-ambiguous',
  'computed-attribute': 'computed-attribute',
  'base-changed': 'base-changed',
  'file-missing': 'file-missing',
  'edit-failed': 'edit-failed',
};

class UnwritableValue extends Error {}

const isLiteral = (value: unknown): value is HclLiteral =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean' ||
  (Array.isArray(value) && value.every(isLiteral));

const literalIn = <T extends object>(
  block: T,
  field: keyof T & string,
  unset: HclLiteral,
) => {
  const value = block[field] ?? unset;

  if (!isLiteral(value)) {
    throw new UnwritableValue(
      `Station field ${field} cannot be written into Terraform. Please change it by hand.`,
    );
  }

  return value;
};

const fieldsOf = (request: StationSourceEditRequest): readonly HclField[] => [
  ...request.fields.map(
    (name): HclField => ({
      name,
      expected: literalIn(request.seed, name, UNSET[name]),
      desired: literalIn(request.candidate, name, UNSET[name]),
      unset: UNSET[name],
      ...(REFERENCES[name] ? { references: REFERENCES[name] } : {}),
      ...(FILE_FIELDS.has(name)
        ? {
            freshFile: stationFileOf(
              request.teamKey,
              request.lineKey,
              request.stationKey,
              name,
            ),
          }
        : {}),
    }),
  ),
  ...GUARDED.map(({ from, unset }): HclField => {
    const was = literalIn(request.seed, from, unset);

    return {
      name: terraformAttributeOf(from),
      expected: was,
      desired: was,
      unset,
    };
  }),
];

const judgeOf = (seed: LineDefinitionStation): HclGuardedBlock => {
  const judge = seed.judge;

  if (typeof judge !== 'object' || judge === null) {
    return { type: 'judge', expected: null };
  }

  const passThreshold = terraformAttributeOf('passThreshold');

  return {
    type: 'judge',
    expected: Object.fromEntries([
      ...JUDGE_FIELDS.map((field) => [
        terraformAttributeOf(field),
        literalIn(judge, field, null),
      ]),
      [passThreshold, literalIn(judge, 'passThreshold', ALL_CLAIMS)],
    ]),
    unset: { [passThreshold]: ALL_CLAIMS },
  };
};

export class HclStationSourceEdits implements StationSourceEditsPort {
  async edited(
    request: StationSourceEditRequest,
  ): Promise<StationSourceEdited> {
    let fields: readonly HclField[];
    let judge: HclGuardedBlock;

    try {
      fields = fieldsOf(request);
      judge = judgeOf(request.seed);
    } catch (error) {
      if (error instanceof UnwritableValue) {
        return {
          ok: false,
          failure: {
            code: 'edit-failed',
            message: error.message,
            attribute: null,
            expression: null,
            wanted: null,
          },
        };
      }
      throw error;
    }

    const contents = new Map(
      request.configFiles.map((each) => [each.path, each.content]),
    );
    const edited = await editedHclBlock({
      file: request.file,
      owner: {
        noun: 'team',
        attribute: 'team_id',
        type: terraformTypeOf('team'),
        key: request.teamKey,
        label: terraformNameOf(request.teamKey),
        labelOf: (key) => terraformNameOf(request.teamKey, key),
      },
      resource: { type: terraformTypeOf('line'), key: request.lineKey },
      block: { type: 'station', key: request.stationKey },
      fields,
      blocks: [judge],
      module: request.configFiles
        .map((each) => each.path)
        .filter(
          (each) =>
            each.endsWith(TERRAFORM_FILE) &&
            directoryOf(each) === directoryOf(request.file.path),
        ),
      read: async (path) => contents.get(path) ?? null,
    });

    return edited.ok
      ? { ok: true, files: edited.files, unchecked: edited.unchecked }
      : {
          ok: false,
          failure: { ...edited.error, code: FAILURES[edited.error.code] },
        };
  }
}
