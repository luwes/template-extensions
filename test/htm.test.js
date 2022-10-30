import { assert } from '@open-wc/testing';
import { build, evaluate } from '../src/html-parser.js';

const test = it;
const deepEqual = assert.deepEqual;
const notDeepEqual = assert.notDeepEqual;

const CACHES = new Map();
export function populate(statics, fields) {
  let tmp = CACHES.get(this);
  if (!tmp) {
    tmp = new Map();
    CACHES.set(this, tmp);
  }
  const built = tmp.get(statics) || (tmp.set(statics, tmp = build(statics)), tmp);
  tmp = evaluate(this, built, fields);
  return tmp.length > 1 ? tmp : tmp[0];
}

const h = (tag, props, ...children) => ({ tag, props, children });
const html = (...args) => populate.call({ h }, args[0], args);

test('empty', () => {
  deepEqual(html``, undefined);
});

test('single named elements', () => {
  deepEqual(html`<div />`, { tag: 'div', props: null, children: [] });
  deepEqual(html`<div />`, { tag: 'div', props: null, children: [] });
  deepEqual(html`<span />`, { tag: 'span', props: null, children: [] });
});

test('multiple root elements', () => {
  deepEqual(html`<a /><b></b><c><//>`, [
    { tag: 'a', props: null, children: [] },
    { tag: 'b', props: null, children: [] },
    { tag: 'c', props: null, children: [] },
  ]);
});

test('single dynamic tag name', () => {
  deepEqual(html`<${'foo'} />`, { tag: 'foo', props: null, children: [] });
  function Foo() {}
  deepEqual(html`<${Foo} />`, { tag: Foo, props: null, children: [] });
});

test('single boolean prop', () => {
  deepEqual(html`<a disabled />`, {
    tag: 'a',
    props: { disabled: true },
    children: [],
  });
});

test('two boolean props', () => {
  deepEqual(html`<a invisible disabled />`, {
    tag: 'a',
    props: { invisible: true, disabled: true },
    children: [],
  });
});

test('single prop with empty value', () => {
  deepEqual(html`<a href="" />`, {
    tag: 'a',
    props: { href: '' },
    children: [],
  });
});

test('two props with empty values', () => {
  deepEqual(html`<a href="" foo="" />`, {
    tag: 'a',
    props: { href: '', foo: '' },
    children: [],
  });
});

test('single prop with empty name', () => {
  deepEqual(html`<a ""="foo" />`, {
    tag: 'a',
    props: { '': 'foo' },
    children: [],
  });
});

test('single prop with static value', () => {
  deepEqual(html`<a href="/hello" />`, {
    tag: 'a',
    props: { href: '/hello' },
    children: [],
  });
});

test('single prop with static value followed by a single boolean prop', () => {
  deepEqual(html`<a href="/hello" b />`, {
    tag: 'a',
    props: { href: '/hello', b: true },
    children: [],
  });
});

test('two props with static values', () => {
  deepEqual(html`<a href="/hello" target="_blank" />`, {
    tag: 'a',
    props: { href: '/hello', target: '_blank' },
    children: [],
  });
});

test('single prop with dynamic value', () => {
  deepEqual(html`<a href=${'foo'} />`, {
    tag: 'a',
    props: { href: 'foo' },
    children: [],
  });
});

test('slash in the middle of tag name or property name self-closes the element', () => {
  deepEqual(html`<ab/ba prop=value>`, {
    tag: 'ab',
    props: null,
    children: [],
  });
  deepEqual(html`<abba pr/op=value>`, {
    tag: 'abba',
    props: { pr: true },
    children: [],
  });
});

test('slash in a property value does not self-closes the element, unless followed by >', () => {
  deepEqual(html`<abba prop=val/ue><//>`, {
    tag: 'abba',
    props: { prop: 'val/ue' },
    children: [],
  });
  deepEqual(html`<abba prop="value" />`, {
    tag: 'abba',
    props: { prop: 'value' },
    children: [],
  });
  deepEqual(html`<abba prop=value/ ><//>`, {
    tag: 'abba',
    props: { prop: 'value/' },
    children: [],
  });
});

test('two props with dynamic values', () => {
  function onClick() {}
  deepEqual(html`<a href=${'foo'} onClick=${onClick} />`, {
    tag: 'a',
    props: { href: 'foo', onClick },
    children: [],
  });
});

test('prop with multiple static and dynamic values get concatenated as strings', () => {
  deepEqual(html`<a href="before${'foo'}after" />`, {
    tag: 'a',
    props: { href: 'beforefooafter' },
    children: [],
  });
  deepEqual(html`<a href="${1}${1}" />`, {
    tag: 'a',
    props: { href: '11' },
    children: [],
  });
  deepEqual(html`<a href="${1}between${1}" />`, {
    tag: 'a',
    props: { href: '1between1' },
    children: [],
  });
  deepEqual(html`<a href=/before/${'foo'}/after />`, {
    tag: 'a',
    props: { href: '/before/foo/after' },
    children: [],
  });
  deepEqual(html`<a href=/before/${'foo'}/>`, {
    tag: 'a',
    props: { href: '/before/foo' },
    children: [],
  });
});

test('spread props', () => {
  deepEqual(html`<a ...${{ foo: 'bar' }} />`, {
    tag: 'a',
    props: { foo: 'bar' },
    children: [],
  });
  deepEqual(html`<a b ...${{ foo: 'bar' }} />`, {
    tag: 'a',
    props: { b: true, foo: 'bar' },
    children: [],
  });
  deepEqual(html`<a b c ...${{ foo: 'bar' }} />`, {
    tag: 'a',
    props: { b: true, c: true, foo: 'bar' },
    children: [],
  });
  deepEqual(html`<a ...${{ foo: 'bar' }} b />`, {
    tag: 'a',
    props: { b: true, foo: 'bar' },
    children: [],
  });
  deepEqual(html`<a b="1" ...${{ foo: 'bar' }} />`, {
    tag: 'a',
    props: { b: '1', foo: 'bar' },
    children: [],
  });
  deepEqual(
    html`<a x="1"><b y="2" ...${{ c: 'bar' }} /></a>`,
    h('a', { x: '1' }, h('b', { y: '2', c: 'bar' }))
  );
  deepEqual(
    html`<a b=${2} ...${{ c: 3 }}>d: ${4}</a>`,
    h('a', { b: 2, c: 3 }, 'd: ', 4)
  );
  deepEqual(
    html`<a ...${{ c: 'bar' }}><b ...${{ d: 'baz' }} /></a>`,
    h('a', { c: 'bar' }, h('b', { d: 'baz' }))
  );
});

test('multiple spread props in one element', () => {
  deepEqual(html`<a ...${{ foo: 'bar' }} ...${{ quux: 'baz' }} />`, {
    tag: 'a',
    props: { foo: 'bar', quux: 'baz' },
    children: [],
  });
});

test('mixed spread + static props', () => {
  deepEqual(html`<a b ...${{ foo: 'bar' }} />`, {
    tag: 'a',
    props: { b: true, foo: 'bar' },
    children: [],
  });
  deepEqual(html`<a b c ...${{ foo: 'bar' }} />`, {
    tag: 'a',
    props: { b: true, c: true, foo: 'bar' },
    children: [],
  });
  deepEqual(html`<a ...${{ foo: 'bar' }} b />`, {
    tag: 'a',
    props: { b: true, foo: 'bar' },
    children: [],
  });
  deepEqual(html`<a ...${{ foo: 'bar' }} b c />`, {
    tag: 'a',
    props: { b: true, c: true, foo: 'bar' },
    children: [],
  });
});

test('closing tag', () => {
  deepEqual(html`<a></a>`, { tag: 'a', props: null, children: [] });
  deepEqual(html`<a b></a>`, { tag: 'a', props: { b: true }, children: [] });
});

test('auto-closing tag', () => {
  deepEqual(html`<a><//>`, { tag: 'a', props: null, children: [] });
});

test('non-element roots', () => {
  deepEqual(html`foo`, 'foo');
  deepEqual(html`${1}`, 1);
  deepEqual(html`foo${1}`, ['foo', 1]);
  deepEqual(html`foo${1}bar`, ['foo', 1, 'bar']);
});

test('text child', () => {
  deepEqual(html`<a>foo</a>`, { tag: 'a', props: null, children: ['foo'] });
  deepEqual(html`<a>foo bar</a>`, {
    tag: 'a',
    props: null,
    children: ['foo bar'],
  });
  deepEqual(html`<a>foo "<b /></a>`, {
    tag: 'a',
    props: null,
    children: ['foo "', { tag: 'b', props: null, children: [] }],
  });
});

test('dynamic child', () => {
  deepEqual(html`<a>${'foo'}</a>`, {
    tag: 'a',
    props: null,
    children: ['foo'],
  });
});

test('mixed text + dynamic children', () => {
  deepEqual(html`<a>${'foo'}bar</a>`, {
    tag: 'a',
    props: null,
    children: ['foo', 'bar'],
  });
  deepEqual(html`<a>before${'foo'}after</a>`, {
    tag: 'a',
    props: null,
    children: ['before', 'foo', 'after'],
  });
  deepEqual(html`<a>foo${null}</a>`, {
    tag: 'a',
    props: null,
    children: ['foo', null],
  });
});

test('element child', () => {
  deepEqual(html`<a><b /></a>`, h('a', null, h('b', null)));
});

test('multiple element children', () => {
  deepEqual(
    html`<a><b /><c /></a>`,
    h('a', null, h('b', null), h('c', null))
  );
  deepEqual(
    html`<a x><b y /><c z /></a>`,
    h('a', { x: true }, h('b', { y: true }), h('c', { z: true }))
  );
  deepEqual(
    html`<a x="1"><b y="2" /><c z="3" /></a>`,
    h('a', { x: '1' }, h('b', { y: '2' }), h('c', { z: '3' }))
  );
  deepEqual(
    html`<a x=${1}><b y=${2} /><c z=${3} /></a>`,
    h('a', { x: 1 }, h('b', { y: 2 }), h('c', { z: 3 }))
  );
});

test('mixed typed children', () => {
  deepEqual(html`<a>foo<b /></a>`, h('a', null, 'foo', h('b', null)));
  deepEqual(html`<a><b />bar</a>`, h('a', null, h('b', null), 'bar'));
  deepEqual(
    html`<a>before<b />after</a>`,
    h('a', null, 'before', h('b', null), 'after')
  );
  deepEqual(
    html`<a>before<b x="1" />after</a>`,
    h('a', null, 'before', h('b', { x: '1' }), 'after')
  );
  deepEqual(
    html`
      <a>
        before${'foo'}
        <b />
        ${'bar'}after
      </a>
   `,
    h('a', null, 'before', 'foo', h('b', null), 'bar', 'after')
  );
});

test('hyphens (-) are allowed in attribute names', () => {
  deepEqual(html`<a b-c></a>`, h('a', { 'b-c': true }));
});

test('NUL characters are allowed in attribute values', () => {
  deepEqual(html`<a b="\0"></a>`, h('a', { b: '\0' }));
  deepEqual(html`<a b="\0" c=${'foo'}></a>`, h('a', { b: '\0', c: 'foo' }));
});

test('NUL characters are allowed in text', () => {
  deepEqual(html`<a>\0</a>`, h('a', null, '\0'));
  deepEqual(html`<a>\0${'foo'}</a>`, h('a', null, '\0', 'foo'));
});

test('cache key should be unique', () => {
  html`<a b="${'foo'}" /> `;
  deepEqual(html`<a b="\0" />`, h('a', { b: '\0' }));
  notDeepEqual(
    html`<a>${''}9aaaaaaaaa${''}</a>`,
    html`<a>${''}0${''}aaaaaaaaa${''}</a> `
  );
  notDeepEqual(
    html`<a>${''}0${''}aaaaaaaa${''}</a>`,
    html`<a>${''}.8aaaaaaaa${''}</a> `
  );
});

test('do not mutate spread variables', () => {
  const obj = {};
  html`<a ...${obj} b="1" /> `;
  deepEqual(obj, {});
});

test('ignore HTML comments', () => {
  deepEqual(html`<a><!-- Hello, world! --></a>`, h('a', null));
  deepEqual(html`<a><!-- Hello,\nworld! --></a>`, h('a', null));
  deepEqual(html`<a><!-- ${'Hello, world!'} --></a>`, h('a', null));
  deepEqual(html`<a><!--> Hello, world <!--></a>`, h('a', null));
});
