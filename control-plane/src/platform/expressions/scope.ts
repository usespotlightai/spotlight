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

  fieldsAt(path: readonly string[]): readonly string[] {
    const [name, ...within] = path;
    const declared = name === undefined ? undefined : this.declared[name];
    let fields: string | SchemaFields | undefined =
      typeof declared === 'object' ? declared.schema : declared;

    for (const field of within) {
      fields = this.fieldsOf(fields)?.[field];
    }

    return Object.keys(this.fieldsOf(fields) ?? {}).sort();
  }

  private fieldsOf(
    fields: string | SchemaFields | undefined,
  ): SchemaFields | undefined {
    return typeof fields === 'string'
      ? this.types.find(([name]) => name === fields)?.[1]
      : fields;
  }
}
