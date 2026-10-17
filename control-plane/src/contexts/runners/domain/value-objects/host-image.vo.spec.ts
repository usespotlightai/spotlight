import { InvalidHostReportError } from '@runners/domain/exceptions/invalid-host-report.error';
import {
  HostImage,
  type ReportedImage,
} from '@runners/domain/value-objects/host-image.vo';
import { describe, expect, it } from 'vitest';

const DIGEST = `ghcr.io/acme/widgets@sha256:${'b'.repeat(64)}`;

const reported = (over: Partial<ReportedImage> = {}) =>
  HostImage.reported({
    image: 'ghcr.io/acme/widgets:main',
    usual: false,
    harnesses: [
      { id: 'claude-code', models: ['claude-sonnet-5'], version: '2.1.0' },
    ],
    ...over,
  });

const invalidAt = (over: Partial<ReportedImage>) => {
  try {
    reported(over);
  } catch (error) {
    return error instanceof InvalidHostReportError ? error.field : error;
  }

  return null;
};

describe('HostImage', () => {
  it('keeps an image a host says it can run, with the harnesses it carries', () => {
    const image = reported({
      digest: ` ${DIGEST} `,
      usual: true,
      release: ' 0.9.0 ',
    });

    expect(image.image.value).toBe('ghcr.io/acme/widgets:main');
    expect(image.digest?.value).toBe(DIGEST);
    expect(image.running.serves(image.image)).toBe(true);
    expect(image.running.serves(null)).toBe(true);
    expect(image.usual).toBe(true);
    expect(image.release).toBe('0.9.0');
    expect(image.harnesses.map((each) => each.id.value)).toEqual([
      'claude-code',
    ]);
    expect(image.isServed).toBe(true);
  });

  it('keeps nothing for a digest, release or unavailable reason it was not given', () => {
    const image = reported({ digest: '  ', release: undefined });

    expect(image.digest).toBeNull();
    expect(image.release).toBeNull();
    expect(image.unavailableReason).toBeNull();
  });

  it('is not served when the host cannot use it', () => {
    const image = reported({ unavailableReason: ' could not pull the image ' });

    expect(image.unavailableReason).toBe('could not pull the image');
    expect(image.isServed).toBe(false);
  });

  it('rejects an image that is not a reference', () => {
    expect(invalidAt({ image: 'GHCR.io/Acme/Widgets' })).toBe('images');
    expect(invalidAt({ image: '' })).toBe('images');
  });

  it('rejects a digest that does not pin the image', () => {
    expect(invalidAt({ digest: 'ghcr.io/acme/widgets:main' })).toBe(
      'images.digest',
    );
    expect(invalidAt({ digest: 'NOT A DIGEST' })).toBe('images.digest');
  });

  it('keeps a release or unavailable reason too long to show whole, cut short', () => {
    const image = reported({
      release: 'r'.repeat(65),
      unavailableReason: 'x'.repeat(501),
    });

    expect(image.release).toHaveLength(64);
    expect(image.unavailableReason).toHaveLength(500);
    expect(image.isServed).toBe(false);
  });
});
