// Web <-> game contract (see docs/BRIEF.md §7). Canvas and Unity both implement this.

export type GameStats = { gravity: number; flapPower: number; hitbox: number }; // 100 = normal

export type GameStart = {
  tokenId: number;
  species: number;
  stats: GameStats;
  gameVersion: number; // 1 = canvas, 2 = unity
  spriteUrl?: string; // registered birds: pixel sprite made from the owner's photo
};

export type GameOver = { tokenId: number; score: number; durationMs: number };

export const GAME_VERSION_CANVAS = 1;
