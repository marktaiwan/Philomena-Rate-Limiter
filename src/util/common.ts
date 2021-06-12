
/* Shorthands  */

type SelectorRoot = Document | HTMLElement;

function $<K extends keyof HTMLElementTagNameMap>(selector: K, root?: SelectorRoot): HTMLElementTagNameMap[K];
function $<T extends HTMLElement>(selector: string, root?: SelectorRoot): T;
function $(selector: string, root: SelectorRoot = document): HTMLElement {
  return root.querySelector(selector);
}

function $$<K extends keyof HTMLElementTagNameMap>(selector: K, root?: SelectorRoot): NodeListOf<HTMLElementTagNameMap[K]>;
function $$<T extends HTMLElement>(selector: string, root?: SelectorRoot): NodeListOf<T>;
function $$(selector: string, root: SelectorRoot = document): NodeListOf<HTMLElement> {
  return root.querySelectorAll(selector);
}

function create<K extends keyof HTMLElementTagNameMap>(ele: K): HTMLElementTagNameMap[K];
function create<T extends HTMLElement>(ele: string): T;
function create(ele: string): HTMLElement {
  return document.createElement(ele);
}

/* Url */

function makeAbsolute(path: string, domain: string): string {
  return (/^(?:https?:)?\/\//).test(path)
    ? path
    : domain + (path.startsWith('/') ? path : '/' + path);
}

type QueryVariableSet = {
  [key: string]: string,
};
function getQueryVariableAll(): QueryVariableSet {
  const search = window.location.search;
  if (search === '') return {};
  const arr = search
    .substring(1)
    .split('&')
    .map(string => string.split('='));
  const dict = {};
  for (const list of arr) {
    dict[list[0]] = list[1];
  }
  return dict;
}

function getQueryVariable(key: string): string {
  return getQueryVariableAll()[key];
}

function makeQueryString(queries: QueryVariableSet): string {
  return '?' + Object
    .entries(queries)
    .map(arr => arr.join('='))
    .join('&');
}

function escapeRegExp(str: string): string {
  return str.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

function onReadyFactory(): (fn: () => void) => void {
  const callbacks: Array<(...args: unknown[]) => unknown> = [];
  document.addEventListener('DOMContentLoaded', () => callbacks.forEach(fn => fn()), {once: true});
  return fn => {
    if (document.readyState == 'complete') {
      fn();
    } else {
      callbacks.push(fn);
    }
  };
}

function debounce(fn: (...args: unknown[]) => unknown, delay: number): typeof fn {
  let timeout: number = null;
  return (...args) => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(fn, delay, ...args);
  };
}

function removeFromArray<T>(array: T[], predicate: (ele: T, index: number, arr: T[]) => unknown, thisArg?: unknown): void {
  const index = array.findIndex(predicate, thisArg);
  if (index > -1) array.splice(index, 1);
}

export {
  $,
  $$,
  create,
  makeAbsolute,
  getQueryVariable,
  getQueryVariableAll,
  makeQueryString,
  escapeRegExp,
  onReadyFactory,
  debounce,
  removeFromArray,
};
