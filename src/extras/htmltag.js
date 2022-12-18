/**
 * https://github.com/zenparsing/htmltag
 * MIT License
 * Copyright 2018 Kevin Smith
 */

function makeEnum(i = 0) {
  return new Proxy({}, { get() { return i++; } });
}

export const {
  T_NONE,
  T_COMMENT,
  T_TEXT,
  T_ATTR_PART,
  T_ATTR_MAP,
  T_ATTR_VALUE,
  T_TAG_START,
  T_ATTR_KEY,
  T_TAG_END,
} = makeEnum();

const {
  S_TEXT,
  S_RAW,
  S_OPEN,
  S_ATTR,
  S_ATTR_KEY,
  S_ATTR_KEY_WS,
  S_ATTR_VALUE_WS,
  S_ATTR_VALUE,
  S_ATTR_VALUE_SQ,
  S_ATTR_VALUE_DQ,
  S_COMMENT,
} = makeEnum();

const $tokens = Symbol('tokens');

const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr',
  'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

const ESC_RE = /&(?:(lt|gt|amp|quot)|#([0-9]+)|#x([0-9a-f]+));?/ig;
const NAMED_REFS = { lt: '<', gt: '>', amp: '&', quot: '"' };

function wsToken(t) {
  return t.type === T_TEXT && !t.mutable && (!t.value || !t.value.trim());
}

function rmatch(s, end, t) {
  return end >= t.length && s.slice(end - t.length, end) === t;
}

function wsChar(c) {
  switch (c) {
    case ' ':
    case '\n':
    case '\r':
    case '\t':
    case '\f':
    case '\v':
      return true;
  }
  return c.charCodeAt(0) > 128 && /\s/.test(c);
}

function attrChar(c) {
  return !wsChar(c) && c !== '"' && c !== "'" && c !== '=' && c !== '/';
}

function rawTag(tag) {
  return tag === 'script' || tag === 'style';
}

function escape(value) {
  return value.replace(ESC_RE, (m, name, dec, hex) => name
    ? NAMED_REFS[name.toLowerCase()]
    : String.fromCharCode(parseInt(dec || hex, hex ? 16 : 10)));
}

class Token {
  constructor(type, value, hasEscape) {
    this.type = type;
    this.value = hasEscape ? escape(value) : value;
    this.mutable = false;
  }
}

export class Parser {

  constructor() {
    this.tokens = [];
    this.state = S_TEXT;
    this.tag = '';
  }

  parseChunk(chunk) {
    let state = this.state;
    let tokens = this.tokens;
    let attrPart = (state === S_ATTR_VALUE_DQ || state === S_ATTR_VALUE_SQ);
    let hasEscape = false;
    let a = 0;
    let b = 0;

    for (; b < chunk.length; ++b) {
      let c = chunk[b];
      if (state === S_RAW) {
        if (c === '>' && rmatch(chunk, b, '</' + this.tag)) {
          b -= this.tag.length + 3; // Rewind to closing tag
          state = S_TEXT;
        }
      } else if (state === S_COMMENT) {
        if (c === '>' && rmatch(chunk, b, '--')) {
          if (b - 2 > a) {
            tokens.push(new Token(T_COMMENT, chunk.slice(a, b - 2), false));
          }
          state = S_TEXT;
          hasEscape = false;
          a = b + 1;
        }
      } else if (c === '&') {
        hasEscape = true;
      } else if (state === S_TEXT) {
        if (c === '<') {
          if (b > a) {
            tokens.push(new Token(T_TEXT, chunk.slice(a, b), hasEscape));
          }
          state = S_OPEN;
          hasEscape = false;
          a = b + 1;
        }
      } else if (state === S_ATTR_VALUE_SQ) {
        if (c === "'") {
          let type = attrPart ? T_ATTR_PART : T_ATTR_VALUE;
          tokens.push(new Token(type, chunk.slice(a, b), hasEscape));
          state = S_ATTR;
          hasEscape = false;
          attrPart = false;
          a = b + 1;
        }
      } else if (state === S_ATTR_VALUE_DQ) {
        if (c === '"') {
          let type = attrPart ? T_ATTR_PART : T_ATTR_VALUE;
          tokens.push(new Token(type, chunk.slice(a, b), hasEscape));
          state = S_ATTR;
          hasEscape = false;
          attrPart = false;
          a = b + 1;
        }
      } else if (c === '>') {
        if (state === S_OPEN) {
          let value = chunk.slice(a, b);
          tokens.push(new Token(T_TAG_START, value, hasEscape));
          hasEscape = false;
          a = b;
          this.tag = value;
        } else if (state === S_ATTR_KEY) {
          tokens.push(new Token(T_ATTR_KEY, chunk.slice(a, b), hasEscape));
          hasEscape = false;
          a = b;
        } else if (state === S_ATTR_VALUE) {
          tokens.push(new Token(T_ATTR_VALUE, chunk.slice(a, b), hasEscape));
          hasEscape = false;
          a = b;
        }
        if (voidTags.has(this.tag) || (rmatch(chunk, b, '/') && this.tag[0] !== '/')) {
          tokens.push(new Token(T_TAG_END, '/', false));
          state = S_TEXT;
          hasEscape = false;
          a = b + 1;
        } else {
          tokens.push(new Token(T_TAG_END, '', false));
          hasEscape = false;
          state = rawTag(this.tag) ? S_RAW : S_TEXT;
          a = b + 1;
        }
      } else if (state === S_OPEN) {
        if (c === '-' && chunk.slice(a, b) === '!-') {
          state = S_COMMENT;
          a = b + 1;
        } else if (c === '/' && b === a) {
          // Allow leading slash
        } else if (!attrChar(c)) {
          let value = chunk.slice(a, b);
          tokens.push(new Token(T_TAG_START, value, hasEscape));
          this.tag = value;
          hasEscape = false;
          state = S_ATTR;
          a = b + 1;
        }
      } else if (state === S_ATTR) {
        if (attrChar(c)) {
          state = S_ATTR_KEY;
          a = b;
        }
      } else if (state === S_ATTR_KEY) {
        if (c === '=') {
          tokens.push(new Token(T_ATTR_KEY, chunk.slice(a, b), hasEscape));
          hasEscape = false;
          state = S_ATTR_VALUE_WS;
          a = b + 1;
        } else if (!attrChar(c)) {
          tokens.push(new Token(T_ATTR_KEY, chunk.slice(a, b), hasEscape));
          hasEscape = false;
          state = S_ATTR_KEY_WS;
          a = b + 1;
        }
      } else if (state === S_ATTR_KEY_WS) {
        if (c === '=') {
          state = S_ATTR_VALUE_WS;
          a = b + 1;
        } else if (attrChar(c)) {
          state = S_ATTR_KEY;
          a = b;
        }
      } else if (state === S_ATTR_VALUE_WS) {
        if (c === '"') {
          state = S_ATTR_VALUE_DQ;
          a = b + 1;
        } else if (c === "'") {
          state = S_ATTR_VALUE_SQ;
          a = b + 1;
        } else if (attrChar(c)) {
          state = S_ATTR_VALUE;
          a = b;
        }
      } else if (state === S_ATTR_VALUE) {
        if (!attrChar(c)) {
          tokens.push(new Token(T_ATTR_VALUE, chunk.slice(a, b), hasEscape));
          hasEscape = false;
          state = S_ATTR;
          a = b + 1;
        }
      }
    }

    if (state === S_TEXT || state === S_RAW) {
      if (a < b) {
        tokens.push(new Token(T_TEXT, chunk.slice(a, b), hasEscape));
      }
    } else if (state === S_COMMENT) {
      if (a < b) {
        tokens.push(new Token(T_COMMENT, chunk.slice(a, b), hasEscape));
      }
    } else if (state === S_OPEN) {
      if (a < b) {
        let value = chunk.slice(a, b);
        tokens.push(new Token(T_TAG_START, value, hasEscape));
        this.tag = value;
        state = S_ATTR;
      }
    } else if (state === S_ATTR_KEY) {
      tokens.push(new Token(T_ATTR_KEY, chunk.slice(a, b), hasEscape));
      state = S_ATTR;
    } else if (state === S_ATTR_KEY_WS) {
      state = S_ATTR;
    } else if (state === S_ATTR_VALUE) {
      tokens.push(new Token(T_ATTR_VALUE, chunk.slice(a, b), hasEscape));
      state = S_ATTR;
    } else if (state === S_ATTR_VALUE_SQ || state === S_ATTR_VALUE_DQ) {
      if (a < b) {
        tokens.push(new Token(T_ATTR_PART, chunk.slice(a, b), hasEscape));
      }
    }

    this.state = state;
  }

  pushValue(value) {
    let type = T_NONE;

    switch (this.state) {
      case S_TEXT:
      case S_RAW:
        type = T_TEXT;
        break;
      case S_COMMENT:
        type = T_COMMENT;
        break;
      case S_OPEN:
        type = T_TAG_START;
        this.tag = value;
        this.state = S_ATTR;
        break;
      case S_ATTR:
        type = T_ATTR_MAP;
        break;
      case S_ATTR_VALUE_WS:
        type = T_ATTR_VALUE;
        this.state = S_ATTR;
        break;
      case S_ATTR_VALUE_SQ:
      case S_ATTR_VALUE_DQ:
        type = T_ATTR_PART;
        break;
    }

    if (type !== T_NONE) {
      let token = new Token(type, value);
      token.mutable = true;
      this.tokens.push(token);
    }
  }

  end() {
    let tokens = this.tokens;
    let a = 0;
    let b = tokens.length;

    if (b === 0) {
      return tokens;
    }

    if (wsToken(tokens[0])) { a++; }
    if (wsToken(tokens[b - 1])) { b--; }

    return a === 0 && b === tokens.length ? tokens : tokens.slice(a, b);
  }

}

function tokenize(chunks) {
  if (chunks.length === 0) {
    return [];
  }
  let parser = new Parser();
  parser.parseChunk(chunks[0]);
  for (let i = 1; i < chunks.length; i++) {
    parser.pushValue('');
    parser.parseChunk(chunks[i]);
  }
  return parser.end();
}

function walk(i, node, tokens, vals, actions) {
  for (; i < tokens.length; ++i) {
    let t = tokens[i];
    switch (t.type) {
      case T_TAG_START: {
        let tag = vals.read(t);
        if (typeof tag === 'string' && tag[0] === '/') { // Closing tag
          while (i < tokens.length && tokens[++i].type !== T_TAG_END); // Skip attributes
          return i;
        }
        let child = actions.createElement(tag, node);
        i = walk(i + 1, child, tokens, vals, actions);
        actions.appendChild(node, actions.finishElement(child));
        break;
      }
      case T_TAG_END:
        if (t.value === '/') { return i; }
        break;
      case T_TEXT:
        actions.appendChild(node, vals.read(t));
        break;
      case T_COMMENT:
        actions.appendChild(node, actions.createComment(vals.read(t), node));
        break;
      case T_ATTR_MAP:
        actions.setAttributes(node, vals.read(t));
        break;
      case T_ATTR_KEY: {
        let name = vals.read(t);
        switch (i + 1 < tokens.length ? tokens[i + 1].type : T_NONE) {
          case T_ATTR_VALUE:
            actions.setAttribute(node, name, vals.read(tokens[++i]));
            break;
          case T_ATTR_PART: {
            let parts = [vals.read(tokens[++i])];
            while (i + 1 < tokens.length && tokens[i + 1].type === T_ATTR_PART) {
              parts.push(vals.read(tokens[++i]));
            }
            actions.setAttributeParts(node, name, parts);
            break;
          }
          default:
            actions.setAttribute(node, name, true);
            break;
        }
      }
    }
  }
}

class Vals {

  constructor(values, actions) {
    this.index = 0;
    this.values = values;
    this.actions = actions;
  }

  read(t) {
    return t.mutable
      ? this.actions.mapValue(this.values[this.index++])
      : t.value;
  }

}

export class TemplateResult {

  constructor(callsite, values) {
    let tokens = TemplateResult.cache.get(callsite);
    if (!tokens) {
      tokens = tokenize(callsite.raw);
      tokens.source = {};
      TemplateResult.cache.set(callsite, tokens);
    }
    this[$tokens] = tokens;
    this.source = tokens.source;
    this.values = values;
  }

  evaluate(actions) {
    let root = actions.createRoot();
    walk(0, root, this[$tokens], new Vals(this.values, actions), actions);
    return actions.finishRoot(root);
  }

}

TemplateResult.cache = new WeakMap();

export function html(callsite, ...values) {
  return new TemplateResult(callsite, values);
}

export function createTag(actions) {
  return function htmlTag(literals, ...values) {
    return new TemplateResult(literals, values).evaluate(actions);
  };
}
