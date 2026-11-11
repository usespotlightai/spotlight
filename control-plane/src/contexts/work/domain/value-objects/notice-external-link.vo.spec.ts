import { InvalidNoticeExternalLinkError } from '@work/domain/exceptions/invalid-notice-external-link.error';
import { NoticeExternalLink } from '@work/domain/value-objects/notice-external-link.vo';
import { describe, expect, it } from 'vitest';

describe('NoticeExternalLink', () => {
  it('allows a GitHub page and nothing else', () => {
    expect(
      NoticeExternalLink.allows('https://github.com/acme/config/pull/7'),
    ).toBe(true);
    expect(NoticeExternalLink.allows('https://github.com/')).toBe(false);
    expect(
      NoticeExternalLink.allows('https://git.example.test/acme/pull/7'),
    ).toBe(false);
    expect(
      NoticeExternalLink.allows('https://ada:pw@github.com/acme/pull/7'),
    ).toBe(false);
    expect(NoticeExternalLink.allows('not a link')).toBe(false);
  });

  it('refuses a link it does not allow, or a label that is empty or long', () => {
    expect(() =>
      NoticeExternalLink.of({ url: 'https://example.test/x', label: 'Open' }),
    ).toThrow(InvalidNoticeExternalLinkError);
    expect(() =>
      NoticeExternalLink.of({
        url: 'https://github.com/acme/pull/7',
        label: ' ',
      }),
    ).toThrow(InvalidNoticeExternalLinkError);
  });

  it('is equal to a link to the same page with the same label', () => {
    const link = NoticeExternalLink.of({
      url: 'https://github.com/acme/pull/7',
      label: 'Open',
    });

    expect(
      link.equals(
        NoticeExternalLink.of({
          url: 'https://github.com/acme/pull/7',
          label: ' Open ',
        }),
      ),
    ).toBe(true);
    expect(
      link.equals(
        NoticeExternalLink.of({
          url: 'https://github.com/acme/pull/8',
          label: 'Open',
        }),
      ),
    ).toBe(false);
  });
});
