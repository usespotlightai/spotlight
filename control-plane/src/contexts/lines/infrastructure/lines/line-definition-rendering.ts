import type { LineDefinition } from '@lines/application/contracts/line-definition.contract';
import type { LineRenderingPort } from '@lines/application/ports/line-rendering.port';
import type { Line } from '@lines/domain/aggregates/line.aggregate';
import { renderLine } from '@lines/infrastructure/lines/line-definition.render';

export class LineDefinitionRendering implements LineRenderingPort {
  definitionOf(line: Line): LineDefinition {
    return renderLine(line);
  }
}
