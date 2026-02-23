import { Router } from 'express';
import type { CustomCharacterDef } from '@pyrgo/shared';
import {
  FACE_SHAPES, HAIR_STYLES, EYE_STYLES, BEARD_STYLES,
  SKIN_TONES, HAIR_COLORS, JERSEY_COLORS, SUPER_MOVES,
} from '@pyrgo/shared';
import { CharacterStore } from './CharacterStore.js';

const VALID_FACE_SHAPES = new Set(FACE_SHAPES);
const VALID_HAIR_STYLES = new Set(HAIR_STYLES);
const VALID_EYE_STYLES = new Set(EYE_STYLES);
const VALID_BEARD_STYLES = new Set(BEARD_STYLES);
const VALID_SUPER_IDS = new Set(SUPER_MOVES.map(m => m.id));

const STAT_MIN = 2;
const STAT_MAX = 8;
const STAT_TOTAL = 15;
const NAME_MAX_LEN = 10;

function stripHtml(str: string): string {
  return str.replace(/[<>&"']/g, (ch) => {
    switch (ch) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return ch;
    }
  });
}

function validateCharacter(data: any): string | null {
  if (!data || typeof data !== 'object') return 'Invalid body';
  if (!data.creatorDeviceId || typeof data.creatorDeviceId !== 'string') return 'Missing creatorDeviceId';

  // Name
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (name.length === 0 || name.length > NAME_MAX_LEN) return `Name must be 1-${NAME_MAX_LEN} characters`;

  // Stats
  const stats = data.stats;
  if (!stats || typeof stats !== 'object') return 'Missing stats';
  for (const key of ['speed', 'power', 'defense'] as const) {
    const v = stats[key];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < STAT_MIN || v > STAT_MAX) {
      return `stats.${key} must be integer ${STAT_MIN}-${STAT_MAX}`;
    }
  }
  if (stats.speed + stats.power + stats.defense > STAT_TOTAL) {
    return `Total stats must be <= ${STAT_TOTAL}`;
  }

  // Super move
  if (!VALID_SUPER_IDS.has(data.superMove)) return 'Invalid superMove';

  // Appearance
  const app = data.appearance;
  if (!app || typeof app !== 'object') return 'Missing appearance';
  if (!VALID_FACE_SHAPES.has(app.faceShape)) return 'Invalid faceShape';
  if (!VALID_HAIR_STYLES.has(app.hairStyle)) return 'Invalid hairStyle';
  if (!VALID_EYE_STYLES.has(app.eyeStyle)) return 'Invalid eyeStyle';
  if (!VALID_BEARD_STYLES.has(app.beard)) return 'Invalid beard';
  if (typeof app.hairColor !== 'number') return 'Invalid hairColor';
  if (typeof app.skinTone !== 'number') return 'Invalid skinTone';
  if (typeof app.jerseyColor1 !== 'number') return 'Invalid jerseyColor1';
  if (typeof app.jerseyColor2 !== 'number') return 'Invalid jerseyColor2';
  if (typeof app.jerseyNumber !== 'number' || app.jerseyNumber < 1 || app.jerseyNumber > 99) {
    return 'jerseyNumber must be 1-99';
  }

  return null; // valid
}

// Simple in-memory rate limiter per IP
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_POST = 10;
const RATE_MAX_GET = 60;

function checkRate(ip: string, max: number): boolean {
  const now = Date.now();
  let entry = rateLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateLimits.set(ip, entry);
  }
  entry.count++;
  return entry.count <= max;
}

export function createCharacterRoutes(store: CharacterStore): Router {
  const router = Router();

  // GET /characters — list all public characters
  router.get('/', (req, res) => {
    const ip = req.ip ?? 'unknown';
    if (!checkRate(ip, RATE_MAX_GET)) {
      res.status(429).json({ error: 'Rate limit exceeded' });
      return;
    }
    const chars = store.getAll();
    res.json(chars);
  });

  // POST /characters — publish a character
  router.post('/', (req, res) => {
    const ip = req.ip ?? 'unknown';
    if (!checkRate(ip, RATE_MAX_POST)) {
      res.status(429).json({ error: 'Rate limit exceeded' });
      return;
    }

    const error = validateCharacter(req.body);
    if (error) {
      res.status(400).json({ error });
      return;
    }

    // Sanitize name
    const charData = req.body as CustomCharacterDef;
    charData.name = stripHtml(charData.name.trim());

    const stored = store.publish(charData);
    if (!stored) {
      res.status(429).json({ error: 'Max 6 public characters per user' });
      return;
    }

    res.status(201).json(stored);
  });

  // PATCH /characters/:id — toggle visibility
  router.patch('/:id', (req, res) => {
    const { id } = req.params;
    const authorId = req.headers['x-device-id'] as string;

    if (!authorId) {
      res.status(401).json({ error: 'Missing x-device-id header' });
      return;
    }

    const updates = req.body as { isPublic?: boolean };
    if (typeof updates.isPublic !== 'boolean') {
      res.status(400).json({ error: 'isPublic must be boolean' });
      return;
    }

    const updated = store.update(id, authorId, updates);
    if (!updated) {
      res.status(404).json({ error: 'Character not found or not yours' });
      return;
    }

    res.json(updated);
  });

  // DELETE /characters/:id
  router.delete('/:id', (req, res) => {
    const { id } = req.params;
    const authorId = req.headers['x-device-id'] as string;

    if (!authorId) {
      res.status(401).json({ error: 'Missing x-device-id header' });
      return;
    }

    const deleted = store.delete(id, authorId);
    if (!deleted) {
      res.status(404).json({ error: 'Character not found or not yours' });
      return;
    }

    res.json({ ok: true });
  });

  return router;
}
