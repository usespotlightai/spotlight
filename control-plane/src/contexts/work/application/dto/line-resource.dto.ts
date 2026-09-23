import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export interface LineResourceDto {
  readonly id: string;
  readonly definition: Readonly<Record<string, unknown>>;
}

export type DefinedLineDto =
  | { readonly ok: true; readonly line: LineResourceDto }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };
