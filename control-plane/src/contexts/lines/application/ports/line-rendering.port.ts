import type { LineDefinition } from '@lines/application/contracts/line-definition.contract';
import type { Line } from '@lines/domain/aggregates/line.aggregate';

export const LINE_RENDERING = Symbol('LINE_RENDERING');

export interface LineRenderingPort {
  definitionOf(line: Line): LineDefinition;
}
