export class ReadSecretQuery {
  constructor(
    readonly secretId: string,
    readonly viewerId: string,
  ) {}
}
