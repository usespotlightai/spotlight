import { Continuity } from '@domain/value-objects/continuity.vo';
import { HarnessSession } from '@domain/value-objects/harness-session.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { describe, expect, it } from 'vitest';

describe('Continuity', () => {
  it('tells the runner which directory to work in, and to keep it', () => {
    const told = Continuity.of({ key: 'task_1-station_2' }).told();

    expect(told).toEqual({ key: 'task_1-station_2', keep: true });
  });

  it('names the conversation to take up where there is one', () => {
    const told = Continuity.of({
      key: 'task_1-station_2',
      sessionId: HarnessSession.of('session_1'),
      pinnedTo: RunnerId.of('runner_1'),
    }).told();

    expect(told).toEqual({
      key: 'task_1-station_2',
      sessionId: 'session_1',
      keep: true,
    });
  });

  it('says nothing about a conversation there is none of', () => {
    expect(
      Continuity.of({ key: 'task_1-station_2' }).told(),
    ).not.toHaveProperty('sessionId');
  });
});
