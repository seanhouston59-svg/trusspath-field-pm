import { jarvisMemory } from '@shared/schema';
import type { Project, JarvisMemory, InsertJarvisMemory } from '@shared/schema';
import { eq } from "drizzle-orm";
import { db } from "./db";
import { ensureReady } from "./ready";

export class JarvisRepo {
  async getJarvisMemories(projectId?: number): Promise<JarvisMemory[]> {
    await ensureReady();
    if (projectId != null) {
      return await db.select().from(jarvisMemory).where(eq(jarvisMemory.projectId, projectId));
    }
    return await db.select().from(jarvisMemory);
  }

  async searchJarvisMemory(query: string, projectId?: number): Promise<JarvisMemory | undefined> {
    await ensureReady();
    const normalized = normalizeQuestion(query);
    const all = await db.select().from(jarvisMemory);
    // Filter to learned answers, prefer project-scoped then global
    const learned = all.filter((m) => m.status === "learned" && m.answer);
    if (!learned.length) return undefined;
    const scoped = projectId != null
      ? learned.filter((m) => m.projectId === projectId || m.projectId === null)
      : learned;
    // Score by token overlap
    let best: { memory: JarvisMemory; score: number } | null = null;
    for (const m of scoped) {
      const score = tokenSimilarity(normalized, m.normalizedQuestion);
      if (!best || score > best.score) best = { memory: m, score };
    }
    if (best && best.score > 0.2) {
      await this.incrementJarvisMemoryHit(best.memory.id);
      return best.memory;
    }
    return undefined;
  }

  async createJarvisMemory(data: InsertJarvisMemory): Promise<JarvisMemory> {
    await ensureReady();
    const now = new Date().toISOString();
    const [row] = await db.insert(jarvisMemory).values({
      ...data,
      normalizedQuestion: data.normalizedQuestion || normalizeQuestion(data.question),
      createdAt: now,
      updatedAt: now,
    }).returning();
    return row;
  }

  async updateJarvisMemory(id: number, data: Partial<InsertJarvisMemory>): Promise<JarvisMemory | undefined> {
    await ensureReady();
    const now = new Date().toISOString();
    const [row] = await db.update(jarvisMemory).set({
      ...data,
      updatedAt: now,
    }).where(eq(jarvisMemory.id, id)).returning();
    return row;
  }

  async incrementJarvisMemoryHit(id: number): Promise<void> {
    await ensureReady();
    const rows = await db.select().from(jarvisMemory).where(eq(jarvisMemory.id, id));
    if (rows[0]) {
      await db.update(jarvisMemory).set({
        hitCount: (rows[0].hitCount || 0) + 1,
        updatedAt: new Date().toISOString(),
      }).where(eq(jarvisMemory.id, id));
    }
  }

  async deleteJarvisMemory(id: number): Promise<void> {
    await ensureReady();
    await db.delete(jarvisMemory).where(eq(jarvisMemory.id, id));
  }

  /* ---------------------- Project Timeline / event log --------------------- */

  /**
   * Append one row to the project timeline. Called from mutation routes
   * (fire-and-forget — the caller doesn't await the result on the critical
   * path). Never throws — timeline logging failure should never break a real
   * mutation. Any DB error is swallowed and logged to console.
   *
   * Callers pass a minimal payload; we fill in defaults (occurredAt = now,
   * meta = {}).
   */
}

/* ----------------------- Jarvis memory helpers ------------------------ */

// Normalize a question for matching: lowercase, strip punctuation,
// remove filler words, collapse whitespace.
export function normalizeQuestion(q: string): string {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "what", "whats", "what's",
    "where", "wheres", "where's", "how", "do", "does", "can", "could", "would",
    "should", "i", "you", "me", "we", "they", "it", "to", "of", "in", "on",
    "at", "for", "and", "or", "but", "so", "if", "then", "tell", "about",
    "give", "some", "good", "best", "near", "by", "my", "our", "this", "that",
    "there", "here", "with", "from", "as", "be", "been", "have", "has",
  ]);
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w))
    .join(" ")
    .trim();
}

// Simple token overlap similarity (Jaccard). Returns 0-1.
export function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(a.split(/\s+/).filter(Boolean));
  const tb = new Set(b.split(/\s+/).filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let overlap = 0;
  ta.forEach((t) => { if (tb.has(t)) overlap++; });
  return overlap / Math.max(ta.size, tb.size);
}

// Infer a topic from a question for categorization.
export function inferTopic(q: string): string | null {
  const lower = q.toLowerCase();
  if (/lunch|food|eat|restaurant|hungry|dinner|breakfast|coffee/.test(lower)) return "lunch";
  if (/weather|rain|snow|wind|storm|temperature|forecast/.test(lower)) return "weather";
  if (/safety|osha|safe|ppe|harness|fall|trench|excavat/.test(lower)) return "safety";
  if (/supplier|vendor|material|deliver/.test(lower)) return "suppliers";
  if (/subcontractor|sub|trade|electrician|plumber|hvac/.test(lower)) return "subcontractors";
  if (/hotel|motel|lodging|stay|accommodation/.test(lower)) return "lodging";
  if (/hardware|store|supply|home depot|lowes/.test(lower)) return "hardware";
  if (/dump|disposal|landfill|recycle/.test(lower)) return "disposal";
  if (/permit|inspection|city|county|jurisdiction/.test(lower)) return "permits";
  return null;
}
