export class Node {
  nodeType;
  nodeName;
  nodeValue;
  childNodes = [];

  cloneNode() {
    const node = new Node();
    node.nodeType = this.nodeType;
    node.nodeName = this.nodeName;
    return node;
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
  nodeType = 8;
  nodeName = '#comment';
}

export class Element extends Node {
  nodeType = 1;
  attributes = {};

  cloneNode() {
    const element = new Element();
    element.nodeType = this.nodeType;
    element.nodeName = this.nodeName;
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

  getAttributeNS(namespace, name) {
    return this.attributes[name];
  }

  setAttributeNS(namespace, name, value) {
    this.attributes[name] = value;
  }

  removeAttributeNS(namespace, name) {
    delete this.attributes[name];
  }
}
