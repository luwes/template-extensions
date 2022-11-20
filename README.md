# Template Extensions

The goal of this library is to easily create HTML templates with dynamic parts
which is covered by the API's based on the
[Template Instantiation](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/Template-Instantiation.md)
and [DOM Parts](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/DOM-Parts.md)
proposals.

In addition it adds new API's to progressively enhance
existing elements (from SSR/SSG) with these dynamic parts.

## Examples

### Simple JS render example

```html
<template id="info">
  <section>
    <h1>{{name}}</h1>
    Email: <a href="mailto:{{email}}">{{email}}</a>
  </section>
</template>
<script>
  const params = { name: 'Ryosuke Niwa', email: 'rniwa@webkit.org' };
  const content = new TemplateInstance(info, params);
  document.body.append(content);
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

The template instance and DOM parts code is based on the great work of
[Dmitry Iv.](https://github.com/dy) and [Keith Cirkel](https://github.com/keithamus).

- https://github.com/dy/template-parts
- https://github.com/github/template-parts
- https://github.com/github/jtml
