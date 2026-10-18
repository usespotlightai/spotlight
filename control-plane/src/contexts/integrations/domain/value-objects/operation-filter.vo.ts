import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';

const GLOB = /^[a-z0-9*-]+$/;

const matcherOf = (glob: string): RegExp =>
  new RegExp(`^${glob.split('*').map(escaped).join('.*')}$`);

const escaped = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export class OperationFilter {
  private constructor(
    readonly include: readonly string[],
    readonly exclude: readonly string[],
  ) {}

  static of(input: {
    include?: readonly string[];
    exclude?: readonly string[];
  }): OperationFilter {
    const include = input.include ?? [];
    const exclude = input.exclude ?? [];

    for (const glob of [...include, ...exclude]) {
      if (!GLOB.test(glob)) {
        throw new InvalidIntegrationPartError(
          `tool filter ${JSON.stringify(glob)}`,
          'is a tool name in lowercase words joined by dashes, with * for any run of letters, as in *-issue*',
        );
      }
    }

    return new OperationFilter(include, exclude);
  }

  matches(name: string): boolean {
    const matches = (glob: string) => matcherOf(glob).test(name);

    return (
      (this.include.length === 0 || this.include.some(matches)) &&
      !this.exclude.some(matches)
    );
  }
}
