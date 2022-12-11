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
      // heads up! this is a SSR AttrPart
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
        delete this.#element.attributes[this.#attributeName];
      } else {
        this.#element.attributes[this.#attributeName] = newValue;
      }
    } else {
      this.#element.attributes[this.#attributeName] = String(this.list);
    }
  }

  get booleanValue() {
    return !!this.#element.attributes[this.#attributeName];
  }

  set booleanValue(value) {
    if (!this.list || this.list.length === 1) this.value = value ? '' : null;
    else if (!globalThis.PROD) {
      throw new DOMException('Value is not fully templatized');
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
    else this.#nodes = [];
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
        node == null ? [] : node.forEach ? [...node] : [node]
      );

    this.#nodes.length = 0;
    this.#nodes.push(...normalisedNodes);
  }
}

export class InnerTemplatePart extends ChildNodePart {
  constructor(parentNode, template, nodes) {
    super(parentNode, nodes);
    this.template = template;
  }

  get directive() {
    return this.template.attributes.directive ?? this.template.attributes.type;
  }

  get expression() {
    return (
      this.template.attributes.expression ??
      this.template.attributes[this.directive]
    );
  }
}
