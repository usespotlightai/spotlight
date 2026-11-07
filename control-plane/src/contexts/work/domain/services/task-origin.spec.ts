import { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { originOfRun } from '@work/domain/services/task-origin';
import { TaskOrigin } from '@work/domain/value-objects/task-origin.vo';
import { describe, expect, it } from 'vitest';

const BUILD = StationId.of('build');
const PLAN = StationId.of('plan');

describe('originOfRun', () => {
  it('came from a person who created the task at the run’s own station', () => {
    expect(
      originOfRun({
        openedFrom: TaskOrigin.person(),
        originStationId: BUILD,
        ranAt: BUILD,
      }).value,
    ).toBe('person');
  });

  it('came from the integration whose happening opened the task there', () => {
    expect(
      originOfRun({
        openedFrom: TaskOrigin.receivedFrom(Happening.of('slack.app_mention')),
        originStationId: BUILD,
        ranAt: BUILD,
      }).value,
    ).toBe('slack');
  });

  it('came from a station when the task was created elsewhere and passed on', () => {
    expect(
      originOfRun({
        openedFrom: TaskOrigin.person(),
        originStationId: PLAN,
        ranAt: BUILD,
      }).equals(TaskOrigin.passed()),
    ).toBe(true);
  });

  it('came from a station when the station it was created at is gone', () => {
    expect(
      originOfRun({
        openedFrom: TaskOrigin.person(),
        originStationId: null,
        ranAt: BUILD,
      }).value,
    ).toBe('station');
  });
});
