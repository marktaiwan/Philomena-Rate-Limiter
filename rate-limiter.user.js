// ==UserScript==
// @name        Philomena Rate Limiter
// @version     1.0.2
// @author      Marker
// @license     MIT
// @namespace   https://github.com/marktaiwan/
// @homepageURL https://github.com/marktaiwan/Philomena-Rate-Limiter
// @supportURL  https://github.com/marktaiwan/Philomena-Rate-Limiter/issues
// @match       https://*.ponybooru.org/*
// @match       https://*.ponerpics.com/*
// @match       https://*.ponerpics.org/*
// @match       https://*.derpibooru.org/*
// @match       https://*.trixiebooru.org/*
// @match       https://*.twibooru.org/*
// @require     https://raw.githubusercontent.com/soufianesakhi/node-creation-observer-js/master/release/node-creation-observer-latest.js
// @noframes
// @grant       GM_setValue
// @grant       GM_getValue
// @grant       GM_addValueChangeListener
// @grant       GM_removeValueChangeListener
// ==/UserScript==
(function () {
  'use strict';

  const BUFFER = 500;
  const boorus = {
    derpibooru: {
      upload: {
        cooldown: 10000,
        selector: 'form[action="/images"] button[type="submit"]',
      },
      comment: {
        cooldown: 30000,
        selector: '#js-comment-form button[type="submit"]',
      },
      tag: {
        cooldown: 5000,
        selector: '#tags-form #edit_save_button',
      },
      forum: {
        cooldown: 30000,
        selector: 'form[action$="/posts"]',
      },
    },
    ponybooru: {
      upload: {
        cooldown: 10000,
        selector: 'form[action="/images"] button[type="submit"]',
      },
      comment: {
        cooldown: 30000,
        selector: '#js-comment-form button[type="submit"]',
      },
      tag: {
        cooldown: 5000,
        selector: '#tags-form #edit_save_button',
      },
      forum: {
        cooldown: 30000,
        selector: 'form[action$="/posts"]',
      },
    },
    ponerpics: {
      upload: {
        cooldown: 10000,
        selector: 'form[action="/images"] button[type="submit"]',
      },
      comment: {
        cooldown: 30000,
        selector: '#js-comment-form button[type="submit"]',
      },
      tag: {
        cooldown: 5000,
        selector: '#tags-form #edit_save_button',
      },
      forum: {
        cooldown: 30000,
        selector: 'form[action$="/posts"]',
      },
    },
    twibooru: {
      upload: {
        cooldown: 10000,
        selector: 'form#new_post input[name="commit"]',
      },
      comment: {
        cooldown: 30000,
        selector: '#js-comment-form button[type="submit"]',
      },
      tag: {
        cooldown: 5000,
        selector: '#tags-form #edit_save_button',
      },
    },
  };

  function getStore() {
    const booruId = currentBooru();
    const store = GM_getValue(booruId, {});
    return store;
  }
  function setStore(store) {
    const booruId = currentBooru();
    GM_setValue(booruId, store);
  }
  /**
   * @returns Booru key. `null` if none match.
   */
  function currentBooru() {
    const booruHostnames = {
      twibooru: /(www\.)?twibooru\.org/i,
      ponybooru: /(www\.)?ponybooru\.org/i,
      ponerpics: /(www\.)?ponerpics\.(org|com)/i,
      derpibooru: /(www\.)?(derpibooru|trixiebooru)\.org/i,
    };
    const hostname = window.location.hostname;
    for (const [booru, re] of Object.entries(booruHostnames)) {
      if (re.test(hostname)) return booru;
    }
    return null;
  }
  function getBooruParam(key) {
    const booruId = currentBooru();
    return boorus[booruId][key];
  }
  function setVal(key, val) {
    const store = getStore();
    store[key] = val;
    setStore(store);
  }
  function getVal(key, defaultValue) {
    return getStore()[key] ?? defaultValue;
  }

  /* Shorthands  */
  function $(selector, root = document) {
    return root.querySelector(selector);
  }
  function removeFromArray(array, predicate, thisArg) {
    const index = array.findIndex(predicate, thisArg);
    if (index > -1) array.splice(index, 1);
  }

  function generateUid() {
    // ehhh... good enough
    return Math.random().toString(36).substr(2, 9);
  }
  function getDatastore() {
    const store = {...$('.js-datastore').dataset};
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

  var Signal;
  (function (Signal) {
    Signal[(Signal['taskRemoved'] = 0)] = 'taskRemoved';
    Signal[(Signal['taskAdded'] = 1)] = 'taskAdded';
    Signal[(Signal['queueUpdated'] = 2)] = 'queueUpdated';
    Signal[(Signal['checkAlive'] = 3)] = 'checkAlive';
    Signal[(Signal['respondAlive'] = 4)] = 'respondAlive';
  })(Signal || (Signal = {}));
  /**
   * For cross-tab messaging
   */
  class MessageController {
    constructor(site, user, type) {
      this.id = 0;
      this.listeners = [];
      this.listenerHandle = null;
      this.site = site;
      this.user = user;
      this.type = type;
    }
    valueChangeListener(name, _oldValue, message) {
      const {site, user, type} = message;
      if (name !== 'message' || site !== this.site || user !== this.user || type !== this.type) {
        return;
      }
      const recipient = message.to;
      const recipients = recipient instanceof Array ? recipient : [recipient];
      if (recipient === null || recipients.includes(this.taskId)) {
        this.listeners
          .filter(listener => listener.value == message.value)
          .forEach(listener => listener.fn(message));
      }
    }
    connect(id) {
      this.taskId = id;
      this.listenerHandle ??
        (this.listenerHandle = GM_addValueChangeListener(
          'message',
          this.valueChangeListener.bind(this)
        ));
    }
    /**
     * Remove change listener and all registered callbacks
     */
    disconnect() {
      if (this.listenerHandle !== null) {
        GM_removeValueChangeListener(this.listenerHandle);
        this.listenerHandle = null;
      }
    }
    message(to, value) {
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
    add(message, fn) {
      const id = ++this.id;
      this.listeners.push({id, value: message, fn});
      return id;
    }
    remove(handle) {
      removeFromArray(this.listeners, hook => hook.id == handle);
    }
    clearHandlers() {
      this.listeners = [];
    }
  }

  /**
   * - inactive - no current task
   * - queued - task added to queue
   * - pending - next task, waiting for timeout
   * - active - callback executed, waiting for response
   */
  var TaskState;
  (function (TaskState) {
    TaskState[(TaskState['inactive'] = 0)] = 'inactive';
    TaskState[(TaskState['queued'] = 1)] = 'queued';
    TaskState[(TaskState['pending'] = 2)] = 'pending';
    TaskState[(TaskState['active'] = 3)] = 'active';
  })(TaskState || (TaskState = {}));
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
    constructor(type) {
      this.state = TaskState.inactive;
      this.user = getDatastore().userIsSignedIn ? getDatastore().userId : null;
      this.tickerHandle = null;
      this.pollerHandle = null;
      this.messagePromiseResolver = {};
      this.site = currentBooru();
      this.user = getDatastore().userIsSignedIn ? getDatastore().userId : null;
      this.type = type;
      this.cooldown = getBooruParam(type).cooldown;
      this.MessageController = new MessageController(this.site, this.user, this.type);
    }
    getSharedQueue() {
      return new Promise(resolve => {
        window.setTimeout(() => {
          const queue = getVal('queue', {})[this.type] ?? [];
          resolve(queue);
        });
      });
    }
    setSharedQueue(queue) {
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
    getSharedQueueSynchronous() {
      return getVal('queue', {})[this.type] ?? [];
    }
    setSharedQueueSynchronous(queue) {
      const collection = getVal('queue', {});
      collection[this.type] = queue;
      setVal('queue', collection);
      this.broadcast(Signal.queueUpdated);
    }
    get lastRan() {
      const lastInteraction = getVal('lastInteraction', {})?.[this.user]?.[this.type];
      return lastInteraction ?? 0;
    }
    set lastRan(timestamp) {
      const collection = getVal('lastInteraction', {});
      if (typeof collection[this.user] !== 'object') {
        collection[this.user] = {};
      }
      collection[this.user][this.type] = timestamp;
      setVal('lastInteraction', collection);
    }
    message(to, message) {
      this.MessageController.message(to, message);
    }
    broadcast(message) {
      this.MessageController.message(null, message);
    }
    /**
     * @param callback - function to be executed after cooldown
     */
    async queueTask(callback) {
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
        if (queue.length > 0 && index == 0 && this.state == TaskState.queued) {
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
    terminateTask(abort = false) {
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
    initTicker(callback) {
      this.tickerHandle = window.setInterval(async () => {
        // get current position in queue
        const index = (await this.getSharedQueue()).findIndex(task => task.uid == this.taskId);
        // calculate time remaining
        const now = Date.now();
        const secondsRemaining = Math.max(0, Math.round((this.taskETA - now) / 1000));
        callback(this.state, Math.max(index, 0), secondsRemaining);
      }, 500);
    }
    clearTicker() {
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
    async pruneTaskQueue() {
      let workingQueue = await this.getSharedQueue();
      if (workingQueue.length == 0) return;
      const TIMEOUT = 500;
      let newTaskInQueue = false;
      const handlerIds = [];
      const messageHandlers = [
        {
          event: Signal.taskAdded,
          fn: () => (newTaskInQueue = true),
        },
        {
          event: Signal.respondAlive,
          fn: msg => this.messagePromiseResolver[msg.from]([msg.from, true]),
        },
      ];
      // register event handlers
      for (const {event, fn} of messageHandlers) {
        const id = this.MessageController.add(event, fn);
        handlerIds.push(id);
      }
      const promises = [];
      for (const {uid} of workingQueue) {
        promises.push(
          new Promise(resolve => {
            this.messagePromiseResolver[uid] = resolve;
            window.setTimeout(() => resolve([uid, false]), TIMEOUT);
          })
        );
        this.message(uid, Signal.checkAlive);
      }
      const resolvedPromises = await Promise.all(promises);
      const tasksToEvict = resolvedPromises.filter(([, alive]) => !alive).map(([uid]) => uid);
      // reset promise resolver
      this.messagePromiseResolver = {};
      for (const handle of handlerIds) this.MessageController.remove(handle);
      workingQueue = await this.getSharedQueue();
      if (newTaskInQueue) return;
      for (const uid of tasksToEvict) removeFromArray(workingQueue, task => task.uid == uid);
      this.setSharedQueueSynchronous(workingQueue);
    }
    signalAlive(source) {
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
    initQueuePolling() {
      this.pollerHandle ??
        (this.pollerHandle = window.setInterval(() => {
          this.message(this.taskId, Signal.queueUpdated);
        }, 2000));
    }
    clearQueuePolling() {
      if (this.pollerHandle) window.clearInterval(this.pollerHandle);
      this.pollerHandle = null;
    }
  }

  function initUploadRateLimit() {
    const selector = getBooruParam('upload')?.selector;
    const imagePostButton = selector ? $(selector) : null;
    if (!imagePostButton) return;
    const prop = imagePostButton instanceof HTMLButtonElement ? 'innerText' : 'value';
    const uploadLimiter = new RateLimiter('upload');
    const form = imagePostButton.closest('form');
    imagePostButton.dataset.ratelimited = '0';
    form.addEventListener(
      'submit',
      e => {
        e.preventDefault();
        const ratelimited = imagePostButton.dataset.ratelimited == '1';
        if (ratelimited || !form.reportValidity()) return;
        let abort = true;
        imagePostButton.disabled = true;
        imagePostButton.dataset.ratelimited = '1';
        uploadLimiter.initTicker(ticker(imagePostButton, prop));
        uploadLimiter.queueTask(() => {
          abort = false;
          imagePostButton[prop] = imagePostButton.dataset.disableWith;
          form.submit();
        });
        window.addEventListener(
          'unload',
          () => {
            if (uploadLimiter.state == TaskState.inactive) return;
            uploadLimiter.terminateTask(abort);
          },
          {passive: true}
        );
      },
      {capture: true}
    );
  }
  function initCommentRateLimit() {
    const selector = getBooruParam('comment')?.selector;
    const commentButton = selector ? $(selector) : null;
    if (!commentButton) return;
    const commentLimiter = new RateLimiter('comment');
    const form = commentButton.closest('form');
    const origText = commentButton.innerText;
    commentButton.dataset.ratelimited = '0';
    commentButton.addEventListener(
      'click',
      e => {
        const ratelimited = commentButton.dataset.ratelimited == '1';
        if (ratelimited) return;
        e.preventDefault();
        e.stopPropagation();
        commentButton.disabled = true;
        commentButton.dataset.ratelimited = '1';
        commentLimiter.initTicker(ticker(commentButton, 'innerText'));
        commentLimiter.queueTask(() => {
          commentButton.innerText = origText;
          commentButton.disabled = false;
          commentLimiter.clearTicker();
          commentButton.click();
          form.addEventListener(
            'fetchcomplete',
            () => {
              commentLimiter.terminateTask();
              commentButton.dataset.ratelimited = '0';
            },
            {once: true, passive: true}
          );
        });
        window.addEventListener(
          'unload',
          () => {
            if (commentLimiter.state == TaskState.inactive) return;
            commentLimiter.terminateTask(true);
            commentButton.dataset.ratelimited = '0';
          },
          {passive: true}
        );
      },
      {capture: true}
    );
  }
  function initTagRateLimit() {
    const selector = getBooruParam('tag')?.selector;
    if (!selector) return;
    NodeCreationObserver.onCreation(selector, tagEditButton => {
      const cancelButton = $('#tags-form button.js-tag-sauce-toggle');
      const prop = tagEditButton instanceof HTMLButtonElement ? 'innerText' : 'value';
      const tagLimiter = new RateLimiter('tag');
      const form = tagEditButton.closest('form');
      const origText = tagEditButton[prop];
      tagEditButton.dataset.ratelimited = '0';
      function reset(button) {
        button[prop] = origText;
        button.disabled = false;
      }
      tagEditButton.addEventListener(
        'click',
        e => {
          const ratelimited = tagEditButton.dataset.ratelimited == '1';
          if (ratelimited) return;
          e.preventDefault();
          e.stopPropagation();
          tagEditButton.disabled = true;
          tagEditButton.dataset.ratelimited = '1';
          tagLimiter.initTicker(ticker(tagEditButton, prop));
          tagLimiter.queueTask(() => {
            tagLimiter.clearTicker();
            reset(tagEditButton);
            tagEditButton.click();
            form.addEventListener(
              'fetchcomplete',
              () => {
                tagLimiter.terminateTask();
                tagEditButton.dataset.ratelimited = '0';
              },
              {once: true, passive: true}
            );
          });
        },
        {capture: true}
      );
      cancelButton.addEventListener(
        'click',
        e => {
          if (tagLimiter.state == TaskState.inactive) return;
          if (tagLimiter.state == TaskState.active) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          tagLimiter.terminateTask(true);
          reset(tagEditButton);
          tagEditButton.dataset.ratelimited = '0';
        },
        {capture: true}
      );
      window.addEventListener(
        'unload',
        () => {
          if (tagLimiter.state == TaskState.inactive || tagLimiter.state == TaskState.active)
            return;
          tagLimiter.terminateTask(true);
          reset(tagEditButton);
          tagEditButton.dataset.ratelimited = '0';
        },
        {passive: true}
      );
    });
  }
  function initForumPostLimit() {
    const selector = getBooruParam('forum')?.selector;
    const postButton = selector ? $(selector) : null;
    if (!postButton) return;
    const postLimiter = new RateLimiter('forum');
    const form = postButton.closest('form');
    postButton.dataset.ratelimited = '0';
    form.addEventListener(
      'submit',
      e => {
        e.preventDefault();
        const ratelimited = postButton.dataset.ratelimited == '1';
        if (ratelimited) return;
        let abort = true;
        postButton.disabled = true;
        postButton.dataset.ratelimited = '1';
        postLimiter.initTicker(ticker(postButton, 'innerText'));
        postLimiter.queueTask(() => {
          abort = false;
          postButton.value = postButton.dataset.disableWith;
          form.submit();
        });
        window.addEventListener(
          'unload',
          () => {
            if (postLimiter.state == TaskState.inactive) return;
            postLimiter.terminateTask(abort);
            postButton.dataset.ratelimited = '0';
          },
          {passive: true}
        );
      },
      {capture: true}
    );
  }
  function ticker(button, prop) {
    return (state, index, secondsRemaining) => {
      let message = null;
      if (state == TaskState.queued) message = `${index} pending...`;
      if (state == TaskState.pending) message = `${secondsRemaining}s`;
      if (message && button[prop] !== message) button[prop] = message;
    };
  }
  NodeCreationObserver.init('ratelimiter-observer');
  initUploadRateLimit();
  initCommentRateLimit();
  initTagRateLimit();
  initForumPostLimit();
})();
