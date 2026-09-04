import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

/** From the root of the repository, and never out of it. */
const SHAPE = /^[^/][^\0]*$/;

/** One file of a workspace's configuration, as the repository held it. */
export class ConfigurationFile {
  private constructor(
    readonly path: string,
    readonly text: string,
  ) {}

  static of(path: string, text: string): ConfigurationFile {
    const named = path.trim();

    // A path climbing out of the repository is not one anybody wrote.
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
