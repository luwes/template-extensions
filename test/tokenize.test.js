/* Adapted from https://github.com/dy/template-parts - ISC - Dmitry Iv. */

import { assert } from '@open-wc/testing';
import { tokenize } from '../src/template-instance.js';

const test = it;
const is = assert.deepEqual;

const STRING = 0,
  PART = 1;

test('parse: extracts `{{}}` surrounding parts as part tokens', () => {
  is(Array.from(tokenize('{{x}}')), [[PART, 'x']]);
});

test('parse: tokenizes a template string successfully', () => {
  is(Array.from(tokenize('hello {{x}}')), [
    [STRING, 'hello '],
    [PART, 'x'],
  ]);
});

test('parse: does not turn escaped `{{`s into expression tokens', () => {
  is(Array.from(tokenize('\\{{x}}')), [[STRING, '\\{{x}}']]);
});

test('parse: does not terminate expressions with escaped `}}`s', () => {
  is(Array.from(tokenize('{{x\\}}}')), [[PART, 'x\\}']]);
  is(Array.from(tokenize('{{x\\}\\}}}')), [[PART, 'x\\}\\}']]);
  is(Array.from(tokenize('\\{{x}}')), [[STRING, '\\{{x}}']]);
  is(Array.from(tokenize('{{x\\}}')), [[STRING, '{{x\\}}']]);
});

test('parse: trailing whitespaces, trailing strings', () => {
  is(tokenize('{{ x }}'), [[PART, 'x']]);

  is(tokenize('{{ x }}!'), [
    [PART, 'x'],
    [STRING, '!'],
  ]);

  is(tokenize('hello {{ x }}!'), [
    [STRING, 'hello '],
    [PART, 'x'],
    [STRING, '!'],
  ]);
});

test('parse: tokenizes multiple values', () => {
  is(Array.from(tokenize('hello {{x}} and {{y}}')), [
    [STRING, 'hello '],
    [PART, 'x'],
    [STRING, ' and '],
    [PART, 'y'],
  ]);
});

test('parse: ignores single braces', () => {
  is(Array.from(tokenize('hello ${world?}')), [[STRING, 'hello ${world?}']]);
});

test('parse: ignores mismatching parens, treating them as text', () => {
  is(Array.from(tokenize('hello {{')), [[STRING, 'hello {{']]);
  is(Array.from(tokenize('hello }}')), [[STRING, 'hello }}']]);
  is(Array.from(tokenize('hello {{{{')), [
    [STRING, 'hello '],
    [STRING, '{{{{'],
  ]);
  is(Array.from(tokenize('hello {{}{')), [
    [STRING, 'hello '],
    [STRING, '{{}{'],
  ]);
  is(Array.from(tokenize('hello }}{{}')), [[STRING, 'hello }}{{}']]);
});

test('parse: ignores internal parens', () => {
  is(Array.from(tokenize('hello {{ "a {{ b }} c" }} world')), [
    [STRING, 'hello '],
    [PART, '"a {{ b }} c"'],
    [STRING, ' world'],
  ]);

  is(Array.from(tokenize('{{ "Your balance: {{ balance }}" }}')), [
    [PART, '"Your balance: {{ balance }}"'],
  ]);
});

test('parse: parses sequence of inserts', () => {
  is(tokenize('{{a}}{{b}}{{c}}'), [
    [PART, 'a'],
    [PART, 'b'],
    [PART, 'c'],
  ]);

  is(tokenize('hello {{x}}{{y}}'), [
    [STRING, 'hello '],
    [PART, 'x'],
    [PART, 'y'],
  ]);

  is(tokenize('abc{{def}}{{ghi}}{{jkl}}{{mno}}{{pqr}}{{stu}}vwxyz'), [
    [STRING, 'abc'],
    [PART, 'def'],
    [PART, 'ghi'],
    [PART, 'jkl'],
    [PART, 'mno'],
    [PART, 'pqr'],
    [PART, 'stu'],
    [STRING, 'vwxyz'],
  ]);
});

test('parse: awkward inputs', () => {
  is(tokenize('{x{{}}}'), [
    [STRING, '{x'],
    [PART, ''],
    [STRING, '}'],
  ]);

  is(tokenize('{{{ x}}}'), [
    [PART, '{ x'],
    [STRING, '}'],
  ]);

  is(tokenize('{}{{x}}}'), [
    [STRING, '{}'],
    [PART, 'x'],
    [STRING, '}'],
  ]);
});
