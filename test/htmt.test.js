import { assert } from '@open-wc/testing';
import { build, evaluate } from '../src/html-parser.js';

const test = it;
const deepEqual = assert.deepEqual;

const h = (tag, props, ...children) => ({ tag, props, children });
const html = (string, fields) => {
  const tmp = evaluate({ h }, build([string]), fields);
  return tmp.length > 1 ? tmp : tmp[0];
};

test('single dynamic tag name', () => {
  deepEqual(html(`<{{fn}} />`, { fn: 'foo' }), {
    tag: 'foo',
    props: null,
    children: [],
  });
  function Foo() {}
  deepEqual(html(`<{{fn}} />`, { fn: Foo }), {
    tag: Foo,
    props: null,
    children: [],
  });
});

test('two props with dynamic values', () => {
  function onClick() {}
  deepEqual(html(`<a href={{0}} onClick={{1}} />`, { 0: 'foo', 1: onClick }), {
    tag: 'a',
    props: { href: 'foo', onClick },
    children: [],
  });
});

test('prop with multiple static and dynamic values get concatenated as strings', () => {
  deepEqual(html(`<a href="before{{0}}after" />`, { 0: 'foo' }), {
    tag: 'a',
    props: { href: 'beforefooafter' },
    children: [],
  });
  deepEqual(html(`<a href="{{0}}{{1}}" />`, { 0: 1, 1: 1 }), {
    tag: 'a',
    props: { href: '11' },
    children: [],
  });
  deepEqual(html(`<a href="{{0}}between{{1}}" />`, { 0: 1, 1: 1 }), {
    tag: 'a',
    props: { href: '1between1' },
    children: [],
  });
  deepEqual(html(`<a href=/before/{{0}}/after />`, { 0: 'foo' }), {
    tag: 'a',
    props: { href: '/before/foo/after' },
    children: [],
  });
  deepEqual(html(`<a href=/before/{{foo}}/>`, { foo: 'foo' }), {
    tag: 'a',
    props: { href: '/before/foo' },
    children: [],
  });
});

test('mixed text + dynamic children', () => {
  deepEqual(html(`<a>{{0}}bar</a>`, { 0: 'foo' }), {
    tag: 'a',
    props: null,
    children: ['foo', 'bar'],
  });
  deepEqual(html(`<a>before{{0}}after</a>`, { 0: 'foo' }), {
    tag: 'a',
    props: null,
    children: ['before', 'foo', 'after'],
  });
  deepEqual(html(`<a>foo{{0}}</a>`, { 0: null }), {
    tag: 'a',
    props: null,
    children: ['foo', null],
  });
});
