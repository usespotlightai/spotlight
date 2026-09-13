import { EgressRefusedError } from '@domain/exceptions/egress-refused.error';

// Hosts are the deployment's to allow, never a config author's.
export class Egress {
  private readonly allowed: readonly string[];

  constructor(allowed: readonly string[]) {
    this.allowed = allowed
      .map((each) => each.trim().toLowerCase())
      .filter(Boolean);
  }

  allow(url: string): void {
    let host: string;

    try {
      host = new URL(url).host.toLowerCase();
    } catch {
      throw new EgressRefusedError(url, 'is not a URL that can be called');
    }

    const allowed = this.allowed.some(
      (each) => host === each || host.endsWith(`.${each}`),
    );

    if (!allowed) {
      throw new EgressRefusedError(
        host,
        'is not among the hosts this deployment allows outbound calls to',
      );
    }
  }
}
