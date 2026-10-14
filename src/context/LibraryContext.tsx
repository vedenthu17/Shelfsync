import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Database } from '@/types';
import { createSeedDatabase, SEED_VERSION } from '@/data/seed';
import { runSystemSweep } from '@/domain/actions';

// The mock service layer. It holds the whole database in memory, persists it to
// localStorage, and routes every write through the pure functions in
// src/domain/actions.ts. Replacing this provider with one that calls the REST
// API (docs/API.md) is the only change needed to go live.

const STORAGE_KEY = 'shelfsync:db';

interface LibraryContextValue {
  db: Database;
  /** Run an action that returns `{ db, ...result }` and commit the new database. */
  apply: <T extends { db: Database }>(action: (db: Database) => T) => T;
  /** Run an action that returns just the new database. */
  update: (action: (db: Database) => Database) => void;
  resetDemoData: () => void;
  /** Swap in a whole database, e.g. one read from a backup file. */
  replaceData: (db: Database) => void;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

function load(): Database {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as { version: string; db: Database };
      if (stored.version === SEED_VERSION) return runSystemSweep(stored.db);
    }
  } catch {
    // Unreadable or blocked storage: fall through to a fresh seed.
  }
  return runSystemSweep(createSeedDatabase());
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database>(load);
  // Actions read the latest database from a ref so two writes in one event
  // handler build on each other instead of on the same stale render.
  const latest = useRef(db);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SEED_VERSION, db }));
    } catch {
      // Quota exceeded (e.g. many uploaded images): keep working in memory.
    }
  }, [db]);

  const commit = useCallback((next: Database) => {
    latest.current = next;
    setDb(next);
  }, []);

  const value = useMemo<LibraryContextValue>(
    () => ({
      db,
      apply: (action) => {
        const result = action(latest.current);
        commit(result.db);
        return result;
      },
      update: (action) => commit(action(latest.current)),
      resetDemoData: () => commit(runSystemSweep(createSeedDatabase())),
      replaceData: (next) => commit(runSystemSweep(next)),
    }),
    [db, commit],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used inside LibraryProvider');
  return ctx;
}
