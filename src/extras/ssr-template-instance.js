import { defaultProcessor, TemplateInstance } from '../template-instance.js';
import { renderTree } from './tree-render.js';
import { Element, Comment } from './ssr-mini-dom.js';
import {
  AttrPart,
  AttrPartList,
  ChildNodePart,
  InnerTemplatePart,
} from './ssr-dom-parts.js';

TemplateInstance.prototype.cached = function (template) {
  const { parts, childNodes, attributes } = cloneTemplate(template);

  Object.defineProperties(this, {
    nodeName: { get: () => '#document-fragment' },
    childNodes: { get: () => childNodes },
    attributes: { get: () => attributes },
  });

  return parts;
};

TemplateInstance.prototype.toString = function () {
  return renderTree(this);
};

export { defaultProcessor, TemplateInstance };

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
    if (node instanceof Comment) {
      const comment = new Comment();
      comment.nodeValue = node.nodeValue;
      return comment;
    }

    if (node instanceof Element) {
      const element = new Element();
      element.nodeName = node.nodeName;

      for (let name in node.attributes) {
        element.attributes[name] = cloneNode(node.attributes[name], element);
      }

      for (let child of node.childNodes) {
        element.childNodes.push(cloneNode(child, element));
      }

      return element;
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
      const [, part] = parts.find(([, p]) => p.replacementNodes === node) ?? [];

      if (part instanceof InnerTemplatePart) {
        return replacePart(
          part,
          new InnerTemplatePart(parent, part.template, [])
        ).replacementNodes;
      }

      if (part instanceof ChildNodePart) {
        return replacePart(part, new ChildNodePart(parent, []))
          .replacementNodes;
      }
    }

    return node;
  };

  return {
    parts,
    ...cloneNode(template),
  };
}
