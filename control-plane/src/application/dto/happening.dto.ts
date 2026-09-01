export interface HappeningDto {
  /** As a rule names it, and as it is stored. */
  readonly happening: string;
  /** Which host raises it. */
  readonly source: string;
  readonly label: string;
  /** How it will read in a note when it comes. */
  readonly told: string;
}
