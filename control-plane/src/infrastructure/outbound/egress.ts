import { EgressRefusedError } from '@domain/exceptions/egress-refused.error';

/**
 * The deployment's outbound allowlist, as a gate any outbound call passes
 * through. A templated URL — or an OAuth2 token endpoint — carries real secrets,
 * so where Spotlight may reach is the deployment's to say, never a config
 * author's. Empty allows nothing.
 */
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
