import type {
  NamedSecret,
  SecretUser,
  SecretUsesPort,
} from '@secrets/application/ports/secret-uses.port';

export class SecretUsesRegistry implements SecretUsesPort {
  private readonly users: SecretUser[] = [];

  register(user: SecretUser): void {
    this.users.push(user);
  }

  async of(secret: NamedSecret): Promise<readonly string[]> {
    const uses: string[] = [];

    for (const user of this.users) {
      uses.push(...(await user.usesOf(secret)));
    }

    return uses;
  }
}
