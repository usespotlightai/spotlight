import type { LineDefinitionStation } from '@lines/application/contracts/line-definition.contract';

export const STATION_SOURCE_FIELDS = [
  'prompt',
  'harness',
  'model',
  'effort',
  'profile',
  'skills',
  'tools',
  'decisions',
  'memories',
  'description',
] as const;

export type StationSourceField = (typeof STATION_SOURCE_FIELDS)[number];

export interface StationSourceFile {
  readonly path: string;
  readonly content: string;
}

export interface StationSourceEditRequest {
  readonly file: StationSourceFile;
  readonly teamKey: string;
  readonly lineKey: string;
  readonly stationKey: string;
  readonly seed: LineDefinitionStation;
  readonly candidate: LineDefinitionStation;
  readonly fields: readonly StationSourceField[];
  readonly configFiles: readonly StationSourceFile[];
}

export type StationSourceEditFailureCode =
  | 'unparsable'
  | 'block-not-found'
  | 'blocks-ambiguous'
  | 'computed-attribute'
  | 'base-changed'
  | 'file-missing'
  | 'edit-failed';

export type StationSourceValue =
  | string
  | number
  | boolean
  | null
  | readonly StationSourceValue[];

export interface StationSourceEditFailure {
  readonly code: StationSourceEditFailureCode;
  readonly message: string;
  readonly attribute: string | null;
  readonly expression: string | null;
  readonly wanted: StationSourceValue | null;
}

export type StationSourceEdited =
  | {
      readonly ok: true;
      readonly files: readonly StationSourceFile[];
      readonly unchecked: readonly string[];
    }
  | { readonly ok: false; readonly failure: StationSourceEditFailure };

export const STATION_SOURCE_EDITS = Symbol('STATION_SOURCE_EDITS');

export interface StationSourceEditsPort {
  edited(request: StationSourceEditRequest): Promise<StationSourceEdited>;
}
