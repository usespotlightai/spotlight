import type { LineDefinition } from '@work/application/contracts/line-definition.contract';
import type { LineRenderingPort } from '@work/application/ports/line-rendering.port';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import { lineRowsOf } from '@work/infrastructure/lines/line-rows.of';
import { renderLineRows } from '@work/infrastructure/lines/line-rows.render';

export class RowsLineRendering implements LineRenderingPort {
  heldOf(line: Line): LineDefinition {
    return renderLineRows(lineRowsOf(line));
  }
}
