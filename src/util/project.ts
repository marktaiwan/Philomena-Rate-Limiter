import type {Uid} from '../globals';
import {$} from './common';

function generateUid(): Uid {
  // ehhh... good enough
  return Math.random().toString(36).slice(2, 11) as Uid;
}

function getDatastore(): Record<string, unknown> {
  const store: {[key: string]: string} = {...$('.js-datastore').dataset};
  for (const [key, val] of Object.entries(store)) {
    try {
      store[key] = JSON.parse(val);
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

async function sleep(duration: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, duration));
}

export {
  generateUid,
  getDatastore,
  sleep,
};
