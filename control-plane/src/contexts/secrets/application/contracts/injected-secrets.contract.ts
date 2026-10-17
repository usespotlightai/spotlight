import type { InjectedSecret } from '@secrets/domain/value-objects/secret-binding.vo';
import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';

export interface InjectionRequest {
  readonly url: URL;
  readonly headers: Record<string, string>;
}

const REDACTED = '[secret]';

const lowerHex = (text: string): string =>
  text.replace(/%[0-9A-F]{2}/g, (escaped) => escaped.toLowerCase());

const inJson = (value: string): string => JSON.stringify(value).slice(1, -1);

const spellingsOf = (value: string): readonly string[] => {
  const escaped = [
    encodeURIComponent(value),
    new URLSearchParams({ v: value }).toString().slice(2),
  ];

  return [
    ...new Set([
      value,
      inJson(value),
      inJson(value).replaceAll('/', '\\/'),
      ...escaped,
      ...escaped.map(lowerHex),
    ]),
  ].filter((each) => each !== '');
};

const nameOf = (segment: string): string => {
  const [name = ''] = segment.split('=', 1);

  try {
    return decodeURIComponent(name.replaceAll('+', ' '));
  } catch {
    return name;
  }
};

const injectInQuery = (url: URL, name: string, value: string): void => {
  const segments = url.search.slice(1).split('&');
  const injection = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  const at = segments.findIndex((each) => nameOf(each) === name);
  const remaining = segments.filter(
    (each, index) => index === at || nameOf(each) !== name,
  );

  url.search =
    at < 0
      ? [...remaining.filter((each) => each !== ''), injection].join('&')
      : remaining
          .map((each) => (nameOf(each) === name ? injection : each))
          .join('&');
};

export class InjectedSecrets implements Secret {
  readonly #injected: readonly InjectedSecret[];

  private constructor(injected: readonly InjectedSecret[]) {
    this.#injected = injected;
  }

  static none(): InjectedSecrets {
    return new InjectedSecrets([]);
  }

  static of(injected: readonly InjectedSecret[]): InjectedSecrets {
    return new InjectedSecrets(injected);
  }

  get [SECRET](): true {
    return true;
  }

  get isEmpty(): boolean {
    return this.#injected.length === 0;
  }

  applyTo(request: InjectionRequest): void {
    for (const each of this.#injected) {
      if (each.location === 'query') {
        injectInQuery(request.url, each.name, each.value);
        continue;
      }

      for (const name of Object.keys(request.headers)) {
        if (name.toLowerCase() === each.name) {
          delete request.headers[name];
        }
      }

      request.headers[each.name] = each.value;
    }
  }

  redact(text: string): string {
    return this.#injected
      .flatMap((each) => [
        ...spellingsOf(each.value),
        ...spellingsOf(each.bare),
      ])
      .sort((one, other) => other.length - one.length)
      .reduce(
        (redacted, spelling) => redacted.split(spelling).join(REDACTED),
        text,
      );
  }

  redactedIn(value: unknown): unknown {
    if (this.isEmpty) {
      return value;
    }

    if (typeof value === 'string') {
      return this.redact(value);
    }

    if (Array.isArray(value)) {
      return value.map((each) => this.redactedIn(each));
    }

    if (typeof value === 'object' && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([key, each]) => [
          this.redact(key),
          this.redactedIn(each),
        ]),
      );
    }

    return value;
  }

  toString(): string {
    return REDACTED;
  }

  toJSON(): string {
    return REDACTED;
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `InjectedSecrets ${REDACTED}`;
  }
}
