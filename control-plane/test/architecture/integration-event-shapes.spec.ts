import { describe, expect, it } from 'vitest';

import {
  changedShapes,
  integrationEventShapes,
  publishedShapes,
  writeNewShapes,
} from './integration-event-shapes';

describe('integration event shapes', () => {
  // The event webhook sends integration events out of Spotlight, so a published kind keeps its payload. Change a payload only with a new version (.v2). To publish a new kind or version, run: SPOTLIGHT_PUBLISH_SHAPES=1 npx vitest run --project unit test/architecture/integration-event-shapes.spec.ts
  it('keeps the payload of each published kind', () => {
    // oxlint-disable-next-line node/no-process-env -- the one switch that publishes new shapes
    if (process.env.SPOTLIGHT_PUBLISH_SHAPES === '1') {
      writeNewShapes();
    }

    expect(changedShapes(publishedShapes(), integrationEventShapes())).toEqual(
      [],
    );
  });

  it('allows a new declaration, and finds a changed or a gone one', () => {
    expect(
      changedShapes(
        { A: 'type A = { a: string }', B: 'type B = { b: string }' },
        { A: 'type A = { a: number }', C: 'type C = { c: string }' },
      ),
    ).toEqual(['A changed from: type A = { a: string }', 'B is gone']);
  });
});
