import type {
  TaskTraceDto,
  TraceNodeDto,
} from '@work/application/dto/task-trace.dto';
import {
  TaskTraceResponseDto,
  TraceConnectionResponseDto,
  TraceNodeResponseDto,
} from '@work/presentation/http/dto/task-trace.response.dto';
import {
  spanToResponse,
  stepToResponse,
} from '@work/presentation/http/mappers/run-journal.http.mapper';

const nodeToResponse = (node: TraceNodeDto): TraceNodeResponseDto =>
  new TraceNodeResponseDto(
    node.id,
    node.kind,
    node.name,
    node.startedAt,
    node.ms,
    node.tone,
    node.cost,
    node.currency,
    node.step && stepToResponse(node.step),
    node.span && spanToResponse(node.span),
    node.connection && new TraceConnectionResponseDto(node.connection),
    node.egressEnforcement,
    node.children.map(nodeToResponse),
  );

export const TaskTraceHttpMapper = {
  toResponse(trace: TaskTraceDto): TaskTraceResponseDto {
    return new TaskTraceResponseDto(
      trace.startedAt,
      trace.ms,
      trace.rows,
      trace.faults,
      trace.roots.map(nodeToResponse),
    );
  },
};
