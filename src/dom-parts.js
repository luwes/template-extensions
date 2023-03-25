/**
 * Adapted from https://github.com/dy/template-parts
 * ISC License (ISC)
 * Copyright 2021 Dmitry Iv.
 */

/**
 * DOM Part API
 * https://github.com/WICG/webcomponents/blob/gh-pages/proposals/DOM-Parts.md
 *
 * Divergence from the proposal:
 *   - Renamed AttributePart to AttrPart to match the existing class `Attr`.
 *   - Renamed AttributePartGroup to AttrPartList as a group feels not ordered
 *     while this collection should maintain its order. Also closer to DOMTokenList.
 *   - A ChildNodePartGroup would make things unnecessarily difficult in this
 *     implementation. Instead an empty text node keeps track of the ChildNodePart's
 *     location in the child nodelist if needed.
 *   - No concept of part.commit() and batching.
 */

const FRAGMENT = 11;

export class Part {
  toString() {
    return this.value;
  }
}

export class AttrPartList {
  #items = [];

  [Symbol.iterator]() {
    return this.#items.values();
  }

  get length() {
    return this.#items.length;
  }

  item(index) {
    return this.#items[index];
  }

  append(...items) {
    for (const item of items) {
      if (item instanceof AttrPart) {
        AttrPartList.attrPartToList.set(item, this);
      }
      this.#items.push(item);
    }
  }

  splice(...args) {
    return this.#items.splice(...args);
  }

  toString() {
    return this.#items.join('');
  }
}

// Define as an external static so esbuild doesn't add unnecessary transforms
// see https://github.com/evanw/esbuild/issues/2416
AttrPartList.attrPartToList = new WeakMap();

export class AttrPart extends Part {
  #value = '';
  #element;
  #attributeName;
  #namespaceURI;

  constructor(element, attributeName, namespaceURI, value) {
    super();
    this.#element = element;
    this.#attributeName = attributeName;
    this.#namespaceURI = namespaceURI;

    if (value != null) this.#value = value;
  }

  get list() {
    return AttrPartList.attrPartToList.get(this);
  }

  get attributeName() {
    return this.#attributeName;
  }

  get attributeNamespace() {
    return this.#namespaceURI;
  }

  get element() {
    return this.#element;
  }

  get value() {
    return this.#value;
  }

  set value(newValue) {
    if (this.#value === newValue) return; // save unnecessary call
    this.#value = newValue;

    if (!this.list || this.list.length === 1) {
      // fully templatized
      if (newValue == null) {
        this.#element.removeAttributeNS(
          this.#namespaceURI,
          this.#attributeName
        );
      } else {
        this.#element.setAttributeNS(
          this.#namespaceURI,
          this.#attributeName,
          newValue
        );
      }
    } else {
      this.#element.setAttributeNS(
        this.#namespaceURI,
        this.#attributeName,
        this.list
      );
    }
  }

  get booleanValue() {
    return this.#element.hasAttributeNS(
      this.#namespaceURI,
      this.#attributeName
    );
  }

  set booleanValue(value) {
    if (!this.list || this.list.length === 1) this.value = value ? '' : null;
    else if (!globalThis.PROD) {
      throw new Error('Value is not fully templatized');
    }
  }
}

export class ChildNodePart extends Part {
  #parentNode;
  #nodes;

  constructor(parentNode, nodes) {
    super();
    this.#parentNode = parentNode;
    if (nodes) this.#nodes = [...nodes];
    else this.#nodes = [new Text()];
  }

  get replacementNodes() {
    return this.#nodes;
  }

  get parentNode() {
    return this.#parentNode;
  }

  get nextSibling() {
    return this.#nodes[this.#nodes.length - 1].nextSibling;
  }

  get previousSibling() {
    return this.#nodes[0].previousSibling;
  }

  // FIXME: not sure why do we need string serialization here? Just because parent class has type DOMString?
  get value() {
    return this.#nodes.map((node) => node.textContent).join('');
  }

  set value(newValue) {
    this.replace(newValue);
  }

  replace(...nodes) {
    // replace current nodes with new nodes.
    nodes = nodes
      .flat()
      .flatMap((node) =>
        node == null
          ? [new Text()]
          : node.forEach
          ? [...node]
          : node.nodeType === FRAGMENT
          ? [...node.childNodes]
          : node.nodeType
          ? [node]
          : [new Text(node)]
      );

    if (!nodes.length) nodes.push(new Text(''));

    this.#nodes = swapdom(
      this.#nodes[0].parentNode,
      this.#nodes,
      nodes,
      this.nextSibling
    );
  }

  replaceHTML(html) {
    const fragment = this.parentNode.cloneNode();
    fragment.innerHTML = html;
    this.replace(fragment.childNodes);
  }
}

export class InnerTemplatePart extends ChildNodePart {
  constructor(parentNode, template, nodes) {
    super(parentNode, nodes);

    let directive =
      template.getAttribute('directive') ?? template.getAttribute('type');

    let expression =
      template.getAttribute('expression') ?? template.getAttribute(directive);

    if (expression?.startsWith('{{'))
      expression = expression.trim().slice(2, -2).trim();

    this.expression = expression;
    this.template = template;
    this.directive = directive;
  }
}

function swapdom(parent, a, b, end = null) {
  let i = 0,
    cur,
    next,
    bi,
    n = b.length,
    m = a.length;

  // skip head/tail
  while (i < n && i < m && a[i] == b[i]) i++;
  while (i < n && i < m && b[n - 1] == a[m - 1]) end = b[(--m, --n)];

  // append/prepend/trim shortcuts
  if (i == m) while (i < n) parent.insertBefore(b[i++], end);
  if (i == n) while (i < m) parent.removeChild(a[i++]);
  else {
    cur = a[i];

    while (i < n) {
      (bi = b[i++]), (next = cur ? cur.nextSibling : end);

      // skip
      if (cur == bi) cur = next;
      // swap / replace
      else if (i < n && b[i] == next)
        parent.replaceChild(bi, cur), (cur = next);
      // insert
      else parent.insertBefore(bi, cur);
    }

    // remove tail
    while (cur != end)
      (next = cur.nextSibling), parent.removeChild(cur), (cur = next);
  }

  return b;
}
