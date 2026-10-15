// The deployment sets the permitted hosts. A config author cannot set them.
export class OutboundHosts {
  private readonly allowed: readonly string[];

  constructor(allowed: readonly string[]) {
    this.allowed = allowed
      .map((each) => each.trim().toLowerCase())
      .filter(Boolean);
  }

  static listed(setting: string): OutboundHosts {
    return new OutboundHosts(setting.split(','));
  }

  allow(host: string): boolean {
    const called = host.toLowerCase();

    return this.allowed.some(
      (each) => called === each || called.endsWith(`.${each}`),
    );
  }
}
