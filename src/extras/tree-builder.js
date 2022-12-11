import {
  AttrPart,
  AttrPartList,
  ChildNodePart,
  InnerTemplatePart,
} from './ssr-dom-parts.js';

class Interpolation {
  constructor(value) {
    this.value = value;
  }
  toString() {
    return this.value;
  }
}

function isInterpolation(x) {
  return x instanceof Interpolation;
}

export class TreeBuilder {
  constructor(expressions) {
    this.expressions = [...expressions];
  }

  createRoot() {
    this.current = this.createElement('#document-fragment');
    this.current.parts = [];
    return this.current;
  }

  finishRoot(root) {
    return root;
  }

  createElement(tag) {
    return { tag, attributes: {}, children: [] };
  }

  finishElement(node) {
    if (node === this.current) {
      this.current = node.previous;
      delete node.previous;
    }
    return node;
  }

  createComment(text) {
    return { comment: text };
  }

  appendChild(parent, child) {
    if (this.current !== parent && parent.attributes.directive) {
      const current = this.current;
      this.current = parent;
      this.current.previous = current;
      this.current.parts ||= [];
    }

    if (isInterpolation(child)) {
      const part = new ChildNodePart(parent);
      this.current.parts.push([this.expressions.shift(), part]);
      parent.children.push(part.replacementNodes);
      return;
    }

    if (
      child?.tag === 'template' &&
      child.attributes.directive &&
      child.attributes.expression
    ) {
      const part = new InnerTemplatePart(parent, child);
      this.current.parts.push([part.expression, part]);
      parent.children.push(part.replacementNodes);
      return;
    }

    parent.children.push(child);
  }

  mapValue(v) {
    return new Interpolation(v);
  }

  setAttribute(node, name, value) {
    if (Array.isArray(value)) {
      const list = new AttrPartList();
      for (let i = 0; i < value.length; ++i) {
        if (isInterpolation(value[i])) {
          const part = new AttrPart(node, name);
          list.append(part);
          this.current.parts.push([this.expressions.shift(), part]);
        } else {
          list.append(value[i]);
        }
      }
      node.attributes[name] = list;
      return;
    }

    node.attributes[name] = value === undefined ? true : value;
  }

  setAttributes(node, map) {
    for (let key in map) {
      this.setAttribute(node, key, map[key]);
    }
  }

  setAttributeParts(node, name, parts) {
    parts = parts.filter(val => val != '');
    this.setAttribute(node, name, parts);
  }
}
