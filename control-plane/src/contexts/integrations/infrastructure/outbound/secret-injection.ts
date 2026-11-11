import type { InjectedSecrets } from '@secrets/application/contracts/injected-secrets.contract';

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

export const applyInjected = (
  injected: InjectedSecrets,
  request: InjectionRequest,
): void => {
  for (const each of injected.injected) {
    if (each.location === 'query') {
      injectInQuery(request.url, each.name, each.value.revealed());
      continue;
    }

    for (const name of Object.keys(request.headers)) {
      if (name.toLowerCase() === each.name) {
        delete request.headers[name];
      }
    }

    request.headers[each.name] = each.value.revealed();
  }
};

export const redactInjected = (
  injected: InjectedSecrets,
  text: string,
): string =>
  injected.injected
    .flatMap((each) => [
      ...spellingsOf(each.value.revealed()),
      ...spellingsOf(each.bare.revealed()),
    ])
    .sort((one, other) => other.length - one.length)
    .reduce(
      (redacted, spelling) => redacted.split(spelling).join(REDACTED),
      text,
    );

export const redactInjectedIn = (
  injected: InjectedSecrets,
  value: unknown,
): unknown => {
  if (injected.isEmpty) {
    return value;
  }

  if (typeof value === 'string') {
    return redactInjected(injected, value);
  }

  if (Array.isArray(value)) {
    return value.map((each) => redactInjectedIn(injected, each));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, each]) => [
        redactInjected(injected, key),
        redactInjectedIn(injected, each),
      ]),
    );
  }

  return value;
};
