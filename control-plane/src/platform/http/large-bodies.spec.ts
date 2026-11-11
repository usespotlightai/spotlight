import {
  type LargeBodyRoute,
  takingLargeBodies,
} from '@platform/http/large-bodies';
import { describe, expect, it } from 'vitest';

const route = (path: string): LargeBodyRoute => ({
  method: 'post',
  segments: path.split('/').filter((part) => part !== ''),
});

const takesLargeBody = takingLargeBodies([
  route('runs/:runId/events'),
  route('webhooks/w/:slug/t/:teamKey/:integration'),
  route('webhooks/:integration'),
]);

describe('takingLargeBodies', () => {
  it.each([
    '/api/runs/r1/events',
    '/api/webhooks/github',
    '/api/webhooks/w/acme/t/ENG/slack',
  ])('takes a large body on POST %s', (path) => {
    expect(takesLargeBody('POST', path)).toBe(true);
  });

  it.each([
    ['GET', '/api/runs/r1/events'],
    ['POST', '/api/runs/r1/events/extra'],
    ['POST', '/api/v1/resources/skills'],
    ['POST', '/runs/r1/events'],
  ])('keeps the default limit on %s %s', (method, path) => {
    expect(takesLargeBody(method, path)).toBe(false);
  });
});
