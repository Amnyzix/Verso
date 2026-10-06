# Verso

Verso is a minimalist, offline-first mobile application designed for writing poetry, capturing fleeting fragments, and assembling poems into formatted book collections.

Built with a focus on typography and simplicity, Verso provides a quiet digital notebook where writers can draft verses without distractions, organize their work over time, and export finished collections as printable books.

---

## Philosophy

Most note-taking applications treat poetry like standard prose or task lists. Verso is built around the natural workflow of a poet:
1. Capturing spontaneous lines and unfinished thoughts as **Fragments**.
2. Developing and refining full texts into **Finished Poems**.
3. Curating and ordering selected poems into cohesive **Collections** that read like a physical book.

All data stays strictly local on the device—no accounts, no cloud syncing, and no distractions.

---

## Core Features

### Writing and Organization
* **Distraction-Free Editor:** Clean serif typography designed specifically for verses and stanzas, keeping the interface out of the way while writing.
* **Poems and Fragments:** A dedicated toggle allows writers to distinguish between completed poems and rough drafts or isolated lines. The home screen can be filtered at any time to view all texts, finished poems only, or fragments only.
* **Full-Text Search:** Instant search across both poem titles and verse content to quickly locate any text or line.

### Collections and Book Reader
* **Curated Collections:** Poems can be grouped into thematic collections, each with its own title and optional preface or description.
* **Page-by-Page Book Reader:** Opening a collection presents it as a horizontal, swipeable book. It begins with a centered typographic **Cover Page** displaying the collection title, preface, and poem count, followed by one poem per page.
* **Custom Poem Ordering:** The sequence of poems within a collection can be rearranged at any time to build the exact narrative arc desired.
* **Seamless In-Reader Editing:** Poems and collection covers can be edited directly from the book reader. Saving changes returns the reader to the exact page that was open.

### Export and Publishing
* **Printable PDF Books (.pdf):** Individual poems can be exported as clean, single-page A4 PDF documents. Entire collections can be exported as complete, print-ready A4 PDF booklets featuring a cover page, an automatically generated table of contents, and numbered pages for each poem.
* **Plain Text Export (.txt):** Single poems and full collections can also be shared as formatted plain text files, preserving original titles and accents.

### Appearance and Data Ownership
* **Night Ink (Dark Mode):** A soft, low-contrast dark theme designed for comfortable reading and writing at night, saved persistently across sessions.
* **Full JSON Backup and Restore:** Because Verso operates completely offline using a local SQLite database, a built-in backup system allows exporting all poems, collections, and page orderings into a single `.json` file, which can be restored at any time.

---

## Built With

* React Native & Expo (TypeScript)
* SQLite (`expo-sqlite`) for local storage
* Expo Print & Sharing (`expo-print`, `expo-file-system`, `expo-sharing`) for PDF, TXT, and JSON exports