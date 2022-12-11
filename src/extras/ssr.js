import { createTag } from './htmltag.js';
import { TreeBuilder } from './tree-builder.js';
import { defaultProcessor } from '../template-instance.js';
import { TemplateInstance } from './ssr-template-instance.js';

export { TemplateInstance };
export { renderTree } from './tree-render.js';
export * from './ssr-dom-parts.js';

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
  return String(render(html, state, processor));
}
