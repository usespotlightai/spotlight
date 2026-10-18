import { originOfRun } from '@work/domain/services/task-origin';
import { Happening } from '@work/domain/value-objects/happening.vo';
import { TaskOrigin } from '@work/domain/value-objects/task-origin.vo';
import { describe, expect, it } from 'vitest';

describe('originOfRun', () => {
  it('came from a person who created the task at the run’s own station', () => {
    expect(
      originOfRun({
        openedFrom: TaskOrigin.person(),
        originStationId: 'build',
        ranAt: 'build',
      }),
    ).toBe('person');
  });

  it('came from the integration whose happening opened the task there', () => {
    expect(
      originOfRun({
        openedFrom: TaskOrigin.receivedFrom(Happening.of('slack.app_mention')),
        originStationId: 'build',
        ranAt: 'build',
      }),
    ).toBe('slack');
  });

  it('came from a station when the task was created elsewhere and passed on', () => {
    expect(
      originOfRun({
        openedFrom: TaskOrigin.person(),
        originStationId: 'plan',
        ranAt: 'build',
      }),
    ).toBe('station');
  });

  it('came from a station when the station it was created at is gone', () => {
    expect(
      originOfRun({
        openedFrom: TaskOrigin.person(),
        originStationId: null,
        ranAt: 'build',
      }),
    ).toBe('station');
  });
});
