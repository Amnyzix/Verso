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

