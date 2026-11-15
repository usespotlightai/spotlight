import { afterEach, describe, expect, it } from 'vitest';

import { typingIn } from '@/lib/commands/typing';

const add = (html: string): HTMLElement => {
  const holder = document.createElement('div');
  holder.innerHTML = html;
  document.body.append(holder);

  return holder;
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('typingIn', () => {
  it('is false on the page with nothing open', () => {
    expect(typingIn(document.body)).toBe(false);
  });

  it('is true in a text field', () => {
    const field = add('<input />').querySelector('input');

    expect(typingIn(field)).toBe(true);
  });

  it('is true while a dialog is open, before it takes the focus', () => {
    add('<div role="dialog" data-open></div>');

    expect(typingIn(document.body)).toBe(true);
  });

  it('is true while a menu is open', () => {
    add('<div role="menu" data-open></div>');

    expect(typingIn(document.body)).toBe(true);
  });

  it('is false in the field of a dialog that is closing', () => {
    const field = add(
      '<div role="dialog" data-closed><input /></div>',
    ).querySelector('input');
    field?.focus();

    expect(typingIn(field)).toBe(false);
  });
});
