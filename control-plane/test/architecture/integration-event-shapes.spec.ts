import { describe, expect, it } from 'vitest';

import { integrationEventShapes } from './integration-event-shapes';

describe('integration event shapes', () => {
  // The event webhook sends integration events out of Spotlight. Change the payload of a kind only with a new version (.v2). Add a kind or a version with: npx vitest run --project unit -u test/architecture/integration-event-shapes.spec.ts
  it('keeps the payload of each published kind', async () => {
    await expect(
      `${JSON.stringify(integrationEventShapes(), null, 2)}\n`,
    ).toMatchFileSnapshot('integration-event-shapes.snapshot.json');
  });
});
