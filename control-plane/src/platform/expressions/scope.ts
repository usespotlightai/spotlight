export type SchemaFields = { readonly [field: string]: string | SchemaFields };

export type Declared = string | { readonly schema: SchemaFields };

export type NamedType = readonly [name: string, fields: SchemaFields];

export class Scope {
  private constructor(
    readonly declared: Readonly<Record<string, Declared>>,
    readonly types: readonly NamedType[] = [],
  ) {}

  static of(declared: Readonly<Record<string, Declared>>): Scope {
    return new Scope(declared);
  }

  and(more: Readonly<Record<string, Declared>>): Scope {
    return new Scope({ ...this.declared, ...more }, this.types);
  }

  typed(types: readonly NamedType[]): Scope {
    return new Scope(this.declared, types);
  }

  get names(): readonly string[] {
    return Object.keys(this.declared).sort();
  }
}
