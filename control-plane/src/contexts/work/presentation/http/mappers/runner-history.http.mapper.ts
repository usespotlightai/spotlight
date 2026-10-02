import type { RunnerHistoryDto } from '@work/application/dto/runner-history.dto';
import {
  HistoryCandidateResponseDto,
  HistoryCandidateRunResponseDto,
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
      history.candidates.map(
        (candidate) =>
          new HistoryCandidateResponseDto(
            candidate,
            candidate.runs.map(
              (run) =>
                new HistoryCandidateRunResponseDto(
                  run,
                  TaskTraceHttpMapper.toResponse(run.trace),
                ),
            ),
          ),
      ),
    );
  },
};
