import { InvalidStationAlertError } from '@work/domain/exceptions/invalid-station-alert.error';
import { StationAlert } from '@work/domain/value-objects/station-alert.vo';
import { describe, expect, it } from 'vitest';

const refusal = (input: Parameters<typeof StationAlert.of>[0]) => {
  try {
    StationAlert.of(input);
  } catch (error) {
    return error;
  }

  throw new Error('it was accepted');
};

describe('StationAlert', () => {
  it('keeps a rise to watch for over a number of runs', () => {
    expect(
      StationAlert.of({ measure: 'sent_back_rate', risesBy: 0.2, over: 20 }),
    ).toMatchObject({
      measure: 'sent_back_rate',
      risesBy: 0.2,
      above: null,
      fallsBy: null,
      below: null,
      over: 20,
    });
  });

  it('keeps a fall to watch for, for a measure that is better higher', () => {
    expect(
      StationAlert.of({ measure: 'accepted_rate', fallsBy: 0.1, over: 20 }),
    ).toMatchObject({ measure: 'accepted_rate', risesBy: null, fallsBy: 0.1 });
  });

  it('keeps a floor to stay over, down to 0', () => {
    expect(
      StationAlert.of({ measure: 'merged_rate', below: 0.4, over: 20 }),
    ).toMatchObject({ measure: 'merged_rate', above: null, below: 0.4 });
    expect(
      StationAlert.of({ measure: 'merged_rate', below: 0, over: 20 }),
    ).toMatchObject({ below: 0 });
  });

  it('keeps a cost to stay under, in whatever amount it is', () => {
    expect(
      StationAlert.of({ measure: 'cost_per_run', above: 5, over: 10 }),
    ).toMatchObject({ measure: 'cost_per_run', risesBy: null, above: 5 });
  });

  it.each([
    ['measure', { measure: 'happiness', above: 0.5, over: 5 }],
    ['risesBy', { measure: 'failed_rate', risesBy: 0, over: 5 }],
    ['risesBy', { measure: 'merged_rate', risesBy: 1.5, over: 5 }],
    ['fallsBy', { measure: 'accepted_rate', fallsBy: 0, over: 5 }],
    ['fallsBy', { measure: 'accepted_rate', fallsBy: 1.1, over: 5 }],
    ['fallsBy', { measure: 'cost_per_run', fallsBy: -0.5, over: 5 }],
    ['above', { measure: 'accepted_rate', above: 2, over: 5 }],
    ['above', { measure: 'cost_per_run', above: -1, over: 5 }],
    ['below', { measure: 'merged_rate', below: 1.2, over: 5 }],
    ['below', { measure: 'cost_per_run', below: -1, over: 5 }],
    ['over', { measure: 'failed_rate', above: 0.1, over: 0 }],
    ['over', { measure: 'failed_rate', above: 0.1, over: 2.5 }],
  ] as const)('refuses a wrong %s, naming it', (field, input) => {
    const error = refusal(input);

    expect(error).toBeInstanceOf(InvalidStationAlertError);
    expect((error as InvalidStationAlertError).field).toBe(field);
  });

  it.each([
    ['none', { measure: 'failed_rate', over: 5 }],
    ['two', { measure: 'failed_rate', risesBy: 0.1, above: 0.2, over: 5 }],
    [
      'opposite',
      { measure: 'accepted_rate', fallsBy: 0.1, below: 0.4, over: 5 },
    ],
    [
      'all',
      {
        measure: 'cost_per_run',
        risesBy: 1,
        above: 5,
        fallsBy: 1,
        below: 1,
        over: 5,
      },
    ],
  ] as const)(
    'refuses an alert that sets %s of the thresholds, naming no one field',
    (_, input) => {
      const error = refusal(input);

      expect(error).toBeInstanceOf(InvalidStationAlertError);
      expect((error as InvalidStationAlertError).field).toBeNull();
    },
  );

  it('refuses a second alert watching the same measure for the same kind of threshold, at no one field', () => {
    const first = StationAlert.of({
      measure: 'cost_per_run',
      above: 5,
      over: 10,
    });
    const again = StationAlert.of({
      measure: 'cost_per_run',
      above: 8,
      over: 20,
    });

    expect(() => StationAlert.together([first, again])).toThrow(
      InvalidStationAlertError,
    );
    expect(() => again.alongside([first])).toThrow(
      /already exists on this station/,
    );
    try {
      again.alongside([first]);
    } catch (error) {
      expect((error as InvalidStationAlertError).field).toBeNull();
    }
  });

  it('lets one measure be watched for a level and for a move at once', () => {
    const alerts = [
      StationAlert.of({ measure: 'cost_per_run', above: 5, over: 10 }),
      StationAlert.of({ measure: 'cost_per_run', risesBy: 1, over: 10 }),
      StationAlert.of({ measure: 'failed_rate', above: 0.2, over: 10 }),
    ];

    expect(StationAlert.together(alerts)).toEqual(alerts);
  });
});
