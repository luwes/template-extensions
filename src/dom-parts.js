const FRAGMENT = 11;

export class Part {
  constructor(setter) {
    this.setter = setter;
  }
  toString() {
    return this.value;
  }
}

export class AttributePart extends Part {
  #value = '';
  get attributeName() {
    return this.setter.attr.name;
  }
  get attributeNamespace() {
    return this.setter.attr.namespaceURI;
  }
  get element() {
    return this.setter.element;
  }
  get value() {
    return this.#value;
  }
  set value(newValue) {
    if (this.#value === newValue) return; // save unnecessary call
    this.#value = newValue;
    const { attr, element, parts } = this.setter;
    if (parts.length === 1) {
      // fully templatized
      if (newValue == null)
        element.removeAttributeNS(attr.namespaceURI, attr.name);
      else element.setAttributeNS(attr.namespaceURI, attr.name, newValue);
    } else element.setAttributeNS(attr.namespaceURI, attr.name, parts.join(''));
  }
  get booleanValue() {
    return this.setter.element.hasAttributeNS(
      this.attributeNamespace,
      this.setter.attr.name
    );
  }
  set booleanValue(value) {
    if (this.setter.parts.length === 1) this.value = value ? '' : null;
    else throw new DOMException('Value is not fully templatized');
  }
}

export class ChildNodePart extends Part {
  #nodes = [this.setter.parts?.[0] ?? new Text()];
  get replacementNodes() {
    return this.#nodes;
  }
  get parentNode() {
    return this.setter.parentNode;
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
    if (!normalisedNodes.length) normalisedNodes.push(new Text(''));
    this.#nodes[0].before(...normalisedNodes);
    for (const oldNode of this.#nodes) {
      if (!normalisedNodes.includes(oldNode)) oldNode.remove();
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
  directive;
  constructor(setter, template) {
    let directive =
      template.getAttribute('directive') || template.getAttribute('type');
    let expression =
      template.getAttribute('expression') ||
      template.getAttribute(directive) ||
      '';
    if (expression.startsWith('{{'))
      expression = expression.trim().slice(2, -2).trim();

    super(setter);

    this.expression = expression;
    this.template = template;
    this.directive = directive;
  }
}
