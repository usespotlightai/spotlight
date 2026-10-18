import type { LineDefinition } from '@work/application/contracts/line-definition.contract';
import type { Line } from '@work/domain/aggregates/line.aggregate';

export const LINE_RENDERING = Symbol('LINE_RENDERING');

export interface LineRenderingPort {
  definitionOf(line: Line): LineDefinition;
}
