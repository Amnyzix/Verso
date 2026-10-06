import * as SQLite from 'expo-sqlite';

export interface Poem {
  id: number;
  title: string;
  content: string;
  is_fragment: number; // 1 = fragment, 0 = poème complet
  created_at: string;
}

export interface Collection {
  id: number;
  title: string;
  description: string;
  poem_count?: number;
}

export const dbPromise = SQLite.openDatabaseAsync('poetry.db');

export async function initDatabase() {
  const db = await dbPromise;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS poems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_fragment INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS collection_poems (
      collection_id INTEGER NOT NULL,
      poem_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY (collection_id, poem_id),
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
      FOREIGN KEY (poem_id) REFERENCES poems(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

// --- Opérations sur les poèmes ---

export async function savePoem(title: string, content: string, isFragment: boolean): Promise<number> {
  const db = await dbPromise;
  const result = await db.runAsync(
    'INSERT INTO poems (title, content, is_fragment) VALUES (?, ?, ?)',
    [title.trim() || 'Untitled', content, isFragment ? 1 : 0]
  );
  return result.lastInsertRowId;
}

export async function updatePoem(
  id: number,
  title: string,
  content: string,
  isFragment: boolean
): Promise<void> {
  const db = await dbPromise;
  await db.runAsync(
    'UPDATE poems SET title = ?, content = ?, is_fragment = ? WHERE id = ?',
    [title.trim() || 'Untitled', content, isFragment ? 1 : 0, id]
  );
}

export async function deletePoem(id: number): Promise<void> {
  const db = await dbPromise;
  await db.runAsync('DELETE FROM poems WHERE id = ?', [id]);
}

export async function getPoems(): Promise<Poem[]> {
  const db = await dbPromise;
  return await db.getAllAsync<Poem>('SELECT * FROM poems ORDER BY created_at DESC');
}

// --- Opérations sur les recueils (Collections) ---

export async function getCollections(): Promise<Collection[]> {
  const db = await dbPromise;
  return await db.getAllAsync<Collection>(`
    SELECT c.*, COUNT(cp.poem_id) as poem_count
    FROM collections c
    LEFT JOIN collection_poems cp ON c.id = cp.collection_id
    GROUP BY c.id
    ORDER BY c.id DESC
  `);
}

export async function createCollection(title: string, description: string = ''): Promise<number> {
  const db = await dbPromise;
  const result = await db.runAsync(
    'INSERT INTO collections (title, description) VALUES (?, ?)',
    [title.trim() || 'Untitled Collection', description.trim()]
  );
  return result.lastInsertRowId;
}

export async function deleteCollection(id: number): Promise<void> {
  const db = await dbPromise;
  await db.runAsync('DELETE FROM collections WHERE id = ?', [id]);
}

export async function getCollectionPoems(collectionId: number): Promise<Poem[]> {
  const db = await dbPromise;
  return await db.getAllAsync<Poem>(
    `SELECT p.* FROM poems p
     INNER JOIN collection_poems cp ON p.id = cp.poem_id
     WHERE cp.collection_id = ?
     ORDER BY cp.position ASC`,
    [collectionId]
  );
}

export async function addPoemToCollection(collectionId: number, poemId: number) {
  const db = await dbPromise;
  const maxPos = await db.getFirstAsync<{ max_pos: number | null }>(
    'SELECT MAX(position) as max_pos FROM collection_poems WHERE collection_id = ?',
    [collectionId]
  );
  const nextPos = (maxPos?.max_pos ?? -1) + 1;
  await db.runAsync(
    'INSERT OR IGNORE INTO collection_poems (collection_id, poem_id, position) VALUES (?, ?, ?)',
    [collectionId, poemId, nextPos]
  );
}

export async function removePoemFromCollection(collectionId: number, poemId: number) {
  const db = await dbPromise;
  await db.runAsync(
    'DELETE FROM collection_poems WHERE collection_id = ? AND poem_id = ?',
    [collectionId, poemId]
  );
}

export async function updateCollectionOrder(collectionId: number, orderedPoems: Poem[]) {
  const db = await dbPromise;
  for (let i = 0; i < orderedPoems.length; i++) {
    await db.runAsync(
      'UPDATE collection_poems SET position = ? WHERE collection_id = ? AND poem_id = ?',
      [i, collectionId, orderedPoems[i].id]
    );
  }
}

export const updateCollection = async (
  id: number,
  title: string,
  description: string
): Promise<void> => {
  const db = await dbPromise;
  await db.runAsync(
    'UPDATE collections SET title = ?, description = ? WHERE id = ?',
    [title.trim() || 'Untitled', description.trim(), id]
  );
};

// --- Settings (Dark Mode Persistence) ---

export const getSetting = async (key: string): Promise<string | null> => {
  const db = await dbPromise;
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  return row ? row.value : null;
};

export const setSetting = async (key: string, value: string): Promise<void> => {
  const db = await dbPromise;
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, value]
  );
};

// --- Full JSON Backup & Restore ---

export interface BackupData {
  version: number;
  exported_at: string;
  poems: Poem[];
  collections: Collection[];
  collection_poems: { collection_id: number; poem_id: number; poem_order: number }[];
}

export const exportBackupData = async (): Promise<string> => {
  const db = await dbPromise;
  const poems = await db.getAllAsync<Poem>('SELECT * FROM poems');
  const collections = await db.getAllAsync<Collection>('SELECT * FROM collections');
  const collection_poems = await db.getAllAsync<any>('SELECT * FROM collection_poems');

  const payload = {
    version: 1,
    exported_at: new Date().toISOString(),
    poems,
    collections,
    collection_poems,
  };

  return JSON.stringify(payload, null, 2);
};

export const importBackupData = async (jsonString: string): Promise<{ poems: number; collections: number }> => {
  const db = await dbPromise;
  const data: BackupData = JSON.parse(jsonString);
  if (!data || !Array.isArray(data.poems) || !Array.isArray(data.collections)) {
    throw new Error('Invalid backup format');
  }

  const poemIdMap = new Map<number, number>();
  const colIdMap = new Map<number, number>();

  for (const p of data.poems) {
    const res = await db.runAsync(
      'INSERT INTO poems (title, content, is_fragment, created_at) VALUES (?, ?, ?, ?)',
      [p.title || 'Untitled', p.content || '', p.is_fragment ? 1 : 0, p.created_at || new Date().toISOString()]
    );
    poemIdMap.set(p.id, res.lastInsertRowId);
  }

  for (const c of data.collections) {
    const res = await db.runAsync(
      'INSERT INTO collections (title, description) VALUES (?, ?)',
      [c.title || 'Untitled', c.description || '']
    );
    colIdMap.set(c.id, res.lastInsertRowId);
  }

  if (Array.isArray(data.collection_poems)) {
    for (const cp of data.collection_poems) {
      const newColId = colIdMap.get(cp.collection_id);
      const newPoemId = poemIdMap.get(cp.poem_id);
      if (newColId && newPoemId) {
        await db.runAsync(
          'INSERT OR IGNORE INTO collection_poems (collection_id, poem_id, poem_order) VALUES (?, ?, ?)',
          [newColId, newPoemId, cp.poem_order ?? 0]
        );
      }
    }
  }

  return { poems: data.poems.length, collections: data.collections.length };
};
