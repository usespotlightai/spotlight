import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TaskProposal } from '@work/domain/entities/task-proposal.entity';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it } from 'vitest';

const stored = (state: 'open' | 'created', taskId: TaskId | null) =>
  TaskProposal.rehydrate({
    position: MessagePosition.of(1),
    placement: ProposalPlacement.of({
      lineId: LineId.of('line_1'),
      stationId: StationId.of('station_1'),
    }),
    title: TaskTitle.of('Back off exponentially'),
    description: null,
    state,
    taskId,
    decidedAt: null,
  });

describe('TaskProposal', () => {
  it('names a task once, and only once, it has created it', () => {
    expect(stored('created', TaskId.of('task_1')).taskId?.value).toBe('task_1');
    expect(() => stored('created', null)).toThrow(InconsistentStateError);
    expect(() => stored('open', TaskId.of('task_1'))).toThrow(
      InconsistentStateError,
    );
  });
});
