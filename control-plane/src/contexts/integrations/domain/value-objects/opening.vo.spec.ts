import { Opening } from '@integrations/domain/value-objects/opening.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { describe, expect, it } from 'vitest';

describe('Opening', () => {
  it('keeps the role of the line where a task opens, and the station it starts at', () => {
    const opening = Opening.of({ lineRole: ' review ', station: 'triage' });

    expect(opening.lineRole).toBe('review');
    expect(opening.station).toBe('triage');
  });

  it('leaves the station to the line when none is named', () => {
    expect(
      Opening.of({ lineRole: 'delivery', station: '  ' }).station,
    ).toBeNull();
  });

  it.each([
    { lineRole: 'Delivery Line' },
    { lineRole: 'delivery', station: 'code review' },
  ])('rejects %o, which is not named in words', (input) => {
    expect(() => Opening.of(input)).toThrow(InvalidIdentifierError);
  });
});
