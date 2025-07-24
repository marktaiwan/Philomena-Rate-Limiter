import {currentBooru, getBooruParam, getVal, setVal} from './datastore';
import type {BooruKeys, Uid} from './globals';
import {BUFFER, InteractionType} from './globals';
import MessageController, {Signal} from './MessageController';
import {generateUid, getDatastore, removeFromArray} from './util';

/**
 * - inactive - no current task
 * - queued - task added to queue
 * - pending - next task, waiting for timeout
 * - active - callback executed, waiting for response
 */
enum TaskState {
  inactive,
  queued,
  pending,
  active,
}
type QueuedTask = {
  uid: Uid,
  user: number | null,
};
type MessageObject = {
  from: Uid,
  to: Uid | Uid[] | null,
  site: BooruKeys,
  user: number | null,
  type: InteractionType,
  value: Signal,
};


/** Overview:
 *
 * Tasks are queued with {@link RateLimiter.queueTask}, callbacks are executed in the
 * order they are queued, with enforcement of cooldown period between the termination of
 * previous task and the execution of the next.
 *
 * Cross-tab communication is done via monitoring changes to the value of `message`
 * in script storage. It is chosen over LocalStorage or BroadcaseChannel for its
 * ability to pass message across origins, which is a necessity due to the possibility
 * of a site operating on multiple domains or subdomains.
 */
class RateLimiter {
  state = TaskState.inactive;
  taskId: Uid;
  readonly site: BooruKeys;
  readonly user: number = (getDatastore().userIsSignedIn) ? getDatastore().userId as number : null;
  readonly type: InteractionType;
  readonly cooldown: number;
  readonly MessageController: MessageController;
  taskETA: number;
  callbackHandle: number;
  tickerHandle: number = null;
  taskCallback: () => void;
  pollerHandle: number = null;
  messagePromiseResolver: {
    [id: string]: (tuple: [uid: Uid, val: boolean]) => void,
  } = {};

  constructor(type: InteractionType) {
    this.site = currentBooru();
    this.user = getDatastore().userIsSignedIn as boolean ? getDatastore().userId as number : null;
    this.type = type;
    this.cooldown = getBooruParam(type).cooldown;
    this.MessageController = new MessageController(
      this.site,
      this.user,
      this.type,
    );
  }

  getSharedQueue(): Promise<QueuedTask[]> {
    return new Promise<QueuedTask[]>(resolve => {
      window.setTimeout(() => {
        const queue = getVal('queue', {})[this.type] ?? [];
        resolve(queue);
      });
    });
  }
  setSharedQueue(queue: QueuedTask[]): Promise<void> {
    return new Promise(resolve => {
      window.setTimeout(() => {
        const collection = getVal('queue', {});
        collection[this.type] = queue;
        setVal('queue', collection);
        this.broadcast(Signal.queueUpdated);
        resolve();
      });
    });
  }

  getSharedQueueSynchronous(): QueuedTask[] {
    return getVal('queue', {})[this.type] ?? [];
  }
  setSharedQueueSynchronous(queue: QueuedTask[]): void {
    const collection = getVal('queue', {});
    collection[this.type] = queue;
    setVal('queue', collection);
    this.broadcast(Signal.queueUpdated);
  }

  get lastRan(): number {
    const lastInteraction = getVal('lastInteraction', {})?.[this.user]?.[this.type];
    return lastInteraction ?? 0;
  }

  set lastRan(timestamp: number) {
    const collection = getVal('lastInteraction', {});
    if (typeof collection[this.user] !== 'object') {
      collection[this.user] = {};
    }
    collection[this.user][this.type] = timestamp;
    setVal('lastInteraction', collection);
  }

  message(to: Uid, message: Signal): void {
    this.MessageController.message(to, message);
  }

  broadcast(message: Signal): void {
    this.MessageController.message(null, message);
  }

  /**
   * @param callback - function to be executed after cooldown
   */
  async queueTask(callback: () => void): Promise<void> {
      // need to initialize controller before any message passing
    this.taskId = generateUid();
    this.MessageController.connect(this.taskId);

    await this.pruneTaskQueue();
    this.taskCallback = callback;
    this.taskETA = null;
    this.state = TaskState.queued;

    this.initQueuePolling();
    this.MessageController.add(Signal.queueUpdated, async () => {
      // check if self is earliest in queue that matches the same user id
      const queue = (await this.getSharedQueue()).filter(task => task.user === this.user);
      const index = queue.findIndex(task => task.uid == this.taskId);
      if (queue.length > 0
        && index == 0
        && this.state == TaskState.queued
      ) {
        // check last exec time
        const now = Date.now();
        const lastRan = this.lastRan;
        const elapsed = now - lastRan;
        const waitTime = Math.max(0, this.cooldown - elapsed + BUFFER);

        this.taskETA = now + waitTime;
        this.state = TaskState.pending;
        this.clearQueuePolling();

        // wait until cooldown has passed then execute task
        this.callbackHandle = window.setTimeout(() => {
          this.state = TaskState.active;
          this.clearTicker();
          this.taskCallback();
        }, waitTime);
      }
    });

    this.MessageController.add(Signal.checkAlive, message => {
      window.setTimeout(() => this.signalAlive(message.from));
    });

    const presentQueue = await this.getSharedQueue();
    presentQueue.push({
      uid: this.taskId,
      user: this.user,
    });
    this.setSharedQueue(presentQueue);
    this.broadcast(Signal.taskAdded);
  }

  /**
   * This method signals to the RateLimiter that whatever task it queued up to do
   * has completed, and it can remove itself from the queue, un-register the event
   * listener... etc.
   * @param abort - Set this to true if the task is terminated early
   * (e.g. tab closed while still in queue)
   */
  terminateTask(abort = false): void {
    if (!abort) {
      this.lastRan = Date.now();
    } else {
      if (this.state == TaskState.active) return;
      window.clearTimeout(this.callbackHandle);
      this.clearQueuePolling();
    }

    // remove task from queue
    const queue = this.getSharedQueueSynchronous();
    removeFromArray(queue, task => task.uid == this.taskId);
    this.setSharedQueueSynchronous(queue);

    // unregister event listener
    this.MessageController.clearHandlers();
    this.MessageController.disconnect();

    // remove ticker
    this.clearTicker();

    this.state = TaskState.inactive;
    this.taskId = null;
    this.taskCallback = null;
  }

  /**
   * Executes the callback at regular intervals.
   * Intended for updating page UI to show countdown etc.
   */
  initTicker(
    callback: (
      taskState: TaskState,
      queuePosition: number,
      timeRemaining: number,
    ) => void
  ): void {
    this.tickerHandle = window.setInterval(async () => {
      // get current position in queue
      const index = (await this.getSharedQueue()).findIndex(task => task.uid == this.taskId);

      // calculate time remaining
      const now = Date.now();
      const secondsRemaining = Math.max(0, Math.round((this.taskETA - now) / 1000));

      callback(this.state, Math.max(index, 0), secondsRemaining);
    }, 500);
  }

  clearTicker(): void {
    if (this.tickerHandle) window.clearInterval(this.tickerHandle);
    this.tickerHandle = null;
  }

  /**
   * In case of unexpected script terminations, leaving orphaned QueuedTasks will
   * obviously cause the whole queue to stall in perpetuity. To counter this,
   * `checkAlive` queries each instance id currently present in the queue, and
   * prune the ones that does not respond.
   *
   * Note:
   * Due to the asynchronous nature of this method. There's a possibility of
   * sharedQueue being modified by other instances during execution. Namely:
   * 1. When a task is done and removes itself from the front of the queue
   * 2. When a new task is added to the end of the queue
   *
   * Scenario #1 is mitigated by fetching and operating on a fresh copy of the
   * sharedQueue once orphaned tasks are identified, while #2 is handled by simply
   * discarding the current prune job and let the newer task instance take care
   * of it.
   */
  async pruneTaskQueue(): Promise<void> {
    let workingQueue = await this.getSharedQueue();
    if (workingQueue.length == 0) return;

    const TIMEOUT = 500;
    let newTaskInQueue = false;

    const handlerIds: number[] = [];
    const messageHandlers: Array<{
      event: Signal,
      fn: (msg: MessageObject) => void,
    }> = [{
      event: Signal.taskAdded,
      fn: () => newTaskInQueue = true,
    }, {
      event: Signal.respondAlive,
      fn: (msg: MessageObject) => this.messagePromiseResolver[msg.from]([msg.from, true]),
    }];

    // register event handlers
    for (const {event, fn} of messageHandlers) {
      const id = this.MessageController.add(event, fn);
      handlerIds.push(id);
    }

    const promises: Array<Promise<[Uid, boolean]>> = [];
    for (const {uid} of workingQueue) {
      promises.push(
        new Promise<[Uid, boolean]>(resolve => {
          this.messagePromiseResolver[uid] = resolve;
          window.setTimeout(() => resolve([uid, false]), TIMEOUT);
        })
      );
      this.message(uid, Signal.checkAlive);
    }

    const resolvedPromises = await Promise.all(promises);
    const tasksToEvict = resolvedPromises
      .filter(([, alive]) => !alive)
      .map(([uid]) => uid);

    // reset promise resolver
    this.messagePromiseResolver = {};

    for (const handle of handlerIds) this.MessageController.remove(handle);

    workingQueue = await this.getSharedQueue();
    if (newTaskInQueue) return;
    for (const uid of tasksToEvict) removeFromArray(workingQueue, task => task.uid == uid);
    this.setSharedQueueSynchronous(workingQueue);
  }

  signalAlive(source: Uid): void {
    this.message(source, Signal.respondAlive);
  }

  /**
   * Despite best efforts, there's still no 100% reliable way to signal queue
   * changes as the page unloads upon upload completion.
   *
   * As a final kludge, the rate limiter "polls" the shareQueue by periodically
   * sending a queueUpdated message to itself every 2 seconds to force the event
   * handler to execute.
   */
  initQueuePolling(): void {
    this.pollerHandle ??= window.setInterval(() => {
      this.message(this.taskId, Signal.queueUpdated);
    }, 2000);
  }
  clearQueuePolling(): void {
    if (this.pollerHandle) window.clearInterval(this.pollerHandle);
    this.pollerHandle = null;
  }
}

export type {
  Uid,
  MessageObject,
  QueuedTask,
  InteractionType,
  Signal,
};
export {
  RateLimiter,
  TaskState,
};
