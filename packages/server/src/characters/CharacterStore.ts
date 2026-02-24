import type { CustomCharacterDef } from '@pyrgo/shared';
import { CHARACTERS } from '@pyrgo/shared';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_FILE = resolve(__dirname, '../../data/characters.json');

export interface StoredCharacter extends CustomCharacterDef {
  serverId: string;
  createdAt: number;
}

const MAX_PUBLIC_PER_USER = 6;

export class CharacterStore {
  private characters: StoredCharacter[] = [];

  constructor() {
    this.load();
    this.seedDefaults();
  }

  private load(): void {
    try {
      if (existsSync(DATA_FILE)) {
        const raw = readFileSync(DATA_FILE, 'utf-8');
        this.characters = JSON.parse(raw);
      }
    } catch {
      this.characters = [];
    }
  }

  private save(): void {
    try {
      // Ensure directory exists
      const dir = dirname(DATA_FILE);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(DATA_FILE, JSON.stringify(this.characters, null, 2));
    } catch (err) {
      console.error('Failed to save characters:', err);
    }
  }

  getAll(): StoredCharacter[] {
    return this.characters.filter(c => c.isPublic).sort((a, b) => b.createdAt - a.createdAt);
  }

  getByAuthor(authorId: string): StoredCharacter[] {
    return this.characters.filter(c => c.creatorDeviceId === authorId);
  }

  getById(serverId: string): StoredCharacter | undefined {
    return this.characters.find(c => c.serverId === serverId);
  }

  publish(char: CustomCharacterDef): StoredCharacter | null {
    // Rate limit: max public per user
    const authorPublic = this.characters.filter(c => c.creatorDeviceId === char.creatorDeviceId && c.isPublic);
    if (authorPublic.length >= MAX_PUBLIC_PER_USER) {
      return null;
    }

    const stored: StoredCharacter = {
      ...char,
      serverId: this.generateId(),
      isPublic: true,
      createdAt: Date.now(),
    };

    this.characters.push(stored);
    this.save();
    return stored;
  }

  update(serverId: string, authorId: string, updates: { isPublic?: boolean }): StoredCharacter | null {
    const char = this.characters.find(c => c.serverId === serverId && c.creatorDeviceId === authorId);
    if (!char) return null;

    if (updates.isPublic !== undefined) {
      char.isPublic = updates.isPublic;
    }

    this.save();
    return char;
  }

  delete(serverId: string, authorId: string): boolean {
    const idx = this.characters.findIndex(c => c.serverId === serverId && c.creatorDeviceId === authorId);
    if (idx < 0) return false;

    // Protect system-seeded characters from deletion
    if (this.characters[idx].creatorDeviceId === 'system') return false;

    this.characters.splice(idx, 1);
    this.save();
    return true;
  }

  private seedDefaults(): void {
    const serverIds = ['system_canter', 'system_er_mancino', 'system_giorgito'];
    const seeds = CHARACTERS.map((char, i) => ({
      char,
      serverId: serverIds[i] ?? `system_${char.name.toLowerCase().replace(/\s/g, '_')}`,
    }));

    let changed = false;
    for (const { char, serverId } of seeds) {
      const exists = this.characters.some(
        c => c.name === char.name && c.creatorDeviceId === 'system'
      );
      if (!exists) {
        this.characters.push({
          ...char,
          appearance: char.appearance!,
          creatorDeviceId: 'system',
          isPublic: true,
          serverId,
          createdAt: Date.now(),
        });
        changed = true;
      }
    }
    if (changed) this.save();
  }

  private generateId(): string {
    return `char_${randomUUID()}`;
  }
}
