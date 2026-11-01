export class OutboundHosts {
  private constructor(
    private readonly any: boolean,
    private readonly exact: ReadonlySet<string>,
    private readonly suffixes: readonly string[],
  ) {}

  static listed(setting: string): OutboundHosts {
    const entries = setting
      .split(',')
      .map((each) => normal(each))
      .filter(Boolean);
    const exact = new Set<string>();
    const suffixes: string[] = [];

    for (const entry of entries) {
      if (entry === '*') {
        throw new Error(
          `"${entry}" permits every host. Leave the list empty to permit every public host.`,
        );
      }

      if (entry.startsWith('*.')) {
        const suffix = entry.slice(1);

        if (suffix.slice(1).includes('*') || !suffix.slice(1).includes('.')) {
          throw new Error(`"${entry}" is not a pattern such as *.example.com.`);
        }

        suffixes.push(suffix);
      } else if (/[*/: ]/.test(entry)) {
        throw new Error(
          `"${entry}" is not a host such as api.example.com or a pattern such as *.example.com.`,
        );
      } else {
        exact.add(entry);
      }
    }

    return new OutboundHosts(entries.length === 0, exact, suffixes);
  }

  allows(host: string): boolean {
    return this.named(host) || (this.any && normal(host) !== '');
  }

  named(host: string): boolean {
    const called = normal(host);

    return (
      this.exact.has(called) ||
      this.suffixes.some(
        (suffix) => called.endsWith(suffix) && called.length > suffix.length,
      )
    );
  }
}

const normal = (host: string): string =>
  host.trim().toLowerCase().replace(/\.$/, '');
