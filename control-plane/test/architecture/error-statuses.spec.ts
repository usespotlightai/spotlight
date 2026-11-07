import { expect, it } from 'vitest';
import { errorStatuses } from './error-statuses';
import { EXPECTED_ERROR_STATUSES } from './error-statuses.expected';

it('answers every error class with the HTTP status it is listed with', async () => {
  expect(await errorStatuses()).toEqual(EXPECTED_ERROR_STATUSES);
}, 120_000);
