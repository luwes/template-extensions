import { AttrPart, ChildNodePart, AttrPartList } from './dom-parts.js';
import { defaultProcessor, parse } from './template-instance.js';

/**
 * Progressively enhance any DOM element with a template instance, DOM parts and state.
 */
export class AssignedTemplateInstance {
  #parts = [];
  #processor;
  assign = true;

  constructor(element, template, state, processor = defaultProcessor) {
    // console.log(template.innerHTML);
    const tmp = template.content.cloneNode(true);

    // console.time('parse');
    const parts = parse(tmp);
    // console.timeEnd('parse');

    //console.time('parse2');
    processor.processCallback(tmp, parts, state);
    //console.timeEnd('parse2');

    // These selectors could potentially be served from the server or
    // saved per unique template to make assigning the DOM parts to
    // a new element faster. It will skip `parse` and `processCallback`.
    //
    // This would make "partial hydration" possible so the JS bundle doesn't
    // need to ship with a template w/ expressions. Just the selectors would
    // be needed for hydration / enhancing.
    //
    // The selectors include xPath like paths (ignoring whitespace nodes).
    //
    // format: {x: expression, p: path, o: startOffset, a: attributeName, n: nodesLength}
    //
    //         {x: '0', p: '/div/h1', o: 7, a: 'class'}
    //         {x: '6', p: '/div/div[2]/button[2]', a: 'onclick'}
    //         {x: '3', p: '/div/p/text()', o: 448}
    //         {x: '9', p: '/div/dl/dt', n: 8}

    //console.time('createSelectors');
    const selectors = createSelectors(parts);
    //console.timeEnd('createSelectors');
    // console.log(selectors);

    // console.time('createParts');
    this.#parts = createParts(element.childNodes, selectors, state);
    // console.timeEnd('createParts');

    this.#processor = processor;
    processor.createCallback?.(this, this.#parts, state);
    processor.processCallback(this, this.#parts, state);

    this.assign = false;
  }

  update(state) {
    this.#processor.processCallback(this, this.#parts, state);
  }
}

function createSelectors(parts) {
  const selectors = [];
  for (const [expr, part] of parts) {
    let { attributeName, replacementNodes } = part;
    let childNodesLength;
    let startOffset = 0;
    let node = part.element;
    if (node) {
      // AttrPart
      for (let str of part.list) {
        if (str === part) break;
        startOffset += ('' + str).length;
      }
    } else {
      // ChildNodePart
      childNodesLength = getContentChildNodesLength(replacementNodes);
      node = getContentChildNode(replacementNodes, 0);
      startOffset = getStartOffset(node);
    }

    let path = createPath(node);
    let selector = { x: expr, p: path };
    if (childNodesLength > 1) selector.n = childNodesLength;
    if (startOffset) selector.o = startOffset;
    if (attributeName) selector.a = attributeName;
    selectors.push(selector);
    // console.warn(selector);
  }

  return selectors;
}

function getStartOffset(node) {
  let text = '';
  while ((node = node.previousSibling)) {
    if (node?.nodeType !== 3) break;
    text = node.data + text;
  }
  text = text.replace(reWhitespace, ' ');
  return !node && isWhitespace(text[0]) ? text.length - 1 : text.length;
}

function createPath(node) {
  let path = [];
  let { parentNode } = node;
  while (parentNode) {
    let i = 0;
    let { localName, nodeType } = node;
    let prevNode = node;
    while ((node = getPreviousContentSibling(node, localName))) {
      if (nodeType === 3) {
        // Count the adjoining text nodes as 1 block.
        if (node.nodeType === 3 && prevNode.nodeType !== node.nodeType) ++i;
      } else {
        ++i;
      }
      prevNode = node;
    }
    let type = localName ?? 'text()';
    path.push(!i ? type : `${type}[${i + 1}]`);
    node = parentNode;
    ({ parentNode } = node);
  }
  return `/${path.reverse().join('/')}`;
}

function createParts(childNodes, selectors, state) {
  const parts = [];
  for (let selector of selectors) {
    // console.log(selector);
    const { p: path, x: expr, a: attrName, o: startOffset } = selector;
    const element = getNodeFromXPath(childNodes, path);
    if (!element) continue;
    let part;
    if (!attrName) {
      part = createChildNodePart(element, state[expr], selector.n, startOffset);
    } else {
      part = createAttrPart(element, state[expr], attrName, startOffset);
    }
    parts.push([expr, part]);
  }
  return parts;
}

function createChildNodePart(element, value, nodesLength = 1, startOffset = 0) {
  let nodes;
  if (element.nodeType === 3) {
    value = stringifyValue(value);

    let { data } = element;
    let textLen = value.length;
    let serverValue = data.slice(startOffset, startOffset + textLen);

    if (value !== serverValue) {
      const trimStart = !element.previousSibling;
      [element, startOffset] = normalizeNodeIndex(
        element,
        startOffset,
        trimStart
      );
      ({ data } = element);
      textLen = normalizeIndex((data = data.slice(startOffset)), textLen);
      serverValue = data.slice(0, textLen);
    }

    if (!globalThis.PROD && value !== serverValue) {
      console.warn(
        `Warning: Text content did not match. Server: ${serverValue} Client: ${value}`
      );
    }

    // The ChildNodePart's require the adjoining text to split up.
    element = element.splitText(startOffset);
    element.splitText(textLen);

    nodes = [element];
  } else {
    nodes = getNextChildNodes(element, nodesLength);
  }
  return new ChildNodePart(nodes[0].parentNode, nodes);
}

const attrLists = new WeakMap();

function createAttrPart(element, value, attrName, startOffset = 0) {
  if (typeof value === 'function') value = '';

  const attr = element.attributes[attrName];
  const list = attrLists.get(element)?.[attrName] ?? new AttrPartList();
  if (typeof list.item(list.length - 1) === 'string') {
    list.splice(list.length - 1, 1);
  }
  attrLists.set(element, { [attrName]: list });
  if (startOffset > 0) {
    list.append(attr?.value.slice(`${list}`.length, startOffset));
  }

  const valueLength = `${value}`.length;
  let serverValue = attr?.value.slice(startOffset, startOffset + valueLength);
  if (typeof value === 'boolean' && !attr?.value?.length) {
    serverValue = attr?.value == '';
  }

  if (!globalThis.PROD && value != serverValue && `${value}` != serverValue) {
    console.warn(
      `Warning: Attribute part ${attrName} did not match. Server: ${serverValue} Client: ${value}`
    );
  }

  const part = new AttrPart(element, attrName, attr?.namespaceURI, value);
  list.append(part);

  const suffix = attr?.value.slice(`${list}`.length);
  if (suffix) list.append(suffix);

  return part;
}

function getNodeFromXPath(childNodes, xPath) {
  let target;
  let path = xPath.split('/');
  // todo: support id attribute selector for a fast path?
  // https://devhints.io/xpath
  path.shift(); // shift off first section

  for (let query of path) {
    let [type, index] = query.split('[');
    index = index ? parseInt(index) : 1;

    if (type === 'text()') target = getTypeFragment(childNodes, index - 1, 3);
    else target = getContentChildNode(childNodes, index - 1, type);

    if (!globalThis.PROD && !target) {
      console.warn(`Warning: Node path could not be found /${path.join('/')}`);
      return null;
    }

    childNodes = target?.childNodes;
  }
  return target;
}

function stringifyValue(value) {
  if (Array.isArray(value)) value = value.join('');
  else value += '';
  return value;
}

// Get the server node and startIndex including whitespace. The startIndex argument coming
// from the client is from minimized HTML, whitespaces removed according to the rules of
// https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Whitespace
function normalizeNodeIndex(node, startIndex, trimStart) {
  let index = 0,
    data,
    prevChar;
  // Iterate through text nodes only.
  while ((data = node.data)) {
    for (let i = 0; i < data.length; i++) {
      if (trimStart && !isWhitespace(data[i])) {
        trimStart = false;
      }
      if (!trimStart && !(isWhitespace(data[i]) && isWhitespace(prevChar))) {
        if (index === startIndex) return [node, i];
        ++index;
      }
      prevChar = data[i];
    }
    node = node.nextSibling;
  }
  return [node, startIndex];
}

function normalizeIndex(data, startIndex, trimStart) {
  let index = 0,
    prevChar;
  for (let i = 0; i < data.length; i++) {
    if (trimStart && !isWhitespace(data[i])) {
      trimStart = false;
    }
    if (!trimStart && !(isWhitespace(data[i]) && isWhitespace(prevChar))) {
      if (index === startIndex) return i;
      ++index;
    }
    prevChar = data[i];
  }
  return startIndex;
}

function isWhitespace(char) {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r';
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Whitespace
 * Throughout, whitespace is defined as one of the characters
 *  "\t" TAB \u0009
 *  "\n" LF  \u000A
 *  "\r" CR  \u000D
 *  " "  SPC \u0020
 *
 * This does not use JavaScript's "\s" because that includes non-breaking
 * spaces (and also some other characters).
 */

function getContentChildNodesLength(childNodes) {
  let i = 0;
  for (let n of childNodes) if (!isIgnorable(n)) ++i;
  return i;
}

const reWhitespace = /[\t\n\r ]+/g;
const reAnyChars = /[^\t\n\r ]/;

function isIgnorable(node) {
  return (
    node.nodeType === 3 && !reAnyChars.test(node.data) // a text node, all ws
  );
}

// This makes adjoining elements with the same type 1 fragment, counted as 1.
// For example adjoining text nodes are seen as 1 big text node. This is required
// because the DOM parts require the text nodes to be split up so we need to see
// it as 1 big text node to calculate the startOffset for creating new DOM parts.
function getTypeFragment(childNodes, index, type) {
  let i = -1;
  let counted = false;
  for (let n of childNodes) {
    if (n.nodeType !== type) counted = false;
    if (!counted && (n.localName ?? n.nodeType) === type && !isIgnorable(n)) {
      ++i;
      counted = true;
    }
    if (i === index) return n;
  }
}

function getContentChildNode(childNodes, index, type) {
  let i = -1;
  for (let n of childNodes) {
    if ((!type || (n.localName ?? n.nodeType) === type) && !isIgnorable(n)) ++i;
    if (i === index) return n;
  }
}

function getNextChildNodes(node, count) {
  const nodes = [node];
  while (--count) {
    node = getNextContentSibling(node);
    nodes.push(node);
  }
  return nodes;
}

function getNextContentSibling(s, type) {
  while ((s = s.nextSibling)) {
    if ((!type || (s.localName ?? s.nodeType) === type) && !isIgnorable(s))
      return s;
  }
}

function getPreviousContentSibling(s, type) {
  while ((s = s.previousSibling)) {
    if ((!type || (s.localName ?? s.nodeType) === type) && !isIgnorable(s))
      return s;
  }
}
