import { defaultProcessor } from '../template-instance.js';
import { renderTree } from './tree-render.js';
import {
  AttrPart,
  AttrPartList,
  ChildNodePart,
  InnerTemplatePart,
} from './ssr-dom-parts.js';

export class TemplateInstance {
  #processor;

  constructor(template, state, processor = defaultProcessor) {
    Object.assign(this, cloneTemplate(template));

    this.tag = '#document-fragment';

    this.#processor = processor;
    processor.createCallback?.(this, this.parts, state);
    processor.processCallback(this, this.parts, state);
  }

  update(state) {
    this.#processor.processCallback(this, this.parts, state);
  }

  toString() {
    return renderTree(this);
  }
}

// The template has to be cloned because InnerTemplatePart's can be used
// multiple times like a foreach directive. The DOM parts have to be unique
// per iteration or they'll have the same value in each iteration.
function cloneTemplate(template) {
  const parts = [...template.parts];

  const replacePart = (part, clonedPart) => {
    const index = parts.findIndex(([, p]) => p === part);
    parts[index] = [parts[index][0], clonedPart];
    return clonedPart;
  };

  const cloneNode = (node, parent) => {
    if (isPlainObject(node)) {
      const result = {
        tag: node.tag,
        attributes: {},
        children: [],
      };

      for (let name in node.attributes) {
        result.attributes[name] = cloneNode(node.attributes[name], result);
      }

      for (let child of node.children) {
        result.children.push(cloneNode(child, result));
      }

      return result;
    }

    if (node instanceof AttrPartList) {
      const list = new AttrPartList();
      for (let item of node) {
        if (item instanceof AttrPart) {
          list.append(
            replacePart(item, new AttrPart(parent, item.attributeName))
          );
        } else {
          list.append(item);
        }
      }
      return list;
    }

    if (Array.isArray(node)) {
      const [, part] = parts.find(([, p]) => p.replacementNodes === node);

      if (part instanceof InnerTemplatePart) {
        return replacePart(part, new InnerTemplatePart(parent, part.template))
          .replacementNodes;
      }

      if (part instanceof ChildNodePart) {
        return replacePart(part, new ChildNodePart(parent)).replacementNodes;
      }
    }

    return node;
  };

  return {
    parts,
    ...cloneNode(template),
  };
}

function isPlainObject(value) {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return (
    (prototype === null ||
      prototype === Object.prototype ||
      Object.getPrototypeOf(prototype) === null) &&
    !(Symbol.toStringTag in value) &&
    !(Symbol.iterator in value)
  );
}
