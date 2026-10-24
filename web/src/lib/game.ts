// Web <-> game contract (see docs/BRIEF.md §7). Canvas and Unity both implement this.

export type GameStats = { gravity: number; flapPower: number; hitbox: number }; // 100 = normal

export type GameStart = {
  tokenId: number;
  species: number;
  stats: GameStats;
  gameVersion: number; // 1 = canvas, 2 = unity
  spriteUrl?: string; // registered birds: pixel sprite made from the owner's photo
  spriteUpUrl?: string; // optional wings-up frame for spriteUrl
  seed?: string; // on-chain run seed (decimal uint256): drives the pipe gaps
  runId?: string; // on-chain run to submitRun() into; unset = guest / unverified practice
};

export type GameOver = { tokenId: number; score: number; durationMs: number };

export const GAME_VERSION_CANVAS = 1;
export const GAME_VERSION_RUN = 3; // submitRun: seeded run, time-checked on-chain
