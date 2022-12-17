import { ChildNodePart } from '../dom-parts.js';

// It's a lot easier to patch the replace function and work with nested arrays
// to hold the child fragments than to polyfill the DOM and get it working
// with the original replace method.
//
ChildNodePart.prototype.replace = function (...nodes) {
  // replace current nodes with new nodes.
  const normalisedNodes = nodes
    .flat()
    .flatMap((node) => (node == null ? [] : node.forEach ? [...node] : [node]));

  this.replacementNodes.length = 0;
  this.replacementNodes.push(...normalisedNodes);
};

export {
  Part,
  AttrPartList,
  AttrPart,
  ChildNodePart,
  InnerTemplatePart,
} from '../dom-parts.js';
