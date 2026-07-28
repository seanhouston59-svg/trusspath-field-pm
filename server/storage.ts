/**
 * Storage facade — kept as a module so every existing
 * `import { storage } from "./storage"` call site continues to work.
 *
 * The implementation lives in ./storage/, split per domain. See
 * ./storage/index.ts for the composition and ./storage/types.ts for IStorage.
 */
export {
  DatabaseStorage,
  storage,
  db,
  ensureReady,
  normalizeQuestion,
  tokenSimilarity,
  inferTopic,
  type IStorage,
} from "./storage/index";
