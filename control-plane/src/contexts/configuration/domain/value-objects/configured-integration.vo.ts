import { InvalidConfigurationError } from '@configuration/domain/exceptions/invalid-configuration.error';

export class ConfiguredIntegration {
  private constructor(
    readonly source: string,
    readonly name: string,
    readonly path: string,
    readonly connectable: boolean,
  ) {}

  static of(input: {
    source: string;
    name: string;
    path: string;
    connectable: boolean;
  }): ConfiguredIntegration {
    const source = input.source.trim();
    const path = input.path.trim();

    if (source.length === 0 || path.length === 0) {
      throw new InvalidConfigurationError(
        'names an integration without the source or the file it is written in',
      );
    }

    return new ConfiguredIntegration(
      source,
      input.name.trim() || source,
      path,
      input.connectable,
    );
  }

  equals(other: ConfiguredIntegration): boolean {
    return this.source === other.source;
  }
}
