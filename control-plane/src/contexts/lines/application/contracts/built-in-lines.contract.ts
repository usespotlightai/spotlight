import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@lines/domain/services/built-in-lines';

export const WELCOME_LINE_KEY: string = (BUILT_IN_LINES[0] as LineOpening).key
  .value;
