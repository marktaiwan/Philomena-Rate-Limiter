import type {Uid} from '../globals';
import {$} from './common';

function generateUid(): Uid {
  // ehhh... good enough
  return Math.random().toString(36).slice(2, 11) as Uid;
}

function getDatastore<T>(): Record<string, T>;
function getDatastore(): Record<string, unknown> {
  const store: {[key: string]: string | undefined} = {...$('.js-datastore')?.dataset};
  for (const [key, val] of Object.entries(store)) {
    try {
      if (val !== undefined) {
        store[key] = JSON.parse(val);
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        store[key] = val;
      } else {
        throw e;
      }
    }
  }
  return store;
}

export {
  generateUid,
  getDatastore,
};
