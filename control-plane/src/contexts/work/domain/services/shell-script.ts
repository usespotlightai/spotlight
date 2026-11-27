/** A word of a shell command, as the program it runs receives it. */
export interface ShellWord {
  /** The word without its quotes and escapes; what the shell expands at run time is left out. */
  readonly value: string;
  /**
   * Whether the script alone says what the word is: not where the shell expands part of it at run time, nor where
   * the script ends inside its quotes.
   */
  readonly known: boolean;
  /** Where the word starts and ends in the script. */
  readonly start: number;
  readonly end: number;
}

/** A simple command of a script: the program it runs and its arguments, without redirections. */
export interface ShellCommand {
  readonly words: readonly ShellWord[];
  /** Where its last word ends, before any redirection or heredoc that follows it. */
  readonly end: number;
}

/** Words that lead a command without being the program it runs, such as `then` or `env`. */
const LEADING = new Set([
  '!',
  '{',
  'if',
  'then',
  'else',
  'elif',
  'while',
  'until',
  'do',
  'time',
  'command',
  'exec',
  'env',
  'nohup',
]);

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*\+?=/;

/** Operators that end one command so that another can begin. */
const SEPARATORS = ['&&', '||', ';;', '|&', ';', '|', '&', '(', ')'];

const REDIRECTION = /^\d*(?:&>>|&>|<<<|<<-|<<|<>|>>|>\||>&|<&|>|<)/;

const WORD_ENDS = new Set([' ', '\t', '\n', ';', '&', '|', '(', ')', '<', '>']);

const PARAMETER = /[A-Za-z0-9_@*#?$!-]/;

const NAME = /[A-Za-z0-9_]/;

const ANSI_C: Readonly<Record<string, string>> = {
  n: '\n',
  t: '\t',
  r: '\r',
  a: '\x07',
  b: '\b',
  e: '\x1b',
  E: '\x1b',
  f: '\f',
  v: '\v',
  '\\': '\\',
  "'": "'",
  '"': '"',
  '?': '?',
};

const DOUBLE_QUOTED_ESCAPES = new Set(['$', '`', '"', '\\']);

const HEREDOC_ESCAPES = new Set(['$', '`', '\\']);

const hexAt = (script: string, at: number, most: number): string =>
  /^[0-9A-Fa-f]*/.exec(script.slice(at, at + most))?.[0] ?? '';

/** A heredoc of a command; its body is read once the line that opens it ends. */
interface Heredoc {
  readonly delimiter: string;
  readonly tabs: boolean;
  /** Whether its delimiter is quoted, so that the shell expands nothing in its body. */
  readonly quoted: boolean;
  body: string | null;
}

interface Read {
  /** The commands read, nested ones included, in the order the shell runs them. */
  readonly commands: readonly ShellCommand[];
  readonly end: number;
}

interface Substitution {
  /** What the substitution prints, where the script alone says so; null where the shell has to run it. */
  readonly output: string | null;
  readonly end: number;
}

const CAT = 'cat';

/**
 * Reads a shell script the way a shell splits it into simple commands, without running anything: quotes and
 * escapes are taken off each word, a command begins only where the shell starts one (never inside quotes), the
 * body of a heredoc and a comment are skipped, and a command substitution is read as a script of its own.
 */
class ShellReader {
  private readonly commands: ShellCommand[] = [];

  private readonly heredocs = new Map<ShellCommand, readonly Heredoc[]>();

  constructor(private readonly script: string) {}

  static commandsIn(script: string): readonly ShellCommand[] {
    return new ShellReader(script).read(0, null).commands;
  }

  private read(from: number, until: ')' | '`' | null): Read {
    const { script } = this;
    const first = this.commands.length;
    let words: ShellWord[] = [];
    let target: 'file' | 'heredoc' | null = null;
    let tabs = false;
    let own: Heredoc[] = [];
    const pending: Heredoc[] = [];
    let at = from;

    const finish = (): void => {
      const program = this.programOf(words);
      const last = program[program.length - 1];

      if (last) {
        const command = { words: program, end: last.end };
        this.commands.push(command);
        this.heredocs.set(command, own);
      }
      words = [];
      own = [];
      target = null;
    };
    const read = (end: number): Read => ({
      commands: this.commands.slice(first),
      end,
    });

    while (at < script.length) {
      const char = script.charAt(at);

      if (char === until) {
        finish();
        return read(at + 1);
      }

      if (char === ' ' || char === '\t') {
        at += 1;
      } else if (char === '\\' && script.charAt(at + 1) === '\n') {
        at += 2;
      } else if (char === '\n') {
        finish();
        at = this.pastHeredocs(at + 1, pending.splice(0));
      } else if (char === '#') {
        const newline = script.indexOf('\n', at);
        at = newline === -1 ? script.length : newline;
      } else if (script.startsWith('&&', at) || script.startsWith('||', at)) {
        finish();
        at += 2;
      } else {
        const redirection = REDIRECTION.exec(script.slice(at))?.[0];

        if (redirection) {
          at += redirection.length;

          const operator = redirection.replace(/^\d+/, '');
          const duplicated = /^(?:\d+|-)/.exec(script.slice(at))?.[0];

          if ((operator === '>&' || operator === '<&') && duplicated) {
            at += duplicated.length;
          } else {
            target =
              operator === '<<' || operator === '<<-' ? 'heredoc' : 'file';
            tabs = operator === '<<-';
          }
          continue;
        }

        const separator = SEPARATORS.find((each) =>
          script.startsWith(each, at),
        );

        if (separator) {
          finish();
          at += separator.length;
          continue;
        }

        const word = this.word(at, until);
        at = word.end;

        if (target === 'heredoc') {
          const heredoc: Heredoc = {
            delimiter: word.value,
            tabs,
            quoted: /['"\\]/.test(script.slice(word.start, word.end)),
            body: null,
          };
          pending.push(heredoc);
          own.push(heredoc);
        } else if (target === null) {
          words.push(word);
        }
        target = null;
      }
    }

    finish();
    return read(at);
  }

  /**
   * Reads a command substitution up to its closing parenthesis. What it prints is known only where it is `cat` of
   * one heredoc, as an agent writes a long body; the shell drops the newlines it ends with. Inside double quotes the
   * commands it runs are left out, as a command is never read from inside quotes.
   */
  private substitution(from: number, quoted: boolean): Substitution {
    const first = this.commands.length;
    const { commands, end } = this.read(from, ')');
    const [only, ...more] = commands;
    const [heredoc, ...others] = (only && this.heredocs.get(only)) ?? [];
    const [program, ...rest] = only?.words ?? [];

    if (quoted) {
      this.commands.splice(first);
    }

    const output =
      more.length === 0 &&
      others.length === 0 &&
      rest.length === 0 &&
      program?.known &&
      program.value === CAT &&
      heredoc
        ? heredoc.body
        : null;

    return { output: output?.replace(/\n+$/, '') ?? null, end };
  }

  private programOf(words: readonly ShellWord[]): ShellWord[] {
    let first = 0;

    while (first < words.length) {
      const word = words[first];

      if (
        !word ||
        !word.known ||
        !(
          LEADING.has(word.value) ||
          ASSIGNMENT.test(this.script.slice(word.start, word.end))
        )
      ) {
        break;
      }
      first += 1;
    }

    return words.slice(first);
  }

  private pastHeredocs(from: number, heredocs: readonly Heredoc[]): number {
    const { script } = this;
    let at = from;

    for (const heredoc of heredocs) {
      const lines: string[] = [];
      let closed = false;

      while (at < script.length && !closed) {
        const newline = script.indexOf('\n', at);
        const lineEnd = newline === -1 ? script.length : newline;
        const raw = script.slice(at, lineEnd);
        const line = heredoc.tabs ? raw.replace(/^\t+/, '') : raw;
        at = lineEnd + 1;

        closed = line === heredoc.delimiter;
        if (!closed) {
          lines.push(line);
        }
      }

      heredoc.body = closed
        ? this.heredocBody(
            lines.map((each) => `${each}\n`).join(''),
            heredoc.quoted,
          )
        : null;
    }

    return Math.min(at, script.length);
  }

  /** A heredoc's body as the command reads it: as written under a quoted delimiter, else null where it expands. */
  private heredocBody(body: string, quoted: boolean): string | null {
    if (quoted) {
      return body;
    }

    let value = '';

    for (let at = 0; at < body.length; at += 1) {
      const char = body.charAt(at);
      const next = body.charAt(at + 1);

      if (char === '\\' && next === '\n') {
        at += 1;
      } else if (char === '\\' && HEREDOC_ESCAPES.has(next)) {
        value += next;
        at += 1;
      } else if (
        char === '`' ||
        (char === '$' && (PARAMETER.test(next) || next === '{' || next === '('))
      ) {
        return null;
      } else {
        value += char;
      }
    }

    return value;
  }

  private word(start: number, until: ')' | '`' | null): ShellWord {
    const { script } = this;
    let value = '';
    let known = true;
    let at = start;

    while (at < script.length) {
      const char = script.charAt(at);
      const next = script.charAt(at + 1);

      if (WORD_ENDS.has(char) || char === until) {
        break;
      }

      if (char === '\\') {
        value += next === '\n' ? '' : next;
        at += 2;
      } else if (char === "'") {
        const close = script.indexOf("'", at + 1);
        const stop = close === -1 ? script.length : close;
        value += script.slice(at + 1, stop);
        known &&= close !== -1;
        at = stop + 1;
      } else if (char === '$' && next === "'") {
        const quoted = this.ansiC(at + 2);
        value += quoted.value;
        known &&= quoted.known;
        at = quoted.end;
      } else if (char === '"' || (char === '$' && next === '"')) {
        const quoted = this.doubleQuoted(char === '"' ? at + 1 : at + 2);
        value += quoted.value;
        known &&= quoted.known;
        at = quoted.end;
      } else if (char === '$' && next === '(') {
        known = false;
        at = this.substitution(at + 2, false).end;
      } else if (char === '`') {
        known = false;
        at = this.read(at + 1, '`').end;
      } else if (char === '$' && next === '{') {
        known = false;
        const close = script.indexOf('}', at);
        at = close === -1 ? script.length : close + 1;
      } else if (char === '$' && PARAMETER.test(next)) {
        known = false;
        at = this.pastParameter(at + 1);
      } else {
        value += char;
        at += 1;
      }
    }

    return { value, known, start, end: Math.min(at, script.length) };
  }

  private pastParameter(from: number): number {
    const { script } = this;

    if (!NAME.test(script.charAt(from)) || /\d/.test(script.charAt(from))) {
      return from + 1;
    }

    let at = from;
    while (at < script.length && NAME.test(script.charAt(at))) {
      at += 1;
    }
    return at;
  }

  private doubleQuoted(from: number): {
    value: string;
    known: boolean;
    end: number;
  } {
    const { script } = this;
    let value = '';
    let known = true;
    let at = from;

    while (at < script.length) {
      const char = script.charAt(at);
      const next = script.charAt(at + 1);

      if (char === '"') {
        return { value, known, end: at + 1 };
      }

      if (char === '\\' && next === '\n') {
        at += 2;
      } else if (char === '\\' && DOUBLE_QUOTED_ESCAPES.has(next)) {
        value += next;
        at += 2;
      } else if (char === '$' && next === '(') {
        const substituted = this.substitution(at + 2, true);
        value += substituted.output ?? '';
        known &&= substituted.output !== null;
        at = substituted.end;
      } else if (char === '$' && next === '{') {
        known = false;
        const close = script.indexOf('}', at);
        at = close === -1 ? script.length : close + 1;
      } else if (char === '$' && PARAMETER.test(next)) {
        known = false;
        at = this.pastParameter(at + 1);
      } else if (char === '`') {
        known = false;
        const close = script.indexOf('`', at + 1);
        at = close === -1 ? script.length : close + 1;
      } else {
        value += char;
        at += 1;
      }
    }

    return { value, known: false, end: script.length };
  }

  private ansiC(from: number): {
    value: string;
    known: boolean;
    end: number;
  } {
    const { script } = this;
    let value = '';
    let at = from;

    while (at < script.length) {
      const char = script.charAt(at);

      if (char === "'") {
        return { value, known: true, end: at + 1 };
      }

      if (char !== '\\') {
        value += char;
        at += 1;
        continue;
      }

      const escape = script.charAt(at + 1);
      const simple = ANSI_C[escape];

      if (simple !== undefined) {
        value += simple;
        at += 2;
      } else if (escape === 'x' || escape === 'u' || escape === 'U') {
        const digits = hexAt(script, at + 2, { x: 2, u: 4, U: 8 }[escape]);
        const code = digits ? parseInt(digits, 16) : NaN;
        value +=
          code <= 0x10ffff
            ? String.fromCodePoint(code)
            : `\\${escape}${digits}`;
        at += 2 + digits.length;
      } else if (
        escape === 'c' &&
        at + 2 < script.length &&
        script.charAt(at + 2) !== "'"
      ) {
        const control = script.charAt(at + 2);
        value +=
          control === '?'
            ? '\x7f'
            : String.fromCharCode(control.toUpperCase().charCodeAt(0) & 0x1f);
        at += 3;
      } else if (/[0-7]/.test(escape)) {
        const digits = /^[0-7]{1,3}/.exec(script.slice(at + 1))?.[0] ?? '';
        value += String.fromCharCode(parseInt(digits, 8));
        at += 1 + digits.length;
      } else {
        value += `\\${escape}`;
        at += 2;
      }
    }

    return { value, known: false, end: script.length };
  }
}

/** The simple commands of a shell script, in the order the shell runs them, each with its words as it receives them. */
export const commandsInScript = (script: string): readonly ShellCommand[] =>
  ShellReader.commandsIn(script);
