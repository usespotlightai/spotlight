import type {
  StationSourceBlock,
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
  stationSwitchDefaultsOf,
} from '@lines/application/contracts/line-definition.contract';
import {
  editedHclBlock,
  type HclEditErrorCode,
  type HclField,
  type HclGuardedBlock,
  type HclReferenceRule,
} from '@platform/hcl/hcl-edit';
import type { HclLiteral } from '@platform/hcl/hcl.parse';

const TERRAFORM_FILE = '.tf';

const directoryOf = (path: string): string =>
  path.slice(0, Math.max(path.lastIndexOf('/'), 0));

/** What the station has when its block leaves a field out, so an attribute that says the same is dropped. */
const unsetFor = (
  station: StationSourceBlock,
): Readonly<Record<StationSourceField, HclLiteral>> => {
  const { decisions, memories } = stationSwitchDefaultsOf(
    station.kind === 'work' ? 'work' : 'backlog',
  );

  return {
    prompt: null,
    harness: null,
    model: null,
    effort: null,
    profile: null,
    skills: [],
    tools: [],
    decisions,
    memories,
    description: null,
  };
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

const isBlock = (value: unknown): value is StationSourceBlock =>
  typeof value === 'object' && value !== null;

const literalIn = (
  block: StationSourceBlock,
  field: string,
  unset: HclLiteral,
): HclLiteral => {
  const value = block[field] ?? unset;

  if (!isLiteral(value)) {
    throw new UnwritableValue(
      `Station field ${field} cannot be written into Terraform. Please change it by hand.`,
    );
  }

  return value;
};

const fieldsOf = (request: StationSourceEditRequest): readonly HclField[] => {
  const unset = unsetFor(request.candidate);

  return [
    ...request.fields.map((name): HclField => ({
      name,
      expected: literalIn(request.seed, name, unset[name]),
      desired: literalIn(request.candidate, name, unset[name]),
      unset: unset[name],
      ...(REFERENCES[name] ? { references: REFERENCES[name] } : {}),
      ...(FILE_FIELDS.has(name)
        ? {
            freshFile: stationFileOf(
              request.teamKey,
              request.lineKey.value,
              request.stationKey.value,
              name,
            ),
          }
        : {}),
    })),
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
};

const claimsOf = (judge: unknown): HclLiteral =>
  isBlock(judge) ? literalIn(judge, 'claims', null) : null;

const desiredClaimsOf = (
  candidate: StationSourceBlock,
): Record<string, HclLiteral> => {
  const claims = claimsOf(candidate.judge);

  return claims === null ? {} : { [terraformAttributeOf('claims')]: claims };
};

const judgeOf = (
  seed: StationSourceBlock,
  candidate: StationSourceBlock,
): HclGuardedBlock => {
  const judge = seed.judge;

  if (!isBlock(judge)) {
    return { type: 'judge', expected: null };
  }

  const passThreshold = terraformAttributeOf('passThreshold');

  return {
    type: 'judge',
    expected: Object.fromEntries<HclLiteral>([
      ...JUDGE_FIELDS.map((field): [string, HclLiteral] => [
        terraformAttributeOf(field),
        literalIn(judge, field, null),
      ]),
      [passThreshold, literalIn(judge, 'passThreshold', ALL_CLAIMS)],
    ]),
    unset: { [passThreshold]: ALL_CLAIMS },
    desired: desiredClaimsOf(candidate),
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
      judge = judgeOf(request.seed, request.candidate);
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
      resource: { type: terraformTypeOf('line'), key: request.lineKey.value },
      block: { type: 'station', key: request.stationKey.value },
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
