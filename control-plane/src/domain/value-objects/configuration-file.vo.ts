import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

const SHAPE = /^[^/][^\0]*$/;

export class ConfigurationFile {
  private constructor(
    readonly path: string,
    readonly text: string,
  ) {}

  static of(path: string, text: string): ConfigurationFile {
    const named = path.trim();

    if (!SHAPE.test(named) || named.split('/').includes('..')) {
      throw new InvalidIdentifierError(
        'configuration file',
        'is a path within the repository',
      );
    }

    return new ConfigurationFile(named, text);
  }

  isUnder(directory: string): boolean {
    return this.path.startsWith(
      directory.endsWith('/') ? directory : `${directory}/`,
    );
  }

  get isYaml(): boolean {
    return /\.ya?ml$/.test(this.path);
  }

  equals(other: ConfigurationFile): boolean {
    return this.path === other.path && this.text === other.text;
  }
}
