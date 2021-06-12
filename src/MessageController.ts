import type {StorageKeyValMap} from '../types/project';
import type {BooruKeys, InteractionType, Uid} from './globals';
import {generateUid, removeFromArray} from './util';

enum Signal {
  taskRemoved,
  taskAdded,
  queueUpdated,
  checkAlive,
  respondAlive,
}

interface EventListeners {
  id: number;
  value: Signal;
  fn: (event: MessageObject) => void;
}

type MessageObject = {
  nonce: Uid,
  from: Uid,
  to: Uid | Uid[] | null,
  site: BooruKeys,
  user: number | null,
  type: InteractionType,
  value: Signal,
}

type callbackHandle = number;
declare function GM_setValue<K extends keyof StorageKeyValMap>(name: K, value: StorageKeyValMap[K]): void;

/**
 * For cross-tab messaging
 */
class MessageController {
  readonly site: BooruKeys;
  readonly user: number;
  readonly type: InteractionType;
  taskId: Uid;
  id = 0;
  listeners: Array<EventListeners> = [];
  listenerHandle: number | string = null;

  constructor(site: BooruKeys, user: number, type: InteractionType) {
    this.site = site;
    this.user = user;
    this.type = type;
  }

  valueChangeListener(name: string, _oldValue: MessageObject, message: MessageObject): void {
    const {site, user, type} = message;
    if (name !== 'message'
      || site !== this.site
      || user !== this.user
      || type !== this.type
    ) {
      return;
    }
    const recipient = message.to;
    const recipients = (recipient instanceof Array) ? recipient : [recipient];
    if (recipient === null || recipients.includes(this.taskId)) {
      this.listeners
        .filter(listener => listener.value == message.value)
        .forEach(listener => listener.fn(message));
    }
  }

  connect(id: Uid): void {
    this.taskId = id;
    this.listenerHandle ??= GM_addValueChangeListener('message', this.valueChangeListener.bind(this));
  }

  /**
   * Remove change listener and all registered callbacks
   */
  disconnect(): void {
    if (this.listenerHandle !== null) {
      GM_removeValueChangeListener(this.listenerHandle);
      this.listenerHandle = null;
    }
  }

  message(to: MessageObject['to'], value: Signal): void {
    GM_setValue('message', {
      nonce: generateUid(),
      from: this.taskId,
      to,
      site: this.site,
      user: this.user,
      type: this.type,
      value,
    });
  }

  add(message: Signal, fn: EventListeners['fn']): callbackHandle {
    const id = ++this.id;
    this.listeners.push({id, value: message, fn});
    return id;
  }

  remove(handle: callbackHandle): void {
    removeFromArray(this.listeners, hook => hook.id == handle);
  }

  clearHandlers(): void {
    this.listeners = [];
  }
}

export type {
  MessageObject,
  Uid,
};
export {
  Signal,
};
export default MessageController;
