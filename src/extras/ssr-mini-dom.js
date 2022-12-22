export class Node {
  nodeValue;
  childNodes = [];

  constructor(nodeName, nodeType) {
    this.nodeName = nodeName;
    this.nodeType = nodeType;
  }

  cloneNode() {
    return new Node(this.nodeName, this.nodeType);
  }

  appendChild(node) {
    this.childNodes.push(node);
    return node;
  }

  removeChild(child) {
    const index = this.childNodes.indexOf(child);
    if (index >= 0) return this.childNodes.splice(index, 1)[0];
  }
}

export class Comment extends Node {
  constructor(nodeValue = '') {
    super('#comment', 8);
    this.nodeValue = nodeValue;
  }

  toString() {
    return `<!--${this.nodeValue}-->`;
  }
}

export class Element extends Node {
  attributes = {};

  constructor(nodeName) {
    super(nodeName, 1);
  }

  cloneNode() {
    const element = new Element(this.nodeName);
    for (let name in this.attributes) {
      element.attributes[name] = this.attributes[name];
    }
    return element;
  }

  getAttribute(name) {
    return this.attributes[name];
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  hasAttribute(name) {
    return name in this.attributes;
  }

  getAttributeNS(namespace, name) {
    return this.attributes[name];
  }

  setAttributeNS(namespace, name, value) {
    this.attributes[name] = value;
  }

  removeAttributeNS(namespace, name) {
    delete this.attributes[name];
  }

  hasAttributeNS(namespace, name) {
    return name in this.attributes;
  }
}
