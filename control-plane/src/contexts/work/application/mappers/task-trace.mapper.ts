import type {
  TaskTraceDto,
  TraceNodeDto,
} from '@work/application/dto/task-trace.dto';
import {
  spanToDto,
  stepToDto,
} from '@work/application/mappers/run-journal.mapper';
import type { Trace, TraceNode } from '@work/application/read-models/trace-of';

const nodeToDto = (node: TraceNode): TraceNodeDto => ({
  id: node.id,
  kind: node.kind,
  name: node.name,
  startedAt: node.from.toISOString(),
  ms: node.to.getTime() - node.from.getTime(),
  tone: node.tone,
  cost: node.cost?.amount ?? null,
  currency: node.cost?.currency ?? null,
  step: node.step && stepToDto(node.step),
  span: node.span && spanToDto(node.span),
  children: node.children.map(nodeToDto),
});

export const TaskTraceMapper = {
  toDto(trace: Trace): TaskTraceDto {
    return {
      startedAt: trace.from?.toISOString() ?? null,
      ms:
        trace.from && trace.to ? trace.to.getTime() - trace.from.getTime() : 0,
      rows: trace.rows,
      faults: trace.faults,
      roots: trace.roots.map(nodeToDto),
    };
  },
};
