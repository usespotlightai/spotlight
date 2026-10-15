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
    change: null,
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
          change: {
            unit: 'points',
            by: 0.2,
            fromZero: false,
            direction: 'up',
            tone: 'bad',
          },
        }),
      ),
    ).toBe('40% of the last 5 runs failed, up from 20% in the 5 before.');
  });

  it('says the runs held level with the ones before when the server reads no move', () => {
    expect(
      crossingShown(
        alert({
          threshold: {
            measure: 'cost_per_run',
            risesBy: 0.5,
            fallsBy: null,
            above: null,
            below: null,
            over: 1,
          },
          baseline: 2.5,
          change: {
            unit: 'percent',
            by: 0,
            fromZero: false,
            direction: 'same',
            tone: 'flat',
          },
        }),
      ),
    ).toBe('The last run cost $2.50, the same as $2.50 in the one before.');
  });
});

describe('recoveredShown', () => {
  it('says the runs came back under a level or rise, and back over a floor or fall', () => {
    expect(recoveredShown(alert({}), '4 Oct')).toBe(
      'The station has been back under the threshold since 4 Oct.',
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
    ).toBe('The station has been back over the threshold since 4 Oct.');
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
  it('opens the station on the Stations tab, over the period the server says holds the alert', () => {
    expect(
      alertOnInsightsPath(
        'acme',
        'team_1',
        alert({ stationId: 'station_1', insightsPeriod: '7d' }),
      ),
    ).toBe(
      '/w/acme/team/team_1/insights?tab=stations&period=7d#station-station_1',
    );
    expect(
      alertOnInsightsPath(
        'acme',
        'team_1',
        alert({ stationId: 'station_1', insightsPeriod: '30d' }),
      ),
    ).toBe('/w/acme/team/team_1/insights?tab=stations#station-station_1');
  });
});
