import {
  AttrPart,
  ChildNodePart,
  AttrPartList,
  InnerTemplatePart,
} from './dom-parts.js';

/**
 * Adapted from https://github.com/dy/template-parts
 * ISC License (ISC)
 * Copyright 2021 Dmitry Iv.
 */

/**
 * Template Instance API
 * https://github.com/WICG/webcomponents/blob/gh-pages/proposals/Template-Instantiation.md
 */

const ELEMENT = 1,
  STRING = 0,
  PART = 1;

export const defaultProcessor = {
  processCallback(instance, parts, state) {
    if (!state) return;
    for (const [expression, part] of parts) {
      if (expression in state) {
        const value = state[expression];
        // boolean attr
        if (
          typeof value === 'boolean' &&
          part instanceof AttrPart &&
          typeof part.element[part.attributeName] === 'boolean'
        ) {
          part.booleanValue = value;
        } else if (typeof value === 'function' && part instanceof AttrPart) {
          part.value = undefined;
          part.element[part.attributeName] = value;
        } else {
          part.value = value;
        }
      }
    }
  },
};

const DocumentFragment = globalThis.DocumentFragment ?? class {};

export class TemplateInstance extends DocumentFragment {
  #parts;
  #processor;

  constructor(template, state, processor = defaultProcessor) {
    super();

    if (!(this.#parts = this.cached?.(template))) {
      this.append(template.content.cloneNode(true));
      this.#parts = parse(this);
    }

    this.#processor = processor;
    processor.createCallback?.(this, this.#parts, state);
    processor.processCallback(this, this.#parts, state);
  }

  update(state) {
    this.#processor.processCallback(this, this.#parts, state);
  }
}

// collect element parts
export const parse = (element, parts = []) => {
  for (let attr of element.attributes || []) {
    if (attr.value.includes('{{')) {
      const list = new AttrPartList();
      for (let [type, value] of tokenize(attr.value)) {
        if (!type) list.append(value);
        else {
          const part = new AttrPart(element, attr.name, attr.namespaceURI);
          list.append(part);
          parts.push([value, part]);
        }
      }
      attr.value = list.toString();
    }
  }

  for (let node of element.childNodes) {
    if (node.nodeType === ELEMENT && !(node instanceof HTMLTemplateElement)) {
      parse(node, parts);
    } else {
      if (node.nodeType === ELEMENT || node.data.includes('{{')) {
        const items = [];
        if (node.data) {
          for (let [type, value] of tokenize(node.data)) {
            if (!type) items.push(value);
            else {
              const part = new ChildNodePart(element);
              items.push(part);
              parts.push([value, part]);
            }
          }
        } else if (node instanceof HTMLTemplateElement) {
          const part = new InnerTemplatePart(element, node);
          items.push(part);
          parts.push([part.expression, part]);
        }

        node.replaceWith(
          ...items.flatMap((part) => part.replacementNodes || part)
        );
      }
    }
  }

  return parts;
};

// parse string with template fields
const mem = {};
export const tokenize = (text) => {
  let value = '',
    open = 0,
    tokens = mem[text],
    i = 0,
    c;

  if (tokens) return tokens;
  else tokens = [];

  for (; (c = text[i]); i++) {
    if (
      c === '{' &&
      text[i + 1] === '{' &&
      text[i - 1] !== '\\' &&
      text[i + 2] &&
      ++open == 1
    ) {
      if (value) tokens.push([STRING, value]);
      value = '';
      i++;
    } else if (
      c === '}' &&
      text[i + 1] === '}' &&
      text[i - 1] !== '\\' &&
      !--open
    ) {
      tokens.push([PART, value.trim()]);
      value = '';
      i++;
    } else value += c || ''; // text[i] is undefined if i+=2 caught
  }

  if (value) tokens.push([STRING, (open > 0 ? '{{' : '') + value]);

  return (mem[text] = tokens);
};
