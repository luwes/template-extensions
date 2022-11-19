/* Adapted from https://github.com/github/jtml - MIT - Keith Cirkel */

import {
  TemplateInstance,
  AssignedTemplateInstance,
  ChildNodePart,
  AttrPart,
} from './src/index.js';

export function render(result, element) {
  result.renderInto(element);
}

export function enhance(result, element) {
  result.enhanceInto(element);
}

export function html(strings, ...values) {
  return new TemplateResult(strings, values, defaultProcessor);
}

const templateCache = new WeakMap();
const htmlCache = new WeakMap();
const renderedTemplates = new WeakMap();
const renderedTemplateInstances = new WeakMap();

class TemplateResult {
  strings;
  values;
  #processor;

  constructor(strings, values, processor) {
    this.strings = strings;
    this.values = values;
    this.#processor = processor;
  }

  get templateHTML() {
    if (htmlCache.has(this.strings)) {
      return htmlCache.get(this.strings);
    } else {
      let html = this.strings[0];
      for (let i = 0; i < this.values.length; i++)
        html += `{{${i}}}` + this.strings[i + 1];
      htmlCache.set(this.strings, html);
      return html;
    }
  }

  enhanceInto(element) {
    const template = this.template;
    if (renderedTemplates.get(element) !== template) {
      renderedTemplates.set(element, template);
      const instance = new AssignedTemplateInstance(
        element,
        template,
        this.values,
        this.#processor
      );
      renderedTemplateInstances.set(element, instance);
      return;
    }
    const templateInstance = renderedTemplateInstances.get(element);
    if (templateInstance) {
      templateInstance.update(this.values);
    }
  }

  get template() {
    if (templateCache.has(this.strings)) {
      return templateCache.get(this.strings);
    } else {
      const template = document.createElement('template');
      template.innerHTML = this.templateHTML;
      templateCache.set(this.strings, template);
      return template;
    }
  }

  renderInto(element) {
    const template = this.template;
    if (renderedTemplates.get(element) !== template) {
      renderedTemplates.set(element, template);
      const instance = new TemplateInstance(
        template,
        this.values,
        this.#processor
      );
      renderedTemplateInstances.set(element, instance);
      if (element instanceof ChildNodePart) {
        element.replace(...instance.children);
      } else {
        element.textContent = '';
        element.appendChild(instance);
      }
      return;
    }
    const templateInstance = renderedTemplateInstances.get(element);
    if (templateInstance) {
      templateInstance.update(this.values);
    }
  }

  toString() {
    let html = this.strings[0];
    for (let i = 0; i < this.values.length; i++) {
      html += escapeHtml(this.values[i]) + this.strings[i + 1];
    }
    return html;
  }
}

const defaultProcessor = {
  processCallback(instance, parts, state) {
    if (!state) return;
    for (const [expression, part] of parts) {
      if (expression in state) {
        const value = state[expression];
        processBooleanAttribute(instance, part, value) ||
          processEvent(instance, part, value) ||
          processSubTemplate(instance, part, value) ||
          processDocumentFragment(instance, part, value) ||
          processIterable(instance, part, value) ||
          processPropertyIdentity(instance, part, value);
      }
    }
  },
};

function processSubTemplate(instance, part, value) {
  if (value instanceof TemplateResult && part instanceof ChildNodePart) {
    if (instance.assign) {
      value.enhanceInto(part.parentNode);
    } else {
      value.renderInto(part);
    }
    return true;
  }
}

export function processDocumentFragment(instance, part, value) {
  if (value instanceof DocumentFragment && part instanceof ChildNodePart) {
    if (value.childNodes.length) part.replace(...value.childNodes);
    return true;
  }
  return false;
}

function processEvent(instance, part, value) {
  if (part instanceof AttrPart && part.attributeName.startsWith('on')) {
    let name = part.attributeName.slice(2).toLowerCase();

    if (value) {
      part.element.addEventListener(name, eventProxy);
    } else {
      part.element.removeEventListener(name, eventProxy);
    }

    (part.element._listeners || (part.element._listeners = {}))[name] = value;
    part.element.removeAttributeNS(part.attributeNamespace, part.attributeName);
    return true;
  }
}

function eventProxy(e) {
  return this._listeners && this._listeners[e.type](e);
}

function processBooleanAttribute(instance, part, value) {
  if (
    typeof value === 'boolean' &&
    part instanceof AttrPart
    // can't use this because on custom elements the props are always undefined
    // typeof part.element[part.attributeName] === 'boolean'
  ) {
    const ns = part.attributeNamespace;
    const oldValue = part.element.hasAttributeNS(ns, part.attributeName);
    if (value !== oldValue) {
      part.booleanValue = value;
    }
    return true;
  }
}

export function processPropertyIdentity(instance, part, value) {
  if (part instanceof AttrPart) {
    const ns = part.attributeNamespace;
    const oldValue = part.element.getAttributeNS(ns, part.attributeName);
    if (String(value) !== oldValue) {
      part.value = String(value);
    }
    return true;
  }
  if (String(value) !== part.value) {
    part.value = String(value);
  }
  return true;
}

function isIterable(value) {
  return typeof value === 'object' && Symbol.iterator in value;
}

function processIterable(instance, part, value) {
  if (!isIterable(value)) return false;
  if (part instanceof ChildNodePart) {
    const nodes = [];
    let i = 0;
    for (const item of value) {
      if (item instanceof TemplateResult) {
        if (instance.assign) {
          item.enhanceInto({ childNodes: [part.replacementNodes[i]] });
        } else {
          const fragment = document.createDocumentFragment();
          item.renderInto(fragment);
          nodes.push(...fragment.childNodes);
        }
      } else if (item instanceof DocumentFragment) {
        if (instance.assign) {
          // todo fix
        } else {
          nodes.push(...item.childNodes);
        }
      } else {
        if (instance.assign) {
          // todo fix
        } else {
          nodes.push(String(item));
        }
      }
      ++i;
    }
    if (nodes.length) part.replace(...nodes);
    return true;
  } else {
    part.value = Array.from(value).join(' ');
    return true;
  }
}

const replacements = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function escapeHtml(val) {
  return `${val}`.replace(/[&<>"']/g, (char) => replacements[char]);
}
