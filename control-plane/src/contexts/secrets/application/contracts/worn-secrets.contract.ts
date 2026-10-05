import type { WornSecret } from '@secrets/domain/value-objects/secret-binding.vo';
import {
  SECRET,
  type Secret,
} from '@shared-kernel/domain/value-objects/secret';

export interface WornRequest {
  readonly url: URL;
  readonly headers: Record<string, string>;
}

const WITHHELD = '[secret]';

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

const wornInQuery = (url: URL, name: string, value: string): void => {
  const segments = url.search.slice(1).split('&');
  const wearing = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  const at = segments.findIndex((each) => nameOf(each) === name);
  const kept = segments.filter(
    (each, index) => index === at || nameOf(each) !== name,
  );

  url.search =
    at < 0
      ? [...kept.filter((each) => each !== ''), wearing].join('&')
      : kept.map((each) => (nameOf(each) === name ? wearing : each)).join('&');
};

export class WornSecrets implements Secret {
  readonly #worn: readonly WornSecret[];

  private constructor(worn: readonly WornSecret[]) {
    this.#worn = worn;
  }

  static none(): WornSecrets {
    return new WornSecrets([]);
  }

  static of(worn: readonly WornSecret[]): WornSecrets {
    return new WornSecrets(worn);
  }

  get [SECRET](): true {
    return true;
  }

  get isEmpty(): boolean {
    return this.#worn.length === 0;
  }

  applyTo(request: WornRequest): void {
    for (const each of this.#worn) {
      if (each.carrier === 'query') {
        wornInQuery(request.url, each.name, each.value);
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
    return this.#worn
      .flatMap((each) => [
        ...spellingsOf(each.value),
        ...spellingsOf(each.bare),
      ])
      .sort((one, other) => other.length - one.length)
      .reduce((said, spelling) => said.split(spelling).join(WITHHELD), text);
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
    return WITHHELD;
  }

  toJSON(): string {
    return WITHHELD;
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `WornSecrets ${WITHHELD}`;
  }
}
