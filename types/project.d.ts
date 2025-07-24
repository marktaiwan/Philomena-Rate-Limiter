import {InteractionType} from '../src/globals';
import type {MessageObject} from '../src/MessageController';
import {QueuedTask, Uid} from '../src/RateLimiter';

interface StorageKeyValMap {
  message: MessageObject;
  timestamp: Record<
    InteractionType,
    Record<string, number>
  >;
  queue: Record<InteractionType, QueuedTask[]>;
  activeInstances: Record<InteractionType, Uid[]>;
  lastInteraction: {
    [userId: number]: {
      [type in InteractionType]?: number
    },
  };
}

type Brand<K, T> = K & {__brand: T};

export type {
  StorageKeyValMap,
  Brand,
};
