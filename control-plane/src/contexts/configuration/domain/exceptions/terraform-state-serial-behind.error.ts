export class TerraformStateSerialBehindError extends Error {
  readonly kind = 'conflict' as const;

  constructor(name: string, kept: number, sent: number) {
    super(
      `Terraform state ${name} is at serial ${kept}, and this state is at serial ${sent}, so it was not written. Run terraform plan again from the latest state.`,
    );
    this.name = 'TerraformStateSerialBehindError';
  }
}
