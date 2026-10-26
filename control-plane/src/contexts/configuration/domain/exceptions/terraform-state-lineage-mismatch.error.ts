export class TerraformStateLineageMismatchError extends Error {
  readonly kind = 'conflict' as const;

  constructor(name: string, kept: string, sent: string) {
    super(
      `Terraform state ${name} has the lineage ${kept}, and this state has ${sent}, so it was not written. Keep the state of another configuration under another state name.`,
    );
    this.name = 'TerraformStateLineageMismatchError';
  }
}
