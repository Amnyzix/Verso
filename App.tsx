import React, { useEffect, useState, useMemo } from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import { initDatabase, getPoems, getCollections, Poem, Collection, getSetting, setSetting} from './src/db';
import { lightTheme, darkTheme, getStyles } from './src/theme';
import HomeView from './src/components/HomeView';
import PoemEditorView from './src/components/PoemEditorView';
import CollectionCreateView from './src/components/CollectionCreateView';
import CollectionReaderView from './src/components/CollectionReaderView';

export default function App() {
  // Thème
  const [isDarkMode, setIsDarkMode] = useState(false);
  const theme = isDarkMode ? darkTheme : lightTheme;
  const styles = useMemo(() => getStyles(theme), [isDarkMode]);

  // Données
  const [poems, setPoems] = useState<Poem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  // Navigation
  const [activeTab, setActiveTab] = useState<'poems' | 'collections'>('poems');
  const [isWriting, setIsWriting] = useState(false);
  const [editingPoem, setEditingPoem] = useState<Poem | null>(null);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [readerPage, setReaderPage] = useState(0);

  const loadAllData = async () => {
    const [poemsData, collectionsData] = await Promise.all([getPoems(), getCollections()]);
    setPoems(poemsData);
    setCollections(collectionsData);
  };

  useEffect(() => {
      initDatabase()
        .then(async () => {
          console.log('Database initialized');
          const savedTheme = await getSetting('dark_mode');
          if (savedTheme !== null) {
            setIsDarkMode(savedTheme === '1');
          }
          await loadAllData();
        })
        .catch((err) => console.error('DB Error:', err));
    }, []);

  const handleToggleTheme = async () => {
      const nextValue = !isDarkMode;
      setIsDarkMode(nextValue);
      await setSetting('dark_mode', nextValue ? '1' : '0');
    };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
      />

      {isWriting ? (
        <PoemEditorView
          initialPoem={editingPoem}
          theme={theme}
          onClose={async () => {
            setIsWriting(false);
            setEditingPoem(null);
            await loadAllData();
          }}
        />
      ) : isCreatingCollection ? (
        <CollectionCreateView
          poems={poems}
          theme={theme}
          onCancel={() => setIsCreatingCollection(false)}
          onCreated={async (newCol) => {
            setIsCreatingCollection(false);
            await loadAllData();
            setReaderPage(0);
            setSelectedCollection(newCol);
          }}
        />
      ) : selectedCollection ? (
        <CollectionReaderView
          collection={selectedCollection}
          allPoems={poems}
          initialPage={readerPage}
          onPageChange={setReaderPage}
          theme={theme}
          onDataChange={loadAllData}
          onEditPoem={(poem) => {
            setEditingPoem(poem);
            setIsWriting(true);
          }}
          onUpdateCollectionMeta={(updatedCol) => setSelectedCollection(updatedCol)}
          onClose={async () => {
            setSelectedCollection(null);
            await loadAllData();
          }}
        />
      ) : (
        <HomeView
          poems={poems}
          collections={collections}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isDarkMode={isDarkMode}
          onToggleTheme={handleToggleTheme}
          onDataRestored={loadAllData}
          onNewPoem={() => {
            setEditingPoem(null);
            setIsWriting(true);
          }}
          onEditPoem={(poem) => {
            setEditingPoem(poem);
            setIsWriting(true);
          }}
          onNewCollection={() => setIsCreatingCollection(true)}
          onOpenCollection={(col) =>{
            setReaderPage(0);
            setSelectedCollection(col);}}
          theme={theme}
        />
      )}
    </SafeAreaView>
  );
}