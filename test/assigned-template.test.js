/* Adapted from https://github.com/dy/template-parts - ISC - Dmitry Iv. */

import { assert, fixture } from '@open-wc/testing';
import { AssignedTemplateInstance } from '../src/assigned-template.js';
import { AttrPart } from '../src/dom-parts.js';

const test = it;
const is = assert.deepEqual;
const any = (a, b) => assert.include(b, a);

test('create: applies data to templated text nodes', async () => {
  const root = await fixture(`<div>Hello world</div>`);
  const template = document.createElement('template');
  const originalHTML = `{{x}}`;
  template.innerHTML = originalHTML;
  new AssignedTemplateInstance(root, template, { x: 'Hello world' });
  is(template.innerHTML, originalHTML);
  is(root.innerHTML, `Hello world`);
});

test('create: can assign into partial text nodes', async () => {
  const root = await fixture(`<div>Hello world!</div>`);
  const template = document.createElement('template');
  const originalHTML = `Hello {{x}}!`;
  template.innerHTML = originalHTML;
  const instance = new AssignedTemplateInstance(root, template, { x: 'world' });
  instance.update({ x: 'Mars' });
  is(template.innerHTML, originalHTML);
  is(root.innerHTML, `Hello Mars!`);
});

test('create: can render nested text nodes', async () => {
  const root = await fixture(`<main><div><div>Hello world!</div></div></main>`);
  const template = document.createElement('template');
  const originalHTML = '<div><div>Hello {{x}}!</div></div>';
  template.innerHTML = originalHTML;
  const instance = new AssignedTemplateInstance(root, template, { x: 'world' });
  is(root.innerHTML, `<div><div>Hello world!</div></div>`);
  instance.update({ x: 'Mars' });
  is(template.innerHTML, originalHTML);
  is(root.innerHTML, `<div><div>Hello Mars!</div></div>`);
});

test('create: applies data to templated attributes', async () => {
  const root = await fixture(`<main><div class="foo"></div></main>`);
  const template = document.createElement('template');
  const originalHTML = `<div class="{{y}}"></div>`;
  template.innerHTML = originalHTML;
  const instance = new AssignedTemplateInstance(root, template, { y: 'foo' });
  is(root.innerHTML, `<div class="foo"></div>`);
  instance.update({ y: 'bar' });
  is(template.innerHTML, originalHTML);
  is(root.innerHTML, `<div class="bar"></div>`);
});

test('create: can render into partial attribute nodes', async () => {
  const root = await fixture(`<main><div class="my-foo-state"></div></main>`);
  const template = document.createElement('template');
  const originalHTML = `<div class="my-{{y}}-state"></div>`;
  template.innerHTML = originalHTML;
  const instance = new AssignedTemplateInstance(root, template, { y: 'foo' });
  is(template.innerHTML, originalHTML);
  is(root.innerHTML, `<div class="my-foo-state"></div>`);
  instance.update({ y: 'bar' });
  is(root.innerHTML, `<div class="my-bar-state"></div>`);
});

test('create: can render into many values', async () => {
  const root = await fixture(`<main><div class="my-foo-state bar">baz</div></main>`);
  const template = document.createElement('template');
  const originalHTML = `<div class="my-{{x}}-state {{y}}">{{z}}</div>`;
  template.innerHTML = originalHTML;
  const instance = new AssignedTemplateInstance(root, template, {
    x: 'foo',
    y: 'bar',
    z: 'baz',
  });
  is(template.innerHTML, originalHTML);
  is(root.innerHTML, `<div class="my-foo-state bar">baz</div>`);
  instance.update({
    x: 'jim',
    y: 'bill',
    z: 'frank',
  });
  is(root.innerHTML, `<div class="my-jim-state bill">frank</div>`);
});

test('nodes: should preserve spaces', async () => {
  const root = await fixture(`<main><span>10</span> items left</main>`);
  let tpl = document.createElement('template');
  tpl.innerHTML = `<span>{{ count }}</span> {{ text }} left`;
  let instance = new AssignedTemplateInstance(root, tpl, { count: 10, text: 'items' });
  is(root.innerHTML, `<span>10</span> items left`);
  instance.update({ count: 20, text: 'golf balls' });
  is(root.innerHTML, `<span>20</span> golf balls left`);
});

test('nodes: should ignore whitespace from server', async () => {
  const root = await fixture(`<main>
    <span>10</span>
    items left
  </main>`);
  let tpl = document.createElement('template');
  tpl.innerHTML = `<span>{{ count }}</span> {{ text }} left`;
  let instance = new AssignedTemplateInstance(root, tpl, { count: 10, text: 'items' });
  is(root.innerHTML, `\n    <span>10</span>\n    items left\n  `);
  instance.update({ count: 20, text: 'golf balls' });
  is(root.innerHTML, `\n    <span>20</span>\n    golf balls left\n  `);
});

test('nodes: should support mixed child expressions', async () => {
  const root = await fixture(`
    <main> 10 items <br> left in 40°C outside <br>   brrrr</main>
  `);
  let tpl = document.createElement('template');
  tpl.innerHTML = ` {{ count }}{{ text }} <br> left in {{deg}}°C{{location}} <br>   {{sound}}`;
  let instance = new AssignedTemplateInstance(root, tpl, {
    count: 10,
    text: ' items',
    deg: 40,
    location: ' outside',
    sound: 'brrrr'
  });
  is(root.innerHTML, ` 10 items <br> left in 40°C outside <br>   brrrr`);
  instance.update({
    count: 20,
    text: ' balls',
    deg: 5,
    location: ' inside',
    sound: 'vhhhh'
  });
  is(root.innerHTML, ` 20 balls <br> left in 5°C inside <br>   vhhhh`);
});

const propertyIdentityOrBooleanAttribute = {
  createCallback() {
    return this.processCallback(...arguments);
  },

  processCallback(instance, parts, params) {
    if (typeof params !== 'object' || !params) return;
    for (const [expression, part] of parts) {
      if (expression in params) {
        const value = params[expression] ?? '';

        // boolean attr
        if (
          typeof value === 'boolean' &&
          part instanceof AttrPart &&
          typeof part.element[part.attributeName] === 'boolean'
        )
          part.booleanValue = value;
        else part.value = value;
      }
    }
  },
};

test('update: allows attributes to be toggled on and off', async () => {
  const root = await fixture(`<main><div hidden=""></div></main>`);
  const template = document.createElement('template');
  template.innerHTML = `<div hidden="{{ hidden }}"></div>`;
  const instance = new AssignedTemplateInstance(
    root,
    template,
    { hidden: true },
    propertyIdentityOrBooleanAttribute
  );
  is(root.innerHTML, `<div hidden=""></div>`);

  instance.update({ hidden: false });
  is(root.innerHTML, `<div></div>`);

  instance.update({ hidden: 'hidden' });
  is(root.innerHTML, `<div hidden="hidden"></div>`);
});

test('update: allows attributes to be toggled on even when starting off', async () => {
  const root = await fixture(`<main><div></div></main>`);
  const template = document.createElement('template');
  template.innerHTML = `<div hidden="{{ hidden }}"></div>`;
  const instance = new AssignedTemplateInstance(
    root,
    template,
    { hidden: false },
    propertyIdentityOrBooleanAttribute
  );
  is(root.innerHTML, `<div></div>`);
  instance.update({ hidden: true });
  is(root.innerHTML, `<div hidden=""></div>`);
  instance.update({ hidden: false });
  is(root.innerHTML, `<div></div>`);
});

test('update: only toggles attributes with boolean class properties', async () => {
  const root = await fixture(`<main><input aria-disabled="false" value="false"></main>`);
  const template = document.createElement('template');
  template.innerHTML = `<input required="{{a}}" aria-disabled="{{a}}" hidden="{{a}}" value="{{a}}"/>`;
  const instance = new AssignedTemplateInstance(
    root,
    template,
    { a: false },
    propertyIdentityOrBooleanAttribute
  );
  is(root.innerHTML, `<input aria-disabled="false" value="false">`);
  instance.update({ a: true });
  is(
    root.innerHTML,
    `<input aria-disabled="true" value="true" required="" hidden="">`
  );
  instance.update({ a: false });
  is(root.innerHTML, `<input aria-disabled="false" value="false">`);
});
