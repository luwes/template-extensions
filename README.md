# Template Extensions [![size](https://img.shields.io/bundlephobia/minzip/template-extensions?label=size)](https://bundlephobia.com/result?p=template-extensions) [![npm version](https://img.shields.io/npm/v/template-extensions)](http://npmjs.org/template-extensions)

- Friendly HTML-based template syntax w/ efficient updates via DOM parts
- Custom syntax with template processors
- Clear HTML / JS separation
- Progressive enhancement (SSR/SSG)
- Based on [web component](https://github.com/WICG/webcomponents) spec proposals
  - [Template Instantiation](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/Template-Instantiation.md)
  - [DOM Parts](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/DOM-Parts.md)



## Examples

- [Counter](https://template-extensions.vercel.app/examples/)
- [Media Chrome Themes](https://github.com/muxinc/media-chrome/blob/main/src/js/media-theme-element.js) 
in [Mux Player](https://github.com/muxinc/elements/blob/main/packages/mux-player/src/media-theme-mux.html) 
([demo](https://stream.new/v/DVBhwqkhxkOiLRjUAYJS6mCBJSuC00tB4iWjJmEofJoo))
- [TodoMVC with SSR and hydration](https://github.com/luwes/template-extensions-todomvc) 
([demo](https://template-extensions-todomvc.pages.dev/))
- [Create your own UI library (Lit like API)](./examples/interhtml.js) 
([demo](https://template-extensions.vercel.app/examples/todos.html))


## Install

- **npm**: `npm i template-extensions`  
- **cdn**: https://cdn.jsdelivr.net/npm/template-extensions  

## Basics

```html
<template id="tpl">
  <div class="foo {{y}}">{{x}} world</div>
</template>
```

When passing the above template to the `TemplateInstance` constructor
2 DOM parts are created that represent `{{x}}` and `{{y}}` in the HTML. 
The second constructor argument is the state object (or params) that will fill 
in the values of the DOM parts.

```js
import { TemplateInstance } from 'template-extensions';

const tplInst = new TemplateInstance(tpl, { x: 'Hello', y: 'bar'} /*, processor*/);
document.append(tplInst);
```

A `TemplateInstance` instance is a subclass of `DocumentFragment` so it can
be appended directly to the DOM. In addition it gets a new `update(params)`
method that can be called to efficiently update the DOM parts.

An optional third argument is de [template processor](#template-processor). 
This hook allows you to handle each expression and DOM part in a specialized
way. It allows you to write your own template language syntax, think Vue. 
Everything between the curly braces can be parsed and evaluated as you see fit.

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

## Template Processor

### Default processor

The default processor looks a bit like the function below. Each time 
`templateInstance.update(params)` is called this function runs and
iterates through each DOM part and evaluates what needs to happen.

```js
function processCallback(instance, parts, params) {
  if (!params) return;
  for (const [expression, part] of parts) {
    if (expression in params) {
      const value = params[expression];
      if (
        typeof value === 'boolean' &&
        part instanceof AttrPart &&
        typeof part.element[part.attributeName] === 'boolean'
      ) {
        part.booleanValue = value;
      } else if (typeof value === 'function' && part instanceof AttrPart) {
        part.value = undefined;
        part.element[part.attributeName] = value;
      } else {
        part.value = value;
      }
    }
  }
}
```

The default processor handles property identity (i.e. `part.value = params[expression]`),
boolean attribute or function.

```js
const el = document.createElement('template')
el.innerHTML = `<div x={{x}} hidden={{hidden}} onclick={{onclick}}></div>`

const tpl = new TemplateInstance(el, { x: 'Hello', hidden: false, onclick: () => {} })
el.getAttribute('x') // 'Hello'
el.hasAttribute('hidden') // false
el.onclick // function
```


## InnerTemplatePart

The [`InnerTemplatePart`](https://github.com/WICG/webcomponents/blob/gh-pages/proposals/Template-Instantiation.md#33-conditionals-and-loops-using-nested-templates) 
enables you to write conditionals and loops in your templates. The inner templates
are expected to have a `directive` and `expression` attribute.

### if

```html
<template>
  <div>
    <template directive="if" expression="isActive">{{x}}</template>
  </div>
</template>
```

### foreach

```html
<template>
  <div>
    <template directive="foreach" expression="items">
      <li class={{class}} data-value={{value}}>{{label}}</li>
    </template>
  </div>
</template>
```

```js
export const processor = {
  processCallback(instance, parts, params) {
    if (!params) return;
    for (const [expression, part] of parts) {
      if (part instanceof InnerTemplatePart) {
        switch (part.directive) {
          case 'foreach': {
            part.replace((params[expression] ?? []).map(item => {
              return new TemplateInstance(part.template, item, processor);
            }));
            break;
          }
        }
        continue;
      }
      // handle rest of expressions...
      if (expression in params) {
    }
  }
};
```


## `renderToString(html, params, processor=defaultProcessor)`

Renders HTML with expressions and inner templates to a string. No JSDOM required.  
It's possible to use the same template processor for client and server.

```js
import { renderToString } from 'template-extensions/src/extras/ssr.js';

console.log(renderToString(`<div class="my-{{x}}-state {{y}}">{{z}}</div>`, {
  x: 'foo',
  y: 'bar',
  z: 'baz',
}))
// <div class="my-foo-state bar">baz</div>
```


## Credit

Big thanks to everyone who contributed to the Template Instantiation and
Dom Parts proposals.

The Template Instantiation and DOM parts code is based on the great work of
[Keith Cirkel](https://github.com/keithamus) and [Dmitry Iv.](https://github.com/dy).

- https://github.com/github/template-parts
- https://github.com/github/jtml
- https://github.com/dy/template-parts


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
