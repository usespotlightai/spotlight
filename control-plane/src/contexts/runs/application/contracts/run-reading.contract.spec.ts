import {
  CONNECTION_ERRORS,
  CONNECTION_OUTCOMES,
  CONNECTION_REASONS,
} from '@runs/application/contracts/run-reading.contract';
import { RUN_PROGRESS_FACTS } from '@runs/application/ports/run-facts.port';
import * as connection from '@runs/domain/value-objects/run-connection.vo';
import { PROGRESSES } from '@runs/domain/value-objects/run-state';
import { describe, expect, it } from 'vitest';

describe('the published run reading language', () => {
  it('names the connection outcomes, reasons and errors the model knows', () => {
    expect(CONNECTION_OUTCOMES).toEqual(connection.CONNECTION_OUTCOMES);
    expect(CONNECTION_REASONS).toEqual(connection.CONNECTION_REASONS);
    expect(CONNECTION_ERRORS).toEqual(connection.CONNECTION_ERRORS);
  });

  it('names the progresses the model knows', () => {
    expect(RUN_PROGRESS_FACTS).toEqual(PROGRESSES);
  });
});
