import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Poem, getCollectionPoems } from './db';

const sanitizeFileName = (name: string) =>
  name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'poem';

// Exporter un seul poème
export async function sharePoemAsTxt(poem: Poem) {
  const fileName = `${sanitizeFileName(poem.title)}.txt`;
  const textContent = `${poem.title.toUpperCase()}\n\n${poem.content}\n`;

  // Création et écriture du fichier dans le cache avec la nouvelle API
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(textContent);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/plain',
      dialogTitle: 'Share Poem',
    });
  }
}

// Exporter un recueil entier
export async function shareCollectionAsTxt(collectionId: number, collectionTitle: string) {
  const poems = await getCollectionPoems(collectionId);
  if (poems.length === 0) return;

  const fileName = `${sanitizeFileName(collectionTitle)}_collection.txt`;
  const formattedPoems = poems
    .map((p) => `${p.title}\n\n${p.content}`)
    .join('\n\n\n* * *\n\n\n');

  const fullText = `=== ${collectionTitle.toUpperCase()} ===\n\n\n${formattedPoems}\n`;

  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(fullText);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/plain',
      dialogTitle: 'Export Collection',
    });
  }
}