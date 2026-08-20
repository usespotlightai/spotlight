import { EmptyRecipientError } from '@domain/exceptions/empty-recipient.error';
import { Greeting } from '@domain/value-objects/greeting.vo';

describe('Greeting', () => {
  it('renders a message for its recipient', () => {
    expect(Greeting.for('World').message).toBe('Hello World!');
  });

  it('trims surrounding whitespace', () => {
    expect(Greeting.for('  World  ').message).toBe('Hello World!');
  });

  it('rejects a blank recipient', () => {
    expect(() => Greeting.for('   ')).toThrow(EmptyRecipientError);
  });

  it('compares by value', () => {
    expect(Greeting.for('World').equals(Greeting.for('World'))).toBe(true);
  });
});
