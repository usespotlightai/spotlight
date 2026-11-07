import { deliveryFailureText } from '@change-review/presentation/http/mappers/delivery-failure.text';
import { describe, expect, it } from 'vitest';

describe('deliveryFailureText', () => {
  it('says nothing where nothing failed', () => {
    expect(deliveryFailureText(null)).toBeNull();
  });

  it('passes on what GitHub said, or that GitHub could not be reached', () => {
    expect(
      deliveryFailureText({
        code: 'github-rejected',
        detail: 'Validation Failed',
      }),
    ).toBe('Validation Failed');
    expect(
      deliveryFailureText({ code: 'github-unreachable', detail: null }),
    ).toBe('Spotlight couldn’t reach GitHub.');
    expect(deliveryFailureText({ code: 'unexpected', detail: null })).toBe(
      'Spotlight couldn’t send it to GitHub.',
    );
  });

  it('names what no longer exists', () => {
    expect(deliveryFailureText({ code: 'task-deleted', detail: null })).toBe(
      'The task no longer exists.',
    );
    expect(deliveryFailureText({ code: 'parent-deleted', detail: null })).toBe(
      'The comment that this reply answers no longer exists.',
    );
  });
});
