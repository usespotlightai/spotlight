import { InvalidTerraformStateError } from '@configuration/domain/exceptions/invalid-terraform-state.error';

const MD5_HEX = /^[0-9a-f]{32}$/;

const documentOf = (text: string): Readonly<Record<string, unknown>> => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new InvalidTerraformStateError('is not JSON');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new InvalidTerraformStateError('must be a JSON object');
  }

  return parsed as Readonly<Record<string, unknown>>;
};

export class StateSnapshot {
  private constructor(
    readonly serial: number,
    readonly lineage: string,
    readonly md5: string,
    readonly size: number,
  ) {}

  static read(input: {
    text: string;
    md5: string;
    size: number;
  }): StateSnapshot {
    const document = documentOf(input.text);
    const { serial, lineage } = document;

    if (typeof serial !== 'number' || !Number.isInteger(serial) || serial < 0) {
      throw new InvalidTerraformStateError(
        'must have a serial that is a whole number of 0 or more',
      );
    }

    if (typeof lineage !== 'string' || lineage.trim().length === 0) {
      throw new InvalidTerraformStateError('must have a lineage');
    }

    return StateSnapshot.of({
      serial,
      lineage,
      md5: input.md5,
      size: input.size,
    });
  }

  static of(input: {
    serial: number;
    lineage: string;
    md5: string;
    size: number;
  }): StateSnapshot {
    if (!MD5_HEX.test(input.md5)) {
      throw new InvalidTerraformStateError(
        'MD5 must be 32 lowercase hexadecimal digits',
      );
    }

    if (!Number.isInteger(input.size) || input.size <= 0) {
      throw new InvalidTerraformStateError('must not be empty');
    }

    return new StateSnapshot(
      input.serial,
      input.lineage,
      input.md5,
      input.size,
    );
  }
}
