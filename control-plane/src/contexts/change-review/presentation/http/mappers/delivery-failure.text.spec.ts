import { deliveryFailureText } from '@change-review/presentation/http/mappers/delivery-failure.text';
import { describe, expect, it } from 'vitest';

describe('deliveryFailureText', () => {
  it('says nothing where nothing failed', () => {
    expect(deliveryFailureText(null, 'comment')).toBeNull();
  });

  it('passes on what GitHub said, or that GitHub could not be reached', () => {
    expect(
      deliveryFailureText(
        { code: 'github-error', detail: 'Validation Failed' },
        'review',
      ),
    ).toBe('Validation Failed');
    expect(
      deliveryFailureText({ code: 'github-error', detail: null }, 'review'),
    ).toBe('Spotlight couldn’t reach GitHub.');
  });

  it('names what no longer exists', () => {
    expect(
      deliveryFailureText({ code: 'subject-deleted', detail: null }, 'review'),
    ).toBe('The review no longer exists.');
    expect(
      deliveryFailureText({ code: 'parent-deleted', detail: null }, 'comment'),
    ).toBe('The comment that this reply answers no longer exists.');
  });
});
