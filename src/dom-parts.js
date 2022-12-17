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
  static attrPartToList = new WeakMap();
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
    const normalisedNodes = nodes
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

    if (!normalisedNodes.length) {
      normalisedNodes.push(new Text(''));
    }

    this.#nodes[0].before(...normalisedNodes);

    for (const oldNode of this.#nodes) {
      if (!normalisedNodes.includes(oldNode)) {
        oldNode.remove();
      }
    }

    this.#nodes = normalisedNodes;
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
    this.template = template;
  }

  get directive() {
    return (
      this.template.getAttribute('directive') ??
      this.template.getAttribute('type')
    );
  }

  get expression() {
    return (
      this.template.getAttribute('expression') ??
      this.template.getAttribute(this.directive)
    );
  }
}
