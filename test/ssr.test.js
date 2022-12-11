import { assert } from '@open-wc/testing';
import {
  renderToString,
  render,
  TemplateInstance,
  AttrPart,
  ChildNodePart,
  InnerTemplatePart,
} from '../src/extras/ssr.js';

// patch global with the SSR DOM part versions
// this is required if you want to use 1 template processor for client and server
Object.assign(globalThis, {
  TemplateInstance,
  AttrPart,
  ChildNodePart,
  InnerTemplatePart,
});

const test = it;
const is = assert.deepEqual;

test('create: applies data to templated text nodes', () => {
  is(renderToString(`{{x}}`, { x: 'Hello world' }), `Hello world`);
});

test('create: can render into partial text nodes', () => {
  is(renderToString(`Hello {{x}}!`, { x: 'world' }), `Hello world!`);
});

test('create: can render nested text nodes', () => {
  is(
    renderToString(`<div><div>Hello {{x}}!</div></div>`, { x: 'world' }),
    `<div><div>Hello world!</div></div>`
  );
});

test('create: applies data to templated attributes', () => {
  is(
    renderToString(`<div class="{{y}}"></div>`, { y: 'foo' }),
    `<div class="foo"></div>`
  );
});

test('create: can render into partial attribute nodes', () => {
  is(
    renderToString(`<div class="my-{{y}}-state"></div>`, { y: 'foo' }),
    `<div class="my-foo-state"></div>`
  );
});

test('create: can render into many values', () => {
  is(
    renderToString(`<div class="my-{{x}}-state {{y}}">{{z}}</div>`, {
      x: 'foo',
      y: 'bar',
      z: 'baz',
    }),
    `<div class="my-foo-state bar">baz</div>`
  );
});

test('update: performs noop when update() is called with partial args', () => {
  const instance = render(
    `<div class="my-{{ x }}-state {{ y }}">{{ z }}</div>`,
    {
      x: 'foo',
      y: 'bar',
      z: 'baz',
    }
  );

  is(String(instance), `<div class="my-foo-state bar">baz</div>`);

  instance.update({ y: 'boo' });
  is(String(instance), `<div class="my-foo-state boo">baz</div>`);
});

test('update: performs noop when update() is called with partial args', () => {
  const instance = render(
    `<div class="my-{{ x }}-state {{ y }}">{{ z }}</div>`,
    {
      x: 'foo',
      y: 'bar',
      z: 'baz',
    }
  );

  is(String(instance), `<div class="my-foo-state bar">baz</div>`);

  instance.update();
  is(String(instance), `<div class="my-foo-state bar">baz</div>`);
});

test('innerTemplatePart: full form', () => {
  let arr = [];
  let instance;

  is(
    renderToString(
      `<template directive="x" expression="x">{{ x }}</template>`,
      { x: ['x', 'y'] },
      {
        processCallback(insta, parts, state) {
          instance = insta;
          for (const [expression, part] of parts) {
            arr.push(part.directive);
            arr.push(part.expression);
            const nodes = state[expression].map((item) => {
              //console.log(part.template);
              return new TemplateInstance(part.template, { x: item });
            });
            //console.log(nodes);
            part.replace(nodes);
          }
        },
      }
    ),
    'xy'
  );
  is(arr, ['x', 'x']);

  instance.update({ x: ['y', 'z', 'w'] });
  is(String(instance), 'yzw');
});

test('InnerTemplatePart: foreach directive', async () => {
  const processor = {
    processCallback(tpl, parts, state) {
      for (const [expression, part] of parts) {
        if (part instanceof InnerTemplatePart) {
          const nodes = (state[expression] ?? []).map((item) => {
            return new TemplateInstance(part.template, item, processor);
          });
          part.replace(nodes);
        } else {
          part.value = state[expression];
        }
      }
    },
  };

  const instance = render(
    `<ul><template directive="foreach" expression="x"><li>{{title}}</li></template></ul>`,
    { x: [{ title: 'a' }, { title: 'b' }] },
    processor
  );

  is(String(instance), '<ul><li>a</li><li>b</li></ul>');
});
