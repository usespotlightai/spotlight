interface ConfiguredIntegrationDto {
  readonly source: string;
  readonly name: string;
  readonly path: string;
  readonly connectable: boolean;
  readonly connection: { readonly handle: string | null } | null;
}

export interface ConfigurationDto {
  readonly integrations: readonly ConfiguredIntegrationDto[];
}
