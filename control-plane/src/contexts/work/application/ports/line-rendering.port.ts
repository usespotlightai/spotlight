import type { HeldLine } from '@work/application/contracts/held-line.contract';
import type { Line } from '@work/domain/aggregates/line.aggregate';

export const LINE_RENDERING = Symbol('LINE_RENDERING');

export interface LineRenderingPort {
  heldOf(line: Line): HeldLine;
}
