import { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import { describe, expect, it } from 'vitest';

describe('ContinuityKey', () => {
  it('names a directory for a task at a station', () => {
    expect(
      ContinuityKey.for({ taskId: 'task_1', stationId: 'station_2' }).value,
    ).toBe('task_1-station_2');
  });

  it('is the same for every run while the task stands there', () => {
    const here = ContinuityKey.for({
      taskId: 'task_1',
      stationId: 'station_2',
    });

    expect(
      ContinuityKey.for({ taskId: 'task_1', stationId: 'station_2' }).equals(
        here,
      ),
    ).toBe(true);
    expect(
      ContinuityKey.for({ taskId: 'task_1', stationId: 'station_3' }).equals(
        here,
      ),
    ).toBe(false);
  });

  it('names a chat’s directory apart from any task’s', () => {
    expect(ContinuityKey.forChat('chat_1').value).toBe('chat-chat_1');
  });

  it('refuses a key that names nothing', () => {
    expect(() => ContinuityKey.of('  ')).toThrow();
  });
});
