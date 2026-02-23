import type { CustomCharacterDef } from '@pyrgo/shared';

const STORAGE_KEY = 'pyrgo_custom_characters';
const MAX_SLOTS = 6;

export class CharacterStorage {
  static getAll(): CustomCharacterDef[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as CustomCharacterDef[];
    } catch {
      return [];
    }
  }

  static get(index: number): CustomCharacterDef | null {
    if (index < 0) return null;
    const all = this.getAll();
    return all[index] ?? null;
  }

  static save(char: CustomCharacterDef, index?: number): boolean {
    const all = this.getAll();
    if (index !== undefined && index >= 0 && index < all.length) {
      all[index] = char;
    } else {
      if (all.length >= MAX_SLOTS) return false;
      all.push(char);
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      return true;
    } catch {
      return false;
    }
  }

  static delete(index: number): void {
    if (index < 0) return;
    const all = this.getAll();
    if (index >= all.length) return;
    all.splice(index, 1);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch {
      // silent — deletion is best-effort
    }
  }

  static count(): number {
    return this.getAll().length;
  }

  static isFull(): boolean {
    return this.count() >= MAX_SLOTS;
  }
}
