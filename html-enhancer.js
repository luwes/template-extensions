/* Adapted from https://github.com/github/jtml - MIT - Keith Cirkel */
/*
  - TODO: add support for element enhancement (hydration)
 */

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

const templates = new WeakMap();
const renderedTemplates = new WeakMap();
const renderedTemplateInstances = new WeakMap();

class TemplateResult {
  #strings;
  #values;
  #processor;

  constructor(strings, values, processor) {
    this.#strings = strings;
    this.#values = values;
    this.#processor = processor;
  }

  get enhanceTemplate() {
    if (templates.has(this.#strings)) {
      return templates.get(this.#strings);
    } else {
      const end = this.#strings.length - 1;
      const template = this.#strings.reduce(
        (str, cur, i) => str + cur + (i < end ? `{{${i}}}` : ''),
        ''
      );
      templates.set(this.#strings, template);
      return template;
    }
  }

  enhanceInto(element) {
    const template = this.enhanceTemplate;
    if (renderedTemplates.get(element) !== template) {
      renderedTemplates.set(element, template);
      const instance = new AssignedTemplateInstance(
        element,
        template,
        this.#values,
        this.#processor
      );
      renderedTemplateInstances.set(element, instance);
      return;
    }
    const templateInstance = renderedTemplateInstances.get(element);
    if (templateInstance) {
      templateInstance.update(this.#values);
    }
  }

  get renderTemplate() {
    if (templates.has(this.#strings)) {
      return templates.get(this.#strings);
    } else {
      const template = document.createElement('template');
      const end = this.#strings.length - 1;
      template.innerHTML = this.#strings.reduce(
        (str, cur, i) => str + cur + (i < end ? `{{${i}}}` : ''),
        ''
      );
      templates.set(this.#strings, template);
      return template;
    }
  }

  renderInto(element) {
    const template = this.renderTemplate;
    if (renderedTemplates.get(element) !== template) {
      renderedTemplates.set(element, template);
      const instance = new TemplateInstance(
        template,
        this.#values,
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
      templateInstance.update(this.#values);
    }
  }
}

const defaultProcessor = {
  processCallback(instance, parts, state) {
    if (!state) return;
    for (const [expression, part] of parts) {
      if (expression in state) {
        const value = state[expression];
        processSubTemplate(part, value) ||
          processBooleanAttribute(part, value) ||
          processFunctionAttribute(part, value) ||
          processPropertyIdentity(part, value);
      }
    }
  },
};

function processSubTemplate(part, value) {
  if (value instanceof TemplateResult && part instanceof ChildNodePart) {
    value.enhanceInto(part);
    return true;
  }
}

function processFunctionAttribute(part, value) {
  if (typeof value === 'function' && part instanceof AttrPart) {
    part.element[part.attributeName] = value;
    return true;
  }
}

function processBooleanAttribute(part, value) {
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

export function processPropertyIdentity(part, value) {
  if (part instanceof AttrPart) {
    const ns = part.attributeNamespace;
    const oldValue = part.element.getAttributeNS(ns, part.attributeName);
    if (String(value) !== oldValue) {
      part.value = String(value);
    }
    return true;
  }
  part.value = String(value);
  return true;
}
