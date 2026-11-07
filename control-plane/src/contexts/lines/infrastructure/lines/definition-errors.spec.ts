import { InvalidStationJudgeError } from '@lines/domain/exceptions/invalid-station-judge.error';
import { refusalOf } from '@lines/infrastructure/lines/definition-errors';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { describe, expect, it } from 'vitest';

describe('refusalOf', () => {
  it('turns a domain refusal of a definition into its message', () => {
    const refusal = new InvalidStationJudgeError(
      'sample',
      'must be from 0 to 1',
    );

    expect(refusalOf(refusal)).toBe(refusal);
    expect(refusalOf(new InvalidIdentifierError('station key'))).toBeInstanceOf(
      InvalidIdentifierError,
    );
  });

  it('lets any other error through instead of calling it a problem with the definition', () => {
    const fault = new TypeError('reading of undefined');

    expect(() => refusalOf(fault)).toThrow(fault);
  });
});
