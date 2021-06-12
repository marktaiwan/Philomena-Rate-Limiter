import type {StorageKeyValMap} from '../types/project';
import type {BooruData, BooruKeys, InteractionType} from './globals';
import {boorus} from './globals';

function getStore(): Record<string, unknown> {
  const booruId = currentBooru();
  const store = GM_getValue(booruId, {});
  return store;
}

function setStore(store: Record<string, unknown>): void {
  const booruId = currentBooru();
  GM_setValue(booruId, store);
}

/**
 * @returns Booru key. `null` if none match.
 */
function currentBooru(): BooruKeys {
  const booruHostnames: Record<BooruKeys, RegExp> = {
    twibooru: (/(www\.)?twibooru\.org/i),
    ponybooru: (/(www\.)?ponybooru\.org/i),
    ponerpics: (/(www\.)?ponerpics\.(org|com)/i),
    derpibooru: (/(www\.)?(derpibooru|trixiebooru)\.org/i),
  };
  const hostname = window.location.hostname;
  for (const [booru, re] of Object.entries(booruHostnames) as Array<[BooruKeys, RegExp]>) {
    if (re.test(hostname)) return booru;
  }
  return null;
}

function getBooruParam<T extends InteractionType>(key: T): BooruData[T] {
  const booruId = currentBooru();
  return boorus[booruId][key];
}

/**
 * Set value to key/value storeage scoped to the current site.
 */
function setVal<K extends keyof StorageKeyValMap>(key: K, val: StorageKeyValMap[K]): void
function setVal(key: string, val: unknown): void
function setVal(key: string, val: unknown): void {
  const store = getStore();
  store[key] = val;
  setStore(store);
}

/**
 * Retrieve value from key/value storeage scoped to the current site.
 */
function getVal<K extends keyof StorageKeyValMap>(key: K, defaultValue: StorageKeyValMap[K]): StorageKeyValMap[K]
function getVal<T>(key: string, defaultValue: T): T
function getVal(key: string, defaultValue: unknown): unknown {
  return getStore()[key] ?? defaultValue;
}

export {
  currentBooru,
  getBooruParam,
  setVal,
  getVal,
};
