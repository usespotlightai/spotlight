/** What is wrong with one file, as whoever has to fix it would read it. */
export interface ConfigProblemDto {
  readonly path: string;
  readonly at: string;
  readonly reason: string;
}

/** One host a workspace has told Spotlight to listen to. */
export interface ConfiguredIntegrationDto {
  readonly source: string;
  readonly name: string;
  readonly deliverTo: string;
  readonly secret: string;
  readonly secretSet: boolean;
  readonly happenings: readonly { happening: string; label: string }[];
}

export interface ConfigurationDto {
  /** Null where nothing has been read yet. */
  readonly repository: string | null;
  readonly sha: string | null;
  readonly readAt: string | null;
  readonly integrations: readonly ConfiguredIntegrationDto[];
  readonly problems: readonly ConfigProblemDto[];
}
