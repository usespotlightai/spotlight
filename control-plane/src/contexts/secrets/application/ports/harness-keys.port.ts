export const HARNESS_KEYS = Symbol('HARNESS_KEYS');

// Names the secrets that a host gives a harness, with no harness profile that names them.
export interface HarnessKeySource {
  names(): readonly string[];
}

export interface HarnessKeysPort {
  register(source: HarnessKeySource): void;

  names(): readonly string[];
}
