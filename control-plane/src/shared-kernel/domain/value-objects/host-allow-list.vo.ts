import { InvalidHostAllowListError } from '@shared-kernel/domain/exceptions/invalid-host-allow-list.error';

const normal = (host: string): string =>
  host.trim().toLowerCase().replace(/\.$/, '');

const lettered = (entry: string): string => {
  if (!/^[a-z0-9._*-]+$/.test(entry)) {
    throw new InvalidHostAllowListError(
      entry,
      'has a character a host name cannot have. Write an internationalised host in its xn-- form',
    );
  }

  return entry;
};

const checked = (raw: string): string => {
  const entry = normal(raw);

  if (!entry) {
    throw new InvalidHostAllowListError(
      entry,
      'is empty. Write a host such as api.example.com',
    );
  }

  if (entry === '*') {
    throw new InvalidHostAllowListError(
      entry,
      'permits every host. Leave the list empty to permit every public host',
    );
  }

  if (entry.startsWith('*.')) {
    const suffix = entry.slice(2);

    if (suffix.includes('*') || !suffix.includes('.')) {
      throw new InvalidHostAllowListError(
        entry,
        'is not a pattern such as *.example.com',
      );
    }

    return lettered(entry);
  }

  if (/[*/: ]/.test(entry)) {
    throw new InvalidHostAllowListError(
      entry,
      'is not a host such as api.example.com or a pattern such as *.example.com',
    );
  }

  return lettered(entry);
};

export class HostAllowList {
  static readonly none = new HostAllowList([]);

  private constructor(readonly entries: readonly string[]) {}

  static of(entries: readonly string[]): HostAllowList {
    return HostAllowList.restored(entries.map(checked));
  }

  static restored(entries: readonly string[]): HostAllowList {
    return new HostAllowList(
      [...new Set(entries.map(normal))].sort((one, other) =>
        one < other ? -1 : one > other ? 1 : 0,
      ),
    );
  }

  static listed(setting: string): HostAllowList {
    return HostAllowList.of(
      setting.split(',').filter((each) => normal(each) !== ''),
    );
  }

  get isEmpty(): boolean {
    return this.entries.length === 0;
  }

  allows(host: string): boolean {
    return this.named(host) || (this.isEmpty && normal(host) !== '');
  }

  named(host: string): boolean {
    const called = normal(host);

    return this.entries.some((entry) =>
      entry.startsWith('*.')
        ? called.endsWith(entry.slice(1)) && called.length > entry.length - 1
        : called === entry,
    );
  }

  equals(other: HostAllowList): boolean {
    return (
      this.entries.length === other.entries.length &&
      this.entries.every((each, at) => other.entries[at] === each)
    );
  }
}
