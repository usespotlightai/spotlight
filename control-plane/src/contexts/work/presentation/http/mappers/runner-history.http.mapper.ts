import type { RunnerHistoryDto } from '@work/application/dto/runner-history.dto';
import {
  HistoryRunResponseDto,
  RunnerHistoryResponseDto,
} from '@work/presentation/http/dto/runner-history.response.dto';
import { TaskTraceHttpMapper } from '@work/presentation/http/mappers/task-trace.http.mapper';

export const RunnerHistoryHttpMapper = {
  toResponse(history: RunnerHistoryDto): RunnerHistoryResponseDto {
    return new RunnerHistoryResponseDto(
      history,
      history.runs.map(
        (run) =>
          new HistoryRunResponseDto(
            run,
            TaskTraceHttpMapper.toResponse(run.trace),
          ),
      ),
    );
  },
};
