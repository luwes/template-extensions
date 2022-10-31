import { AttrPart, ChildNodePart } from './dom-parts.js';
import { defaultProcessor } from './template-instance.js';
import { build, evaluate } from './html-parser.js';

const parseHTML = (string, fields) => {
  const tmp = evaluate({ h, interpolation }, build([string]), fields);
  return tmp.length > 1 ? tmp : tmp[0];
};

function h(type, props, ...children) {
  return { type, props, children };
}

function interpolation(value, expression) {
  return new Interpolation(value, expression);
}

class Interpolation {
  constructor(value, expression) {
    this.value = value;
    this.expression = expression;
  }
  valueOf() {
    return this.value;
  }
  toString() {
    return this.value;
  }
}

/**
 * Progressively enhance any DOM element with a string template and init state.
 */
export class AssignedTemplateInstance {
  #parts;
  #processor;
  constructor(element, htmlString, state, processor = defaultProcessor) {
    const vNodeTree = parseHTML(htmlString, state);
    this.#parts = setChildren(
      element.replacementNodes ?? element.childNodes,
      [].concat(vNodeTree)
    );

    this.#processor = processor;
    processor.createCallback?.(this, this.#parts, state);
    processor.processCallback(this, this.#parts, state);
  }
  update(state) {
    this.#processor.processCallback(this, this.#parts, state);
  }
}

function setChildren(childNodes, toChildNodes, parts = []) {
  for (let i = 0; i < toChildNodes.length; i++) {
    const toChild = toChildNodes[i];
    const toValue = toChild.valueOf();
    const filteredChildNodes = filterChildNodes(childNodes);
    let child = filteredChildNodes[i];
    let isText = child?.nodeType === 3;
    let sameLength = filteredChildNodes.length === toChildNodes.length;

    if (typeof toValue === 'string') {
      if (!sameLength && isText) {
        // If the parent's virtual children length don't match the DOM's,
        // it's probably adjacent text nodes stuck together. Split them.
        const textIndex = child.data.indexOf(toValue);
        if (textIndex === -1) {
          console.warn(
            `Warning: Text content did not match. Server: ${child.data} Client: ${toValue}`
          );
          continue;
        }
        child.splitText(textIndex + toValue.length);
      }
    }

    if (toChild instanceof Interpolation) {
      const part = new ChildNodePart(child.parentNode, [child]);
      parts.push([toChild.expression, part]);
      continue;
    }

    if (typeof toValue === 'object') {
      setChild(toValue, filteredChildNodes[i], parts);
      continue;
    }
  }
  return parts;
}

function setChild({ type, props, children }, element, parts) {
  props = props ?? {};
  if (children) {
    props.children = children;
  }

  if (type !== element.localName) {
    console.warn(
      `Warning: Node type did not match. Server: ${element.localName} Client: ${type}`
    );
  }

  for (const name in props) {
    let value = props[name];
    // console.log(value);

    if (name === 'children') {
      setChildren(element.childNodes, value, parts);
      return;
    }

    if (element && value instanceof Interpolation) {
      const part = new AttrPart(
        element,
        name,
        element.attributes[name]?.namespaceURI
      );
      parts.push([value.expression, part]);

      value = value.valueOf();
      if (element.getAttribute(name) !== value && typeof value !== 'function') {
        console.warn(
          `Warning: Attribute ${name} did not match. Server: ${element[name]} Client: ${value}`
        );
      }
    }
  }
}

/**
 * Filter out whitespace text nodes unless it has a noskip indicator.
 *
 * @param  {NodeList} childNodes
 * @return {Array}
 */
function filterChildNodes(childNodes) {
  const TEXT_NODE = 3;
  return Array.from(childNodes).filter(
    (el) => el.nodeType !== TEXT_NODE || el.data.trim() || el._noskip
  );
}
