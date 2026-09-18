import { Opening } from '@integrations/domain/value-objects/opening.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { describe, expect, it } from 'vitest';

describe('Opening', () => {
  it('keeps the role of the line a task opens onto, and the station it starts at', () => {
    const opening = Opening.of({ onto: ' improvement ', at: 'triage' });

    expect(opening.onto).toBe('improvement');
    expect(opening.at).toBe('triage');
  });

  it('leaves the station to the line when none is named', () => {
    expect(Opening.of({ onto: 'delivery', at: '  ' }).at).toBeNull();
  });

  it.each([{ onto: 'Delivery Line' }, { onto: 'delivery', at: 'code review' }])(
    'refuses %o, which is not named in words',
    (input) => {
      expect(() => Opening.of(input)).toThrow(InvalidIdentifierError);
    },
  );
});
