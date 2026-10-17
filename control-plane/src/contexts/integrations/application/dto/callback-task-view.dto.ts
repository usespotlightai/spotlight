export interface CallbackTaskView {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly line: string;
  readonly station: string;
  readonly stationKey: string;
  readonly marks: Readonly<Record<string, string>>;
  readonly repositories: readonly string[];
  readonly pullRequest: string | null;
  readonly hook: string;
}
