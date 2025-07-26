import type NodeCreationObserverInterface from '../types/NodeCreationObserver';
import {getBooruParam} from './datastore';
import {RateLimiter, TaskState} from './RateLimiter';
import {$} from './util';

declare const NodeCreationObserver: NodeCreationObserverInterface;

function initUploadRateLimit(): void {
  const selector = getBooruParam('upload')?.selector;
  const imagePostButton = (selector) ? $<HTMLButtonElement | HTMLInputElement>(selector) : null;
  if (!imagePostButton) return;

  const prop = (imagePostButton instanceof HTMLButtonElement) ? 'innerText' : 'value';
  const uploadLimiter = new RateLimiter('upload');
  const form = imagePostButton.closest('form');
  imagePostButton.dataset.ratelimited = '0';

  form?.addEventListener('submit', e => {
    e.preventDefault();
    const ratelimited = (imagePostButton.dataset.ratelimited == '1');
    if (ratelimited || !form.reportValidity()) return;

    let abort = true;
    imagePostButton.disabled = true;
    imagePostButton.dataset.ratelimited = '1';

    uploadLimiter.initTicker(ticker(imagePostButton, prop));

    uploadLimiter.queueTask(() => {
      abort = false;
      imagePostButton[prop] = imagePostButton.dataset.disableWith ?? imagePostButton[prop];
      form.submit();
    });

    window.addEventListener('unload', () => {
      if (uploadLimiter.state == TaskState.inactive) return;
      uploadLimiter.terminateTask(abort);
    }, {passive: true});
  }, {capture: true});
}

function initCommentRateLimit(): void {
  const selector = getBooruParam('comment')?.selector;
  const commentButton = (selector) ? $<HTMLButtonElement>(selector) : null;
  if (!commentButton) return;
  const commentLimiter = new RateLimiter('comment');
  const form = commentButton.closest('form')!;
  const origText = commentButton.innerText;
  commentButton.dataset.ratelimited = '0';

  commentButton.addEventListener('click', e => {
    const ratelimited = (commentButton.dataset.ratelimited == '1');
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
      form.addEventListener('fetchcomplete', () => {
        commentLimiter.terminateTask();
        commentButton.dataset.ratelimited = '0';
      }, {once: true, passive: true});
    });

    window.addEventListener('unload', () => {
      if (commentLimiter.state == TaskState.inactive) return;
      commentLimiter.terminateTask(true);
      commentButton.dataset.ratelimited = '0';
    }, {passive: true});
  }, {capture: true});
}

function initTagRateLimit(): void {
  const selector = getBooruParam('tag')?.selector;
  if (!selector) return;
  NodeCreationObserver.onCreation<HTMLButtonElement | HTMLInputElement>(selector, tagEditButton => {
    const cancelButton = $<HTMLButtonElement>('#tags-form button.js-tag-sauce-toggle');
    const prop = (tagEditButton instanceof HTMLButtonElement) ? 'innerText' : 'value';
    const tagLimiter = new RateLimiter('tag');
    const form = tagEditButton.closest('form');
    const origText = tagEditButton[prop];
    if (!cancelButton || !form) return;

    tagEditButton.dataset.ratelimited = '0';

    function reset(button: typeof tagEditButton): void {
      button[prop] = origText;
      button.disabled = false;
    }

    tagEditButton.addEventListener('click', e => {
      const ratelimited = (tagEditButton.dataset.ratelimited == '1');
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
        form.addEventListener('fetchcomplete', () => {
          tagLimiter.terminateTask();
          tagEditButton.dataset.ratelimited = '0';
        }, {once: true, passive: true});
      });
    }, {capture: true});

    cancelButton.addEventListener('click', e => {
      if (tagLimiter.state == TaskState.inactive) return;
      if (tagLimiter.state == TaskState.active) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      tagLimiter.terminateTask(true);
      reset(tagEditButton);
      tagEditButton.dataset.ratelimited = '0';
    }, {capture: true});

    window.addEventListener('unload', () => {
      if (tagLimiter.state == TaskState.inactive
        || tagLimiter.state == TaskState.active) return;
      tagLimiter.terminateTask(true);
      reset(tagEditButton);
      tagEditButton.dataset.ratelimited = '0';
    }, {passive: true});
  });
}

function initForumPostLimit(): void {
  const selector = getBooruParam('forum')?.selector;
  const postButton = (selector) ? $<HTMLButtonElement>(selector) : null;
  if (!postButton) return;

  const postLimiter = new RateLimiter('forum');
  const form = postButton.closest('form')!;
  postButton.dataset.ratelimited = '0';

  form.addEventListener('submit', e => {
    e.preventDefault();
    const ratelimited = (postButton.dataset.ratelimited == '1');
    if (ratelimited) return;

    let abort = true;
    postButton.disabled = true;
    postButton.dataset.ratelimited = '1';

    postLimiter.initTicker(ticker(postButton, 'innerText'));

    postLimiter.queueTask(() => {
      abort = false;
      postButton.value = postButton.dataset.disableWith ?? postButton.value;
      form.submit();
    });

    window.addEventListener('unload', () => {
      if (postLimiter.state == TaskState.inactive) return;
      postLimiter.terminateTask(abort);
      postButton.dataset.ratelimited = '0';
    }, {passive: true});
  }, {capture: true});
}

function ticker<
  T extends HTMLElement,
  K extends keyof T
>(
  button: T,
  prop: T[K] extends string ? K : never
) {
  return (state: TaskState, index: number, secondsRemaining: number) => {
    let message = '';
    if (state == TaskState.queued) message = `${index} pending...`;
    if (state == TaskState.pending) message = `${secondsRemaining}s`;
    if (message && button[prop] !== message) (button[prop] as string) = message;
  };
}

NodeCreationObserver.init('ratelimiter-observer');
initUploadRateLimit();
initCommentRateLimit();
initTagRateLimit();
initForumPostLimit();
