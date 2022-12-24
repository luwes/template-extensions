# Template Extensions [![test](https://github.com/luwes/template-extensions/actions/workflows/ci.yml/badge.svg)](https://github.com/luwes/template-extensions/actions/workflows/ci.yml) [![size](https://img.shields.io/bundlephobia/minzip/template-extensions?label=size)](https://bundlephobia.com/result?p=template-extensions) [![npm version](https://img.shields.io/npm/v/template-extensions)](http://npmjs.org/template-extensions)

- Friendly HTML-based template syntax w/ efficient updates via DOM parts
- Extendable with template processors
- Clear HTML / JS separation
- Progressive enhancement (SSR/SSG)
- Based on [web component](https://github.com/WICG/webcomponents) spec proposals
  - [Template Instantiation](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/Template-Instantiation.md)
  - [DOM Parts](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/DOM-Parts.md)



## Examples

- [Counter](https://template-extensions.vercel.app/examples/)
- [TodoMVC](https://github.com/luwes/template-extensions-todomvc)
- [Create your own UI library (Lit like API)](./examples/interhtml.js)


## Install

- **npm**: `npm i template-extensions`  
- **cdn**: https://cdn.jsdelivr.net/npm/template-extensions  


## Usage

### Simple render

```html
<template id="info">
  <section>
    <h1>{{name}}</h1>
    Email: <a href="mailto:{{email}}">{{email}}</a>
  </section>
</template>
<script type="module">
  import { TemplateInstance } from 'template-extensions';

  const params = { name: 'Ryosuke Niwa', email: 'rniwa@webkit.org' };
  const content = new TemplateInstance(info, params);
  document.body.append(content);
  // later on
  content.update({ name: 'Ryosuke Niwa', email: 'rniwa@apple.com' });
</script>
```

### Simple hydrate ([Codesandbox](https://codesandbox.io/s/template-extensions-2v4m2y?file=/index.html))

Note that assigning a template instance to an existing element is only
concerned about the structure and content leading up to the expressions.
In the example below it's fine to skip the static text content of the paragraph
in the template.

```html
<div id="root">
  <section>
    <h1>Ryosuke Niwa</h1>
    <p>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
      tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
      veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
      commodo consequat. Duis aute irure dolor in reprehenderit in voluptate
      velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat
      cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id
      est laborum.
    </p>
    Email: <a href="mailto:rniwa@webkit.org">rniwa@webkit.org</a>
  </section>
</div>
<template id="info">
  <section>
    <h1>{{name}}</h1>
    <p></p>
    Email: <a href="mailto:{{email}}">{{email}}</a>
  </section>
</template>
<script type="module">
  import { AssignedTemplateInstance } from 'template-extensions';

  const params = { name: 'Ryosuke Niwa', email: 'rniwa@webkit.org' };
  const content = new AssignedTemplateInstance(root, info, params);
  // later on
  content.update({ name: 'Ryosuke Niwa', email: 'rniwa@apple.com' });
</script>
```

## Interfaces

```ts
export class AssignedTemplateInstance {
  constructor(
    container: HTMLElement | ShadowRoot,
    template: HTMLTemplateElement,
    params: unknown,
    processor?: TemplateTypeInit
  );
  update(params: unknown): void;
}

export class TemplateInstance extends DocumentFragment {
  constructor(
    template: HTMLTemplateElement,
    params: unknown,
    processor?: TemplateTypeInit
  );
  update(params: unknown): void;
}

type Expression = string;

type TemplateProcessCallback = (
  instance: TemplateInstance,
  parts: Iterable<[Expression, Part]>,
  params: unknown
) => void;

export type TemplateTypeInit = {
  processCallback: TemplateProcessCallback;
  createCallback?: TemplateProcessCallback;
};

export interface Part {
  value: string | null;
  toString(): string;
}

export class AttrPart implements Part {
  constructor(element: Element, attributeName: string, namespaceURI?: string);
  get element(): Element;
  get attributeName(): string;
  get attributeNamespace(): string | null;
  get value(): string | null;
  set value(value: string | null);
  get booleanValue(): boolean;
  set booleanValue(value: boolean);
  get list(): AttrPartList;
}

export class AttrPartList {
  get length(): number;
  item(index: number): AttrPart;
  append(...items): void;
  toString(): string;
}

export class ChildNodePart implements Part {
  constructor(parentNode: Element, nodes: Node[]);
  get parentNode(): Element;
  get value(): string;
  set value(string: string);
  get previousSibling(): ChildNode | null;
  get nextSibling(): ChildNode | null;
  replace(...nodes: Array<string | ChildNode>): void;
}

export class InnerTemplatePart extends ChildNodePart {
  constructor(parentNode: Element, template: HTMLTemplateElement);
  get directive(): string | null;
  get expression(): Expression | null;
}
```

## Credit

Big thanks to everyone who contributed to the Template Instantiation and
Dom Parts proposals.

The Template Instantiation and DOM parts code is based on the great work of
[Dmitry Iv.](https://github.com/dy) and [Keith Cirkel](https://github.com/keithamus).

- https://github.com/dy/template-parts
- https://github.com/github/template-parts
- https://github.com/github/jtml
