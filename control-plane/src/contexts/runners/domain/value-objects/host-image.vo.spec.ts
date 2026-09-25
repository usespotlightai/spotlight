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

const refusedAt = (over: Partial<ReportedImage>) => {
  try {
    reported(over);
  } catch (error) {
    return error instanceof InvalidHostReportError ? error.field : error;
  }

  return null;
};

describe('HostImage', () => {
  it('holds an image a host says it can run, with the harnesses it carries', () => {
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

  it('holds nothing for a digest, release or refusal it was not given', () => {
    const image = reported({ digest: '  ', release: undefined });

    expect(image.digest).toBeNull();
    expect(image.release).toBeNull();
    expect(image.refused).toBeNull();
  });

  it('is not served when the host refused it', () => {
    const image = reported({ refused: ' could not pull the image ' });

    expect(image.refused).toBe('could not pull the image');
    expect(image.isServed).toBe(false);
  });

  it('refuses an image that is not a reference', () => {
    expect(refusedAt({ image: 'GHCR.io/Acme/Widgets' })).toBe('images');
    expect(refusedAt({ image: '' })).toBe('images');
  });

  it('refuses a digest that does not pin the image', () => {
    expect(refusedAt({ digest: 'ghcr.io/acme/widgets:main' })).toBe(
      'images.digest',
    );
    expect(refusedAt({ digest: 'NOT A DIGEST' })).toBe('images.digest');
  });

  it('keeps a release or refusal too long to show whole, cut short', () => {
    const image = reported({
      release: 'r'.repeat(65),
      refused: 'x'.repeat(501),
    });

    expect(image.release).toHaveLength(64);
    expect(image.refused).toHaveLength(500);
    expect(image.isServed).toBe(false);
  });
});
