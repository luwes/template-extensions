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

    //console.time('parse');
    const parts = parse(tmp);
    //console.timeEnd('parse');

    //console.time('parse2');
    processor.processCallback(tmp, parts, state);
    //console.timeEnd('parse2');

    // These selectors could potentially be served from the server or
    // saved per unique template to make assigning the DOM parts to
    // a new element faster. It will skip `parse` and `processCallback`.
    // They are xPath paths w/ a custom format for the parts information.
    //
    // format: xPath +nodesLength(textOffset)[attributeName]{expression}
    //
    //         ./div/h1 [class]{0} [data-a]{1} [data-b]{2}
    //         ./div/ul/li[6]/text() {10}
    //         ./div/div[3] +2(1){8}

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

function stringifyValue(value) {
  if (Array.isArray(value)) value = value.join('');
  else value += '';
  return value;
}

export function createParts(childNodes, selectors, state) {
  const parts = [];
  for (let selector of selectors) {
    // console.log(selector);
    const [path, ...exprDetails] = selector.split(' ');
    const element = getNodeFromXPath(childNodes, path);
    const attrLists = {};

    for (let i = 0; i < exprDetails.length; i++) {
      const exprDetail = exprDetails[i];
      const nodesLength = extractChars(exprDetail, '+', null, true) ?? 1;
      const attrName = extractChars(exprDetail, '[', ']');
      const textPos = extractChars(exprDetail, '(', ')', true) ?? 0;
      const expr = extractChars(exprDetail, '{', '}');
      let value = stringifyValue(state[expr]);

      if (!attrName) {
        let newNode = element;
        if (element.nodeType === 3) {
          // https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Whitespace
          if (!getPreviousContentSibling(element)) {
            element.data = element.data.trimStart();
          }
          element.data = element.data.replace(reWhitespace, ' ');
          if (
            value !== element.data &&
            value === element.data.slice(textPos, textPos + value.length)
          ) {
            newNode = element.splitText(textPos);
            newNode.splitText(value.length);
          }
          const part = new ChildNodePart(newNode.parentNode, [newNode]);
          parts.push([expr, part]);
        } else {
          let nodes = getNextChildNodes(element, nodesLength);
          const part = new ChildNodePart(nodes[0].parentNode, nodes);
          parts.push([expr, part]);
        }
      } else if (attrName) {
        const valueLength = ('' + value).length;
        const attr = element.attributes.getNamedItem(attrName);
        const startPos = textPos;
        const list = attrLists[path + attrName] ?? new AttrPartList();
        attrLists[path + attrName] = list;
        if (startPos > 0) {
          list.append(attr?.value.slice(('' + list).length, startPos));
        }

        const partValue = attr?.value.slice(startPos, startPos + valueLength);
        const part = new AttrPart(element, attrName, attr?.namespaceURI, partValue);
        parts.push([expr, part]);
        list.append(part);
        if (i === exprDetails.length - 1) {
          list.append(attr?.value.slice(('' + list).length));
        }
      }
    }
  }
  return parts;
}

function getNodeFromXPath(childNodes, xPath) {
  let target;
  let path = xPath.split('/');
  // todo: support id attribute selector for a fast path?
  // https://devhints.io/xpath
  path.shift();
  for (let query of path) {
    const index = extractChars(query, '[', ']', true) ?? 1;
    let type = query.split('[')[0];
    if (type === 'text()') type = 3;
    target = getContentChildNode(childNodes, index - 1, type);
    childNodes = target.childNodes;
  }
  return target;
}

function getContentChildNode(childNodes, index, type) {
  let i = -1;
  for (let n of childNodes) {
    if ((!type || (n.localName ?? n.nodeType) === type) && !isIgnorable(n)) ++i;
    if (i === index) return n;
  }
}

const reWhitespace = /[\t\n\r ]+/g;
const reAnyChars = /[^\t\n\r ]/;

export function createSelectors(parts) {
  const selectors = [];
  const grouping = {};
  let prevEndNode;

  for (const [expr, part] of parts) {
    let { attributeName, replacementNodes, previousSibling } = part;
    let len = replacementNodes?.length ?? 1;
    let textOffset = 0;
    let first;
    let node = part.element;
    if (node) {
      for (let str of part.list) {
        if (str === part) break;
        textOffset += ('' + str).length;
      }
    } else {
      node = replacementNodes[0];
      if (previousSibling?.nodeType === 3 && previousSibling != prevEndNode) {
        const hasContentPrev = !isIgnorable(previousSibling);
        if (hasContentPrev) first = true;

        // https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Whitespace
        let text = previousSibling.data?.replace(reWhitespace, ' ');
        const hasPrev = previousSibling.previousSibling;
        if (!hasPrev) text = text?.trimStart();
        textOffset += text?.length ?? 0;
      }
      prevEndNode = replacementNodes[replacementNodes.length - 1];
    }

    let path = createPath(node);
    if (first && path[0][1]) {
      path[0][1]--;
    }
    path = `/${path
      .map(([type, index]) => (!index ? type : `${type}[${index + 1}]`))
      .reverse()
      .join('/')}`;

    len = len !== 1 ? `+${len}` : '';
    textOffset = textOffset ? `(${textOffset})` : '';
    attributeName = attributeName ? `[${attributeName}]` : '';

    let index = grouping[path];
    let selector = index >= 0 ? selectors[index] : path;
    selector += ` ${len}${attributeName}${textOffset}{${expr}}`;
    if (index >= 0) selectors[index] = selector;
    else grouping[path] = selectors.push(selector) - 1;
    console.warn(selector);
  }

  return selectors;
}

function createPath(node) {
  const path = [];
  let { parentNode } = node;
  while (parentNode) {
    let i = 0;
    let { localName, nodeType } = node;
    while ((node = getPreviousContentSibling(node, localName ?? nodeType))) ++i;
    path.push([localName ?? 'text()', i]);
    node = parentNode;
    ({ parentNode } = node);
  }
  return path;
}

function extractChars(val, startDelimiter, endDelimiter, int) {
  val = val.split(startDelimiter)[1];
  if (val && endDelimiter) val = val.split(endDelimiter)[0];
  if (val && int) val = parseInt(val);
  return val;
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

function getNextChildNodes(node, count) {
  const nodes = [node];
  while (--count) {
    node = getNextContentSibling(node);
    nodes.push(node);
  }
  return nodes;
}

function getPreviousContentSibling(s, type) {
  while ((s = s.previousSibling)) {
    if ((!type || (s.localName ?? s.nodeType) === type) && !isIgnorable(s))
      return s;
  }
}

function getNextContentSibling(s, type) {
  while ((s = s.nextSibling)) {
    if ((!type || (s.localName ?? s.nodeType) === type) && !isIgnorable(s))
      return s;
  }
}

function isIgnorable(node) {
  return (
    node.nodeType === 8 || // A comment node
    (node.nodeType === 3 && !reAnyChars.test(node.data)) // a text node, all ws
  );
}
