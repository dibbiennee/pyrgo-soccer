import type { CustomCharacterDef } from '@pyrgo/shared';
import { getDeviceId } from '../storage/DeviceId';

const BASE_URL: string =
  (import.meta as any).env?.VITE_SERVER_URL ?? 'http://localhost:3001';

export interface PublishedCharacter extends CustomCharacterDef {
  serverId: string;
  createdAt: number;
}

export class CharacterApi {
  static async getPublic(): Promise<PublishedCharacter[]> {
    try {
      const res = await fetch(`${BASE_URL}/characters`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  static async publish(char: CustomCharacterDef): Promise<PublishedCharacter | null> {
    try {
      const res = await fetch(`${BASE_URL}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(char),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  static async toggleVisibility(serverId: string, isPublic: boolean): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/characters/${serverId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': getDeviceId(),
        },
        body: JSON.stringify({ isPublic }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  static async remove(serverId: string): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/characters/${serverId}`, {
        method: 'DELETE',
        headers: { 'x-device-id': getDeviceId() },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
