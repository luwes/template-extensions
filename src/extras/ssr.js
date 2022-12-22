import { createTag } from './htmltag.js';
import { TreeBuilder } from './tree-builder.js';
import { Element, Comment } from './ssr-mini-dom.js';
import {
  defaultProcessor,
  TemplateInstance,
  AttrPart,
  AttrPartList,
  ChildNodePart,
  InnerTemplatePart,
} from '../index.js';

// Patch the same class references so they can be used in the client
// and server processors.

TemplateInstance.prototype.toString = function () {
  return renderTree(this);
};

TemplateInstance.prototype.cached = function (template) {
  const { parts, childNodes, attributes } = cloneTemplate(template);

  Object.defineProperties(this, {
    nodeName: { get: () => '#document-fragment' },
    childNodes: { get: () => childNodes },
    attributes: { get: () => attributes },
  });

  return parts;
};

// It's a lot easier to patch the replace function and work with nested arrays
// to hold the child fragments than to polyfill the DOM and get it working
// with the original replace method.

ChildNodePart.prototype.replace = function (...nodes) {
  const normalisedNodes = nodes
    .flat()
    .flatMap((node) => (node == null ? [] : node.forEach ? [...node] : [node]));

  this.replacementNodes.length = 0;
  this.replacementNodes.push(...normalisedNodes);
};


export function render(html, state, processor = defaultProcessor) {
  const mixed = html.split(/\{\{\s*([^{}]+?)\s*\}\}/);
  const statics = [];
  const expressions = [];

  for (let i = 0; i < mixed.length; i += 2) {
    statics.push(mixed[i]);
    if (i + 1 < mixed.length) {
      expressions.push(mixed[i + 1]);
    }
  }

  const treeBuilder = new TreeBuilder(expressions);
  const parse = createTag(treeBuilder);
  statics.raw = statics;

  const template = parse(statics, ...expressions.map((e) => state[e]));
  const templateInstance = new TemplateInstance(template, state, processor);
  return templateInstance;
}

export function renderToString(html, state, processor = defaultProcessor) {
  return renderTree(render(html, state, processor));
}

export function renderTree(node) {
  let { nodeName, attributes, childNodes } = node;

  if (nodeName === '#document-fragment') {
    return childNodes.flatMap(renderTree).join('');
  }

  if (attributes) {
    attributes = toAttributes(attributes);

    let pairs = [];
    for (let name in attributes) {
      const attrName = esc(name);
      const attrValue = esc(attributes[name]);
      pairs.push(`${attrName}${attrValue === '' ? '' : `="${attrValue}"`}`);
    }

    let open = nodeName;
    if (pairs.length > 0) {
      open += ' ' + pairs.join(' ');
    }

    const closeTag = nodeName == '!DOCTYPE' ? '' : `</${nodeName}>`;
    return `<${open}>${childNodes.flatMap(renderTree).join('')}${closeTag}`;
  }

  if (Array.isArray(node)) {
    return node.map(renderTree).join('');
  }

  return node;
}

const DOM_PROPS = {
  className: 'class',
  htmlFor: 'for',
  httpEquiv: 'http-equiv',
};

// escape an attribute
let esc = (str) => String(str).replace(/[&<>"']/g, (s) => `&${map[s]};`);
let map = { '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot', "'": 'apos' };

function toAttributes(props) {
  let attr = {};
  Object.keys(props).forEach(function (key) {
    let name = typeof DOM_PROPS[key] === 'string' ? DOM_PROPS[key] : key;
    let val = props[key];
    attr[name] = val === true ? '' : val;
  });
  return attr;
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
    if (node instanceof Comment) {
      return new Comment(node.nodeValue);
    }

    if (node instanceof Element) {
      const element = new Element(node.nodeName);

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

export {
  defaultProcessor,
  TemplateInstance,
  AttrPart,
  AttrPartList,
  ChildNodePart,
  InnerTemplatePart,
};
