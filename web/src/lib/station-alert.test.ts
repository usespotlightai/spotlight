import { describe, expect, it } from 'vitest';
import {
  alertOnInsightsPath,
  crossingShown,
  limitShown,
  measureValueShown,
  recoveredShown,
  type StationAlertCrossing,
  thresholdLine,
} from '@/lib/station-alert';

const alert = (over: Partial<StationAlertCrossing>): StationAlertCrossing =>
  ({
    threshold: {
      measure: 'cost_per_run',
      risesBy: null,
      fallsBy: null,
      above: 2,
      below: null,
      over: 1,
    },
    value: 2.5,
    baseline: null,
    currency: 'USD',
    ...over,
  }) as StationAlertCrossing;

describe('crossingShown', () => {
  it('says what the runs it watches came to', () => {
    expect(crossingShown(alert({}))).toBe('The last run cost $2.50.');
  });

  it('says how many runs did it, and the rise from the runs before', () => {
    expect(
      crossingShown(
        alert({
          threshold: {
            measure: 'failed_rate',
            risesBy: 0.1,
            fallsBy: null,
            above: null,
            below: null,
            over: 5,
          },
          value: 0.4,
          baseline: 0.2,
        }),
      ),
    ).toBe('40% of the last 5 runs failed, up from 20% in the 5 before.');
  });
});

describe('recoveredShown', () => {
  it('says the runs came back under a level or rise, and back over a floor or fall', () => {
    expect(recoveredShown(alert({}), '4 Oct')).toBe(
      'Back under the threshold since 4 Oct.',
    );
    expect(
      recoveredShown(
        alert({
          threshold: {
            measure: 'merged_rate',
            risesBy: null,
            fallsBy: null,
            above: null,
            below: 0.4,
            over: 5,
          },
        }),
        '4 Oct',
      ),
    ).toBe('Back over the threshold since 4 Oct.');
  });
});

describe('limitShown', () => {
  it('says a level the alert is set at', () => {
    expect(limitShown(alert({}))).toBe('The alert is set at above $2.00.');
  });

  it('says a rise in points, or a fall in the runs’ currency', () => {
    const threshold = {
      measure: 'failed_rate',
      risesBy: 0.15,
      fallsBy: null,
      above: null,
      below: null,
      over: 5,
    } as const;

    expect(limitShown(alert({ threshold }))).toBe(
      'The alert is set at a 15-point rise.',
    );
    expect(
      limitShown(
        alert({
          threshold: {
            ...threshold,
            measure: 'cost_per_run',
            risesBy: null,
            fallsBy: 0.5,
          },
        }),
      ),
    ).toBe('The alert is set at a fall of $0.50.');
  });
});

describe('measureValueShown', () => {
  it('shows a rate as a share and a cost in its currency', () => {
    expect(measureValueShown('merged_rate', 0.25, null)).toBe('25%');
    expect(measureValueShown('cost_per_run', 3, 'EUR')).toBe('3.00 EUR');
    expect(measureValueShown('merged_rate', null, null)).toBe('–');
  });

  it('shows a cost as a bare amount where its currency is not known', () => {
    expect(measureValueShown('cost_per_run', 3, null)).toBe('3.00');
  });
});

describe('thresholdLine', () => {
  it('draws a level, and no line for a rise or fall', () => {
    expect(thresholdLine(alert({}))).toBe(2);
    expect(
      thresholdLine(
        alert({
          threshold: {
            measure: 'failed_rate',
            risesBy: 0.1,
            fallsBy: null,
            above: null,
            below: null,
            over: 5,
          },
        }),
      ),
    ).toBeNull();
  });
});

describe('alertOnInsightsPath', () => {
  it('opens the station on the Stations tab, over the shortest period that holds the alert', () => {
    const raised = alert({
      stationId: 'station_1',
      raisedAt: '2026-09-01T10:00:00.000Z',
    });

    expect(
      alertOnInsightsPath(
        'acme',
        'team_1',
        raised,
        new Date('2026-09-03T10:00:00.000Z'),
      ),
    ).toBe(
      '/w/acme/team/team_1/insights?tab=stations&period=7d#station-station_1',
    );
    expect(
      alertOnInsightsPath(
        'acme',
        'team_1',
        raised,
        new Date('2026-09-20T10:00:00.000Z'),
      ),
    ).toBe('/w/acme/team/team_1/insights?tab=stations#station-station_1');
    expect(
      alertOnInsightsPath(
        'acme',
        'team_1',
        raised,
        new Date('2027-03-01T10:00:00.000Z'),
      ),
    ).toBe(
      '/w/acme/team/team_1/insights?tab=stations&period=90d#station-station_1',
    );
  });
});
