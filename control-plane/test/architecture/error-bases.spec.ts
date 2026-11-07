import { expect, it } from 'vitest';
import { errorBaseViolations } from './error-bases';

it('gives every domain error the DomainError base and every other kinded error the ApplicationError base', () => {
  expect(errorBaseViolations()).toEqual([]);
}, 60_000);
