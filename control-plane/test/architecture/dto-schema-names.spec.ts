import { expect, it } from 'vitest';

import { dtoSchemaNameViolations } from './dto-schema-names';
import { described } from './violation';

it('gives every OpenAPI schema class a name that no other class uses', () => {
  expect(described(dtoSchemaNameViolations())).toEqual([]);
}, 60_000);
