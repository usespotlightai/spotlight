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
  /** Where it ends before the first of its redirections, or at its last word. */
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

const hexAt = (script: string, at: number, most: number): string =>
  /^[0-9A-Fa-f]*/.exec(script.slice(at, at + most))?.[0] ?? '';

interface Heredoc {
  readonly delimiter: string;
  readonly tabs: boolean;
}

interface Read {
  readonly commands: ShellCommand[];
  readonly end: number;
}

/**
 * Reads a shell script the way a shell splits it into simple commands, without running anything: quotes and
 * escapes are taken off each word, a command begins only where the shell starts one (never inside quotes), the
 * body of a heredoc and a comment are skipped, and a command substitution is read as a script of its own.
 */
class ShellReader {
  private readonly commands: ShellCommand[] = [];

  constructor(private readonly script: string) {}

  static commandsIn(script: string): readonly ShellCommand[] {
    return new ShellReader(script).read(0, null).commands;
  }

  private read(from: number, until: ')' | '`' | null): Read {
    const { script } = this;
    let words: ShellWord[] = [];
    let end: number | null = null;
    let target: 'file' | 'heredoc' | null = null;
    let tabs = false;
    const heredocs: Heredoc[] = [];
    let at = from;

    const finish = (): void => {
      const program = this.programOf(words);
      const [first] = program;
      const last = program[program.length - 1];

      if (first && last) {
        this.commands.push({
          words: program,
          end: end !== null && end > first.start ? end : last.end,
        });
      }
      words = [];
      end = null;
      target = null;
    };

    while (at < script.length) {
      const char = script.charAt(at);

      if (char === until) {
        finish();
        return { commands: this.commands, end: at + 1 };
      }

      if (char === ' ' || char === '\t') {
        at += 1;
      } else if (char === '\\' && script.charAt(at + 1) === '\n') {
        at += 2;
      } else if (char === '\n') {
        finish();
        at = this.pastHeredocs(at + 1, heredocs.splice(0));
      } else if (char === '#') {
        const newline = script.indexOf('\n', at);
        at = newline === -1 ? script.length : newline;
      } else if (script.startsWith('&&', at) || script.startsWith('||', at)) {
        finish();
        at += 2;
      } else {
        const redirection = REDIRECTION.exec(script.slice(at))?.[0];

        if (redirection) {
          end ??= words[words.length - 1]?.end ?? at;
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
          heredocs.push({ delimiter: word.value, tabs });
        } else if (target === null) {
          words.push(word);
        }
        target = null;
      }
    }

    finish();
    return { commands: this.commands, end: at };
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
      while (at < script.length) {
        const newline = script.indexOf('\n', at);
        const lineEnd = newline === -1 ? script.length : newline;
        const line = script.slice(at, lineEnd);
        at = lineEnd + 1;

        if (
          (heredoc.tabs ? line.replace(/^\t+/, '') : line) === heredoc.delimiter
        ) {
          break;
        }
      }
    }

    return Math.min(at, script.length);
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
        at = this.read(at + 2, ')').end;
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
        known = false;
        at = this.pastParenthesised(at + 2);
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

  private pastParenthesised(from: number): number {
    const { script } = this;
    let depth = 1;
    let quote: string | null = null;
    let at = from;

    for (; at < script.length && depth > 0; at += 1) {
      const char = script.charAt(at);

      if (char === '\\' && quote !== "'") {
        at += 1;
      } else if (quote) {
        quote = char === quote ? null : quote;
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === '(') {
        depth += 1;
      } else if (char === ')') {
        depth -= 1;
      }
    }

    return at;
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
