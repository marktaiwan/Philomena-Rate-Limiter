import type {Brand} from '../types/project';

type InteractionType = 'upload' | 'comment' | 'tag' | 'forum';
type Uid = Brand<string, 'uid'>;

type BooruData = {
  [type in InteractionType]?: {
    readonly cooldown: number,
    readonly selector: string,
  }
}

type BooruKeys = [
  'derpibooru',
  'ponybooru',
  'ponerpics',
  'twibooru',
][number];

const SCRIPT_ID = 'rate-limiter';
const BUFFER = 500;

const philomenaDefaults: BooruData = {
  upload: {
    cooldown: 10_000,
    selector: 'form[action="/images"] button[type="submit"]',
  },
  comment: {
    cooldown: 30_000,
    selector: '#js-comment-form button[type="submit"]',
  },
  tag: {
    cooldown: 5000,
    selector: '#tags-form #edit_save_button',
  },
  forum: {
    cooldown: 30_000,
    selector: 'form[action$="/posts"][method="post"] button[type="submit"]',
  },
};

const boorus: Record<BooruKeys, Readonly<BooruData>> = {
  derpibooru: philomenaDefaults,
  ponybooru: philomenaDefaults,
  ponerpics: philomenaDefaults,
  twibooru: {
    upload: {
      cooldown: 10_000,
      selector: 'form#new_post input[name="commit"]',
    },
    comment: {
      cooldown: 30_000,
      selector: '#js-comment-form button[type="submit"]',
    },
    tag: {
      cooldown: 5000,
      selector: '#tags-form #edit_save_button',
    }
  },
};

export type {
  BooruData,
  BooruKeys,
  InteractionType,
  Uid,
};
export {
  SCRIPT_ID,
  BUFFER,
  boorus,
};
