import { InvalidRunOrderError } from '@work/domain/exceptions/invalid-run-order.error';

const NAME = /^[a-z][a-zA-Z0-9]*$/;

export class RunTags {
  private constructor(
    private readonly tags: Readonly<Record<string, string>>,
  ) {}

  static none(): RunTags {
    return new RunTags({});
  }

  static of(raw: Readonly<Record<string, string>>): RunTags {
    for (const [name, value] of Object.entries(raw)) {
      if (!NAME.test(name)) {
        throw new InvalidRunOrderError(
          `must name each provision tag in camelCase, not ${JSON.stringify(name)}`,
        );
      }

      if (typeof value !== 'string') {
        throw new InvalidRunOrderError(`must give tag ${name} a text value`);
      }
    }

    return new RunTags({ ...raw });
  }

  get value(): Readonly<Record<string, string>> {
    return { ...this.tags };
  }
}
