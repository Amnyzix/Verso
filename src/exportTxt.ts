import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Poem, getCollectionPoems } from './db';
import { exportBackupData, Collection } from './db';
import * as Print from 'expo-print';

const sanitizeFileName = (name: string) =>
  name
    .replace(/[/\\?%*:|"<>]/g, '') // Supprime uniquement les caractères interdits par l'OS
    .replace(/\s+/g, ' ')          // Remplace les doubles espaces ou sauts de ligne par un espace propre
    .trim() || 'Poem';

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
  console.log("test");
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



export const shareFullBackupAsJson = async () => {
  const json = await exportBackupData();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
  const fileName = `verso_backup_${dateStr}.json`;

  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(json);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Export Backup',
    });
  }
};


const escapeHtml = (str?: string | null) =>
  String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Exporter un seul poème en PDF
export async function sharePoemAsPdf(poem: Poem) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page { margin: 25mm 20mm; }
          body {
            font-family: Georgia, 'Times New Roman', serif;
            color: #1E1E1E;
            line-height: 1.75;
          }
          h1 {
            font-size: 24pt;
            text-align: center;
            margin-top: 15mm;
            margin-bottom: 5mm;
            font-weight: bold;
          }
          .divider {
            width: 40px;
            height: 2px;
            background-color: #D4D0C8;
            margin: 0 auto 14mm auto;
          }
          .content {
            font-size: 12.5pt;
            white-space: pre-wrap;
            max-width: 460px;
            margin: 0 auto;
          }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(poem.title)}</h1>
        <div class="divider"></div>
        <div class="content">${escapeHtml(poem.content)}</div>
      </body>
    </html>
  `;

  const { base64 } = await Print.printToFileAsync({ html, base64: true });
  const fileName = `${sanitizeFileName(poem.title)}.pdf`;
  const pdfFile = new File(Paths.cache, fileName);
  pdfFile.create({ overwrite: true });
  if (base64) {
    pdfFile.write(base64, { encoding: 'base64' });
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(pdfFile.uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share Poem (.pdf)',
    });
  }
}

// Exporter un recueil complet en livre PDF (Page de garde + Sommaire + 1 poème par page)
export async function shareCollectionAsPdf(collection: Collection) {
  const poems = await getCollectionPoems(collection.id);
  if (poems.length === 0) return;

  const tocItemsHtml = poems
    .map(
      (p, i) => `
      <div class="toc-row">
        <span class="toc-num">${i + 1}.</span>
        <span class="toc-title">${escapeHtml(p.title)}</span>
      </div>`
    )
    .join('');

  const poemsPagesHtml = poems
    .map(
      (p, i) => `
      <div class="page poem-page">
        <div class="poem-body">
          <h2 class="poem-title">${escapeHtml(p.title)}</h2>
          <div class="divider"></div>
          <div class="poem-content">${escapeHtml(p.content)}</div>
        </div>
        <div class="page-number">${i + 1}</div>
      </div>`
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          @page {
            size: A4;
            margin: 22mm 20mm;
          }
          body {
            font-family: Georgia, 'Times New Roman', serif;
            color: #1E1E1E;
            margin: 0;
            padding: 0;
          }
          .page {
            page-break-after: always;
            break-after: page;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 240mm;
            box-sizing: border-box;
          }
          .page:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          /* Page de garde */
          .cover {
            justify-content: center;
            align-items: center;
            text-align: center;
          }
          .cover-title {
            font-size: 32pt;
            font-weight: bold;
            margin-bottom: 6mm;
            letter-spacing: 0.5px;
          }
          .divider {
            width: 45px;
            height: 2px;
            background-color: #D4D0C8;
            margin: 0 auto 10mm auto;
          }
          .cover-desc {
            font-size: 13pt;
            font-style: italic;
            color: #555555;
            max-width: 380px;
            line-height: 1.6;
            white-space: pre-wrap;
          }
          /* Sommaire */
          .toc-page {
            justify-content: flex-start;
          }
          .toc-header {
            font-size: 16pt;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-top: 10mm;
            margin-bottom: 12mm;
            color: #444;
          }
          .toc-list {
            width: 100%;
            max-width: 400px;
            margin: 0 auto;
          }
          .toc-row {
            padding: 3mm 0;
            border-bottom: 1px dotted #E0E0E0;
            font-size: 12pt;
          }
          .toc-num {
            color: #888;
            display: inline-block;
            width: 28px;
          }
          /* Pages de poèmes */
          .poem-page {
            padding-top: 6mm;
          }
          .poem-body {
            flex: 1;
          }
          .poem-title {
            font-size: 20pt;
            text-align: center;
            margin-top: 0;
            margin-bottom: 5mm;
          }
          .poem-content {
            font-size: 12.5pt;
            line-height: 1.75;
            white-space: pre-wrap;
            max-width: 450px;
            margin: 0 auto;
          }
          .page-number {
            text-align: center;
            font-size: 10pt;
            color: #888;
            font-style: italic;
            padding-top: 8mm;
          }
        </style>
      </head>
      <body>
        <!-- 1. Page de garde -->
        <div class="page cover">
          <div class="cover-title">${escapeHtml(collection.title)}</div>
          <div class="divider"></div>
          ${
            collection.description
              ? `<div class="cover-desc">${escapeHtml(collection.description)}</div>`
              : ''
          }
        </div>

        <!-- 2. Table des matières -->
        <div class="page toc-page">
          <div class="toc-header">Contents</div>
          <div class="toc-list">${tocItemsHtml}</div>
        </div>

        <!-- 3. Poèmes (1 par page) -->
        ${poemsPagesHtml}
      </body>
    </html>
  `;

  const { base64 } = await Print.printToFileAsync({ html, base64: true });
  if (!base64) throw new Error('Could not generate PDF data');

  const fileName = `${sanitizeFileName(collection.title)}.pdf`;
  const pdfFile = new File(Paths.cache, fileName);
  pdfFile.create({ overwrite: true });
  pdfFile.write(base64, { encoding: 'base64' });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(pdfFile.uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Export Collection (.pdf)',
    });
  }
}