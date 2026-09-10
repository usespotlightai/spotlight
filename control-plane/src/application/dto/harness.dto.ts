export interface HarnessModelDto {
  readonly id: string;
  readonly name: string;
}

export interface HarnessDto {
  readonly id: string;
  readonly name: string;
  readonly executable: string;
  /** The models it advertises, in the order they are offered on the board. */
  readonly models: readonly HarnessModelDto[];
  /** Which of them a station runs on where it names none of its own. */
  readonly defaultModel: string;
  /** The effort levels it offers, in order. Empty where it takes none. */
  readonly efforts: readonly string[];
  /** What a runner runs to list its models, argv-style. Empty where it cannot. */
  readonly discovery: readonly string[];
}
