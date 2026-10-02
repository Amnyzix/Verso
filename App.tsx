import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  FlatList, SafeAreaView, Switch, StatusBar, Alert, Modal,
  Pressable, BackHandler, ScrollView, useWindowDimensions, Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  initDatabase, savePoem, updatePoem, deletePoem, getPoems,
  getCollections, createCollection, deleteCollection, getCollectionPoems,
  addPoemToCollection, removePoemFromCollection, updateCollectionOrder,
  Poem, Collection
} from './src/db';
import { sharePoemAsTxt, shareCollectionAsTxt } from './src/exportTxt';

export default function App() {
  const { width: screenWidth } = useWindowDimensions();
  const readerRef = useRef<FlatList<Poem>>(null);

  // Navigation & Modes
  const [activeTab, setActiveTab] = useState<'poems' | 'collections'>('poems');
  const [isWriting, setIsWriting] = useState(false);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [isManagingCollection, setIsManagingCollection] = useState(false);

  // Data
  const [poems, setPoems] = useState<Poem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionPoems, setCollectionPoems] = useState<Poem[]>([]);
  const [currentPage, setCurrentPage] = useState(0);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [poemFilter, setPoemFilter] = useState<'all' | 'poems' | 'fragments'>('all');

  const filteredPoems = poems.filter((poem) => {
    const matchesFilter =
      poemFilter === 'all' ||
      (poemFilter === 'poems' && poem.is_fragment === 0) ||
      (poemFilter === 'fragments' && poem.is_fragment === 1);

    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      poem.title.toLowerCase().includes(q) ||
      poem.content.toLowerCase().includes(q);

    return matchesFilter && matchesSearch;
  });

  // Poem Editor State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isFragment, setIsFragment] = useState(false);
  const [initialState, setInitialState] = useState({ title: '', content: '', isFragment: false });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Collection Builder State
  const [newColTitle, setNewColTitle] = useState('');
  const [newColDesc, setNewColDesc] = useState('');
  const [selectedPoemIds, setSelectedPoemIds] = useState<number[]>([]);

  // Dropdown Menus
  const [menuVisible, setMenuVisible] = useState(false);
  const [collectionMenuVisible, setCollectionMenuVisible] = useState(false);

  // Keyboard state
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const isKeyboardVisible = keyboardHeight > 0;



  // Auto-save en temps réel (800ms après la dernière frappe)
  useEffect(() => {
    if (!isWriting) return;

    const changed =
      title !== initialState.title ||
      content !== initialState.content ||
      isFragment !== initialState.isFragment;

    if (!changed) return;

    // Ne rien sauvegarder tant qu'un nouveau poème est totalement vide
    if (editingId === null && !content.trim() && !title.trim()) return;

    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        if (editingId !== null) {
          await updatePoem(editingId, title, content, isFragment);
        } else {
          const newId = await savePoem(title, content, isFragment);
          setEditingId(newId);
        }
        setInitialState({ title, content, isFragment });
        setSaveStatus('saved');
      } catch (err) {
        console.error('Auto-save error:', err);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [title, content, isFragment, isWriting, editingId, initialState]);

  // Masque automatiquement le message "Saved" après 1.2 seconde
  useEffect(() => {
    if (saveStatus === 'saved') {
      const hideTimer = setTimeout(() => {
        setSaveStatus('idle');
      }, 400);
      return () => clearTimeout(hideTimer);
    }
  }, [saveStatus]);

  // Récupère la hauteur exacte du clavier Android pour remonter la zone de texte
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    initDatabase()
      .then(loadAllData)
      .catch((err) => console.error('DB Error:', err));
  }, []);

  // Handle Android Hardware Back Button
  useEffect(() => {
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isWriting) {
        handleBackPress();
        return true;
      }
      if (isManagingCollection) {
        setIsManagingCollection(false);
        return true;
      }
      if (selectedCollection) {
        setSelectedCollection(null);
        loadAllData();
        return true;
      }
      if (isCreatingCollection) {
        setIsCreatingCollection(false);
        return true;
      }
      return false;
    });
    return () => backSub.remove();
  }, [isWriting, isManagingCollection, selectedCollection, isCreatingCollection, title, content, isFragment, initialState]);

  const loadAllData = async () => {
    const [poemsData, collectionsData] = await Promise.all([getPoems(), getCollections()]);
    setPoems(poemsData);
    setCollections(collectionsData);
    if (selectedCollection) {
      const colPoems = await getCollectionPoems(selectedCollection.id);
      setCollectionPoems(colPoems);
    }
  };

  // --- Poem Editor Functions ---

  const hasUnsavedChanges = () =>
    title !== initialState.title ||
    content !== initialState.content ||
    isFragment !== initialState.isFragment;

  const startNewPoem = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setIsFragment(false);
    setInitialState({ title: '', content: '', isFragment: false });
    setSaveStatus('idle');
    setIsWriting(true);
  };

  const openPoemForEdit = (poem: Poem) => {
    const cleanTitle = poem.title === 'Untitled' ? '' : poem.title;
    const fragmentBool = poem.is_fragment === 1;
    setEditingId(poem.id);
    setTitle(cleanTitle);
    setContent(poem.content);
    setIsFragment(fragmentBool);
    setInitialState({ title: cleanTitle, content: poem.content, isFragment: fragmentBool });
    setSaveStatus('idle');
    setIsWriting(true);
  };

  const closeEditor = () => {
    setMenuVisible(false);
    setIsWriting(false);
    setEditingId(null);
  };

  // Sauvegarde immédiate en quittant l'éditeur (plus besoin de pop-up !)
  const handleBackPress = async () => {
    if (hasUnsavedChanges() && (content.trim() || title.trim())) {
      if (editingId !== null) {
        await updatePoem(editingId, title, content, isFragment);
      } else {
        await savePoem(title, content, isFragment);
      }
    }
    closeEditor();
    await loadAllData();
  };

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert('Empty Poem', 'Please write some verses before saving.');
      return;
    }
    if (editingId !== null) {
      await updatePoem(editingId, title, content, isFragment);
    } else {
      await savePoem(title, content, isFragment);
    }
    closeEditor();
    await loadAllData();
  };

  const handleShareCurrentPoem = async () => {
    setMenuVisible(false);
    if (!content.trim()) return;
    await sharePoemAsTxt({
      id: editingId ?? 0,
      title: title.trim() || 'Untitled',
      content,
      is_fragment: isFragment ? 1 : 0,
      created_at: new Date().toISOString(),
    });
  };

  const handleDeletePoem = () => {
    setMenuVisible(false);
    if (editingId === null) return;
    Alert.alert('Delete Poem', 'Are you sure you want to permanently delete this poem?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deletePoem(editingId);
          closeEditor();
          await loadAllData();
        },
      },
    ]);
  };

  // --- Collection Creation & Reader Functions ---

  const startNewCollection = () => {
    setNewColTitle('');
    setNewColDesc('');
    setSelectedPoemIds([]);
    setIsCreatingCollection(true);
  };

  const toggleNewCollectionPoem = (poemId: number) => {
    setSelectedPoemIds((prev) =>
      prev.includes(poemId) ? prev.filter((id) => id !== poemId) : [...prev, poemId]
    );
  };

  const handleSaveNewCollection = async () => {
    if (!newColTitle.trim()) {
      Alert.alert('Missing Title', 'Please give your collection a title.');
      return;
    }
    const newColId = await createCollection(newColTitle, newColDesc);
    for (const poemId of selectedPoemIds) {
      await addPoemToCollection(newColId, poemId);
    }
    setIsCreatingCollection(false);
    await loadAllData();

    // Open the newly created collection directly in Reader mode
    const colPoems = await getCollectionPoems(newColId);
    setCollectionPoems(colPoems);
    setCurrentPage(0);
    setSelectedCollection({
      id: newColId,
      title: newColTitle.trim(),
      description: newColDesc.trim(),
    });
  };

  const openCollectionReader = async (col: Collection) => {
    const colPoems = await getCollectionPoems(col.id);
    setCollectionPoems(colPoems);
    setCurrentPage(0);
    setIsManagingCollection(false);
    setSelectedCollection(col);
  };

  const togglePoemInExistingCollection = async (poemId: number) => {
    if (!selectedCollection) return;
    const exists = collectionPoems.some((p) => p.id === poemId);
    if (exists) {
      await removePoemFromCollection(selectedCollection.id, poemId);
    } else {
      await addPoemToCollection(selectedCollection.id, poemId);
    }
    const updated = await getCollectionPoems(selectedCollection.id);
    setCollectionPoems(updated);
    await loadAllData();
  };

  const movePoemOrder = async (index: number, direction: -1 | 1) => {
    if (!selectedCollection) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= collectionPoems.length) return;
    const updated = [...collectionPoems];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setCollectionPoems(updated);
    await updateCollectionOrder(selectedCollection.id, updated);
  };

  const goToPage = (pageIndex: number) => {
    if (pageIndex < 0 || pageIndex >= collectionPoems.length) return;
    readerRef.current?.scrollToIndex({ index: pageIndex, animated: true });
    setCurrentPage(pageIndex);
  };

  const handleExportCollection = async () => {
    setCollectionMenuVisible(false);
    if (!selectedCollection) return;
    if (collectionPoems.length === 0) {
      Alert.alert('Empty Collection', 'Add at least one poem before exporting.');
      return;
    }
    await shareCollectionAsTxt(selectedCollection.id, selectedCollection.title);
  };

  const handleDeleteCollection = () => {
    setCollectionMenuVisible(false);
    if (!selectedCollection) return;
    Alert.alert(
      'Delete Collection',
      'Delete this collection? (Your individual poems will be kept safe).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteCollection(selectedCollection.id);
            setSelectedCollection(null);
            await loadAllData();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* =========================================================
          1. POEM EDITOR VIEW
      ========================================================= */}
      {/* =========================================================
          1. POEM EDITOR VIEW
      ========================================================= */}
      {isWriting ? (
        <>
          <View style={styles.header}>
            <TouchableOpacity style={styles.iconBtn} onPress={handleBackPress}>
              <Ionicons name="arrow-back" size={24} color="#2C2C2C" />
            </TouchableOpacity>

            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.editorHeaderTitle}>
                {editingId !== null ? 'Edit Poem' : 'New Poem'}
              </Text>
              {saveStatus !== 'idle' && (
                <Text style={styles.saveStatusText}>
                  {saveStatus === 'saving' ? 'Saving...' : 'Saved'}
                </Text>
              )}
            </View>

            <View style={styles.headerRightActions}>
              {isKeyboardVisible && (
                <TouchableOpacity style={styles.iconBtn} onPress={() => Keyboard.dismiss()}>
                  <Ionicons name="chevron-down" size={24} color="#2C2C2C" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.iconBtn} onPress={() => setMenuVisible(true)}>
                <Ionicons name="ellipsis-vertical" size={22} color="#2C2C2C" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.editor}
            contentContainerStyle={{
              flexGrow: 1,
              paddingBottom: isKeyboardVisible ? 260 : 80,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
          >
            {/* Bandeau compact au-dessus du titre (masqué quand le clavier est ouvert) */}
            {!isKeyboardVisible && (
              <View style={styles.fragmentRow}>
                <Text style={styles.fragmentLabel}>Save as draft / fragment</Text>
                <Switch
                  value={isFragment}
                  onValueChange={setIsFragment}
                  style={styles.compactSwitch}
                />
              </View>
            )}

            <TextInput
              style={[
                styles.titleInput,
                isKeyboardVisible && { marginBottom: 6, paddingVertical: 4 },
              ]}
              placeholder="Title (optional)..."
              value={title}
              onChangeText={setTitle}
            />

            <TextInput
              style={styles.contentInput}
              placeholder="Write your verses here..."
              value={content}
              onChangeText={setContent}
              multiline
              scrollEnabled={false}
              textAlignVertical="top"
              autoFocus={editingId === null}
            />
          </ScrollView>
        </>
      ) : isCreatingCollection ? (
        /* =========================================================
            2. CREATE COLLECTION + SELECT POEMS VIEW
        ========================================================= */
        <>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setIsCreatingCollection(false)}
            >
              <Ionicons name="arrow-back" size={24} color="#2C2C2C" />
            </TouchableOpacity>
            <Text style={styles.editorHeaderTitle}>New Collection</Text>
            <TouchableOpacity style={styles.iconBtn} onPress={handleSaveNewCollection}>
              <Ionicons name="checkmark" size={26} color="#2C2C2C" />
            </TouchableOpacity>
          </View>

          <View style={styles.editor}>
            <TextInput
              style={styles.titleInput}
              placeholder="Collection Title..."
              value={newColTitle}
              onChangeText={setNewColTitle}
              autoFocus
            />
            <TextInput
              style={styles.subtitleInput}
              placeholder="Short description or preface (optional)..."
              value={newColDesc}
              onChangeText={setNewColDesc}
            />

            <Text style={styles.sectionLabel}>
              Select poems to include ({selectedPoemIds.length} selected)
            </Text>

            <FlatList
              data={poems}
              keyExtractor={(item) => item.id.toString()}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No poems written yet.</Text>
              }
              renderItem={({ item }) => {
                const isSelected = selectedPoemIds.includes(item.id);
                const orderNum = selectedPoemIds.indexOf(item.id) + 1;
                return (
                  <TouchableOpacity
                    style={[styles.pickerCard, isSelected && styles.pickerCardSelected]}
                    onPress={() => toggleNewCollectionPoem(item.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerItemTitle}>{item.title}</Text>
                      <Text style={styles.pickerItemPreview} numberOfLines={2}>
                        {item.content}
                      </Text>
                    </View>
                    {isSelected ? (
                      <View style={styles.orderBadge}>
                        <Text style={styles.orderBadgeText}>{orderNum}</Text>
                      </View>
                    ) : (
                      <Ionicons name="square-outline" size={24} color="#AAA" />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </>
      ) : selectedCollection ? (
        /* =========================================================
            3. COLLECTION BOOK READER (1 POEM PER PAGE) & MANAGER
        ========================================================= */
        <>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                if (isManagingCollection) {
                  setIsManagingCollection(false);
                } else {
                  setSelectedCollection(null);
                  loadAllData();
                }
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#2C2C2C" />
            </TouchableOpacity>

            <Text style={styles.editorHeaderTitle} numberOfLines={1}>
              {selectedCollection.title}
            </Text>

            <View style={styles.headerRightActions}>
              {/* Toggle between Book Reader and Poem Selection/Order */}
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => setIsManagingCollection(!isManagingCollection)}
              >
                <Ionicons
                  name={isManagingCollection ? 'book-outline' : 'list-outline'}
                  size={23}
                  color="#2C2C2C"
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => setCollectionMenuVisible(true)}
              >
                <Ionicons name="ellipsis-vertical" size={22} color="#2C2C2C" />
              </TouchableOpacity>
            </View>
          </View>

          {isManagingCollection ? (
            /* Manage / Reorder Poems inside the Collection */
            <View style={styles.editor}>
              <Text style={styles.sectionLabel}>Order of Poems in Collection</Text>
              <FlatList
                data={collectionPoems}
                keyExtractor={(item) => `order-${item.id}`}
                style={{ maxHeight: '45%', marginBottom: 16 }}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No poems selected below yet.</Text>
                }
                renderItem={({ item, index }) => (
                  <View style={styles.orderRow}>
                    <Text style={styles.orderRowText} numberOfLines={1}>
                      {index + 1}. {item.title}
                    </Text>
                    <View style={styles.orderButtons}>
                      <TouchableOpacity
                        onPress={() => movePoemOrder(index, -1)}
                        disabled={index === 0}
                        style={styles.orderBtn}
                      >
                        <Ionicons
                          name="arrow-up"
                          size={18}
                          color={index === 0 ? '#CCC' : '#2C2C2C'}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => movePoemOrder(index, 1)}
                        disabled={index === collectionPoems.length - 1}
                        style={styles.orderBtn}
                      >
                        <Ionicons
                          name="arrow-down"
                          size={18}
                          color={index === collectionPoems.length - 1 ? '#CCC' : '#2C2C2C'}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />

              <Text style={styles.sectionLabel}>Add or Remove Poems</Text>
              <FlatList
                data={poems}
                keyExtractor={(item) => `pick-${item.id}`}
                renderItem={({ item }) => {
                  const isIncluded = collectionPoems.some((p) => p.id === item.id);
                  return (
                    <TouchableOpacity
                      style={[styles.pickerCard, isIncluded && styles.pickerCardSelected]}
                      onPress={() => togglePoemInExistingCollection(item.id)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickerItemTitle}>{item.title}</Text>
                        <Text style={styles.pickerItemPreview} numberOfLines={1}>
                          {item.content}
                        </Text>
                      </View>
                      <Ionicons
                        name={isIncluded ? 'checkbox' : 'square-outline'}
                        size={24}
                        color={isIncluded ? '#2C2C2C' : '#AAA'}
                      />
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          ) : collectionPoems.length === 0 ? (
            <View style={styles.emptyReaderContainer}>
              <Text style={styles.emptyText}>This collection has no poems yet.</Text>
              <TouchableOpacity
                style={[styles.primaryBtn, { marginTop: 16 }]}
                onPress={() => setIsManagingCollection(true)}
              >
                <Text style={styles.primaryBtnText}>Select Poems</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* BOOK READER: 1 POEM PER PAGE */
            <View style={{ flex: 1 }}>
              <FlatList
                ref={readerRef}
                data={collectionPoems}
                keyExtractor={(item) => item.id.toString()}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const page = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
                  setCurrentPage(page);
                }}
                getItemLayout={(_, index) => ({
                  length: screenWidth,
                  offset: screenWidth * index,
                  index,
                })}
                renderItem={({ item }) => (
                  <View style={[styles.bookPage, { width: screenWidth }]}>
                    <ScrollView
                      contentContainerStyle={styles.bookPageScroll}
                      showsVerticalScrollIndicator={false}
                    >
                      <Text style={styles.bookPoemTitle}>{item.title}</Text>
                      <View style={styles.bookDivider} />
                      <Text style={styles.bookPoemContent}>{item.content}</Text>
                    </ScrollView>
                  </View>
                )}
              />

              {/* Bottom Page Controls */}
              <View style={styles.readerFooter}>
                <TouchableOpacity
                  style={styles.pageNavBtn}
                  onPress={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 0}
                >
                  <Ionicons
                    name="chevron-back"
                    size={20}
                    color={currentPage === 0 ? '#CCC' : '#2C2C2C'}
                  />
                  <Text
                    style={[
                      styles.pageNavText,
                      currentPage === 0 && styles.pageNavDisabled,
                    ]}
                  >
                    Previous
                  </Text>
                </TouchableOpacity>

                <Text style={styles.pageIndicator}>
                  Page {currentPage + 1} of {collectionPoems.length}
                </Text>

                <TouchableOpacity
                  style={styles.pageNavBtn}
                  onPress={() => goToPage(currentPage + 1)}
                  disabled={currentPage === collectionPoems.length - 1}
                >
                  <Text
                    style={[
                      styles.pageNavText,
                      currentPage === collectionPoems.length - 1 && styles.pageNavDisabled,
                    ]}
                  >
                    Next
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={currentPage === collectionPoems.length - 1 ? '#CCC' : '#2C2C2C'}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      ) : (
        /* =========================================================
            4. HOME VIEW (POEMS & COLLECTIONS TABS)
        ========================================================= */
        <>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Poetry Notebook</Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() =>
                activeTab === 'poems' ? startNewPoem() : startNewCollection()
              }
            >
              <Text style={styles.primaryBtnText}>
                {activeTab === 'poems' ? '+ New Poem' : '+ New Collection'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'poems' && styles.activeTab]}
              onPress={() => setActiveTab('poems')}
            >
              <Text style={[styles.tabText, activeTab === 'poems' && styles.activeTabText]}>
                Poems ({poems.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'collections' && styles.activeTab]}
              onPress={() => setActiveTab('collections')}
            >
              <Text style={[styles.tabText, activeTab === 'collections' && styles.activeTabText]}>
                Collections ({collections.length})
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'poems' ? (
            <>
              {/* Barre de recherche + Filtres compacts */}
              <View style={styles.searchFilterContainer}>
                <View style={styles.searchBar}>
                  <Ionicons name="search-outline" size={16} color="#888" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search title or verses..."
                    placeholderTextColor="#999"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <Ionicons name="close-circle" size={16} color="#999" />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.filterPills}>
                  {(['all', 'poems', 'fragments'] as const).map((f) => (
                    <TouchableOpacity
                      key={f}
                      style={[
                        styles.filterPill,
                        poemFilter === f && styles.filterPillActive,
                      ]}
                      onPress={() => setPoemFilter(f)}
                    >
                      <Text
                        style={[
                          styles.filterPillText,
                          poemFilter === f && styles.filterPillTextActive,
                        ]}
                      >
                        {f === 'all' ? 'All' : f === 'poems' ? 'Finished' : 'Fragments'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <FlatList
                data={filteredPoems}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={styles.list}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    {poems.length === 0
                      ? 'No poems yet. Tap "+ New Poem" to start writing.'
                      : 'No matching poems found.'}
                  </Text>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.card}
                    activeOpacity={0.7}
                    onPress={() => openPoemForEdit(item)}
                  >
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>{item.title}</Text>
                      {item.is_fragment === 1 && <Text style={styles.badge}>Fragment</Text>}
                    </View>
                    <Text style={styles.cardContent} numberOfLines={4}>
                      {item.content}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </>
          ) : (
            <FlatList
              data={collections}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.list}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  No collections yet. Tap "+ New Collection" to create a book of poems.
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.card}
                  activeOpacity={0.7}
                  onPress={() => openCollectionReader(item)}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.badge}>{item.poem_count ?? 0} pages</Text>
                  </View>
                  {!!item.description && (
                    <Text style={styles.cardContent} numberOfLines={2}>
                      {item.description}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </>
      )}

      {/* Poem Options Menu (...) */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.dropdownMenu}>
            <TouchableOpacity style={styles.menuItem} onPress={handleShareCurrentPoem}>
              <Ionicons name="share-outline" size={20} color="#2C2C2C" />
              <Text style={styles.menuItemText}>Share (.txt)</Text>
            </TouchableOpacity>
            {editingId !== null && (
              <TouchableOpacity style={styles.menuItem} onPress={handleDeletePoem}>
                <Ionicons name="trash-outline" size={20} color="#DC2626" />
                <Text style={[styles.menuItemText, styles.deleteText]}>Delete Poem</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Collection Options Menu (...) */}
      <Modal
        visible={collectionMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCollectionMenuVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCollectionMenuVisible(false)}>
          <View style={styles.dropdownMenu}>
            <TouchableOpacity style={styles.menuItem} onPress={handleExportCollection}>
              <Ionicons name="share-outline" size={20} color="#2C2C2C" />
              <Text style={styles.menuItemText}>Export Collection (.txt)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setCollectionMenuVisible(false);
                setIsManagingCollection(!isManagingCollection);
              }}
            >
              <Ionicons name="list-outline" size={20} color="#2C2C2C" />
              <Text style={styles.menuItemText}>
                {isManagingCollection ? 'Read Collection' : 'Edit Poems / Order'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleDeleteCollection}>
              <Ionicons name="trash-outline" size={20} color="#DC2626" />
              <Text style={[styles.menuItemText, styles.deleteText]}>Delete Collection</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF9F6', paddingTop: StatusBar.currentHeight },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#E5E4E2',
    minHeight: 60
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#2C2C2C', fontFamily: 'serif', paddingLeft: 4 },
  editorHeaderTitle: { fontSize: 18, fontWeight: '600', color: '#2C2C2C', fontFamily: 'serif', flex: 1, textAlign: 'center' },
  saveStatusText: { fontSize: 11, color: '#888', fontStyle: 'italic', marginTop: 1 },
  headerRightActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { padding: 8, borderRadius: 20 },
  primaryBtn: { backgroundColor: '#2C2C2C', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  primaryBtnText: { color: '#FFF', fontWeight: '600' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#E5E4E2', backgroundColor: '#FFF' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderColor: 'transparent' },
  activeTab: { borderColor: '#2C2C2C' },
  tabText: { fontSize: 15, color: '#888', fontWeight: '500' },
  activeTabText: { color: '#2C2C2C', fontWeight: '700' },
  editor: { flex: 1, padding: 16 },
  titleInput: { fontSize: 20, fontWeight: '600', borderBottomWidth: 1, borderColor: '#DDD', paddingVertical: 8, marginBottom: 12, fontFamily: 'serif' },
  subtitleInput: { fontSize: 15, borderBottomWidth: 1, borderColor: '#EAEAEA', paddingVertical: 8, marginBottom: 16, fontFamily: 'serif', color: '#555' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  fragmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    paddingVertical: 0,
    height: 28, // Hauteur fixe très fine
  },
  fragmentLabel: { color: '#666', fontSize: 13 },
  compactSwitch: { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] },
  contentInput: {
    flex: 1,
    minHeight: 300,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'serif',
    color: '#333',
  },
  list: { padding: 16 },
  emptyText: { textAlign: 'center', color: '#888', marginTop: 32 },
  emptyReaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: '#FFF', padding: 16, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#EAEAEA' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: '600', fontFamily: 'serif', color: '#222', flex: 1 },
  badge: { fontSize: 11, backgroundColor: '#EFEFEF', color: '#666', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  cardContent: { fontSize: 15, color: '#444', lineHeight: 22, fontFamily: 'serif' },
  pickerCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF',
    padding: 14, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#EAEAEA', gap: 12
  },
  pickerCardSelected: { borderColor: '#2C2C2C', backgroundColor: '#F5F4F0' },
  pickerItemTitle: { fontSize: 16, fontWeight: '600', fontFamily: 'serif', color: '#222' },
  pickerItemPreview: { fontSize: 13, color: '#666', marginTop: 2, fontFamily: 'serif' },
  orderBadge: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: '#2C2C2C',
    justifyContent: 'center', alignItems: 'center'
  },
  orderBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  orderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FFF', paddingVertical: 10, paddingHorizontal: 14,
    borderRadius: 6, marginBottom: 6, borderWidth: 1, borderColor: '#EAEAEA'
  },
  orderRowText: { fontSize: 15, fontFamily: 'serif', color: '#222', flex: 1 },
  orderButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderBtn: { padding: 4 },
  bookPage: { flex: 1, paddingHorizontal: 28, paddingTop: 28 },
  bookPageScroll: { paddingBottom: 40 },
  bookPoemTitle: {
    fontSize: 24, fontWeight: '700', fontFamily: 'serif', color: '#1E1E1E',
    textAlign: 'center', marginBottom: 14
  },
  bookDivider: {
    width: 40, height: 2, backgroundColor: '#D4D0C8',
    alignSelf: 'center', marginBottom: 28
  },
  bookPoemContent: {
    fontSize: 17, lineHeight: 28, fontFamily: 'serif', color: '#2C2C2C'
  },
  readerFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderColor: '#E5E4E2',
    backgroundColor: '#FAF9F6'
  },
  pageNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 },
  pageNavText: { fontSize: 14, fontWeight: '600', color: '#2C2C2C' },
  pageNavDisabled: { color: '#CCC' },
  pageIndicator: { fontSize: 13, color: '#666', fontFamily: 'serif', fontStyle: 'italic' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)', justifyContent: 'flex-start', alignItems: 'flex-end' },
  dropdownMenu: {
    backgroundColor: '#FFF', borderRadius: 8, marginTop: (StatusBar.currentHeight || 24) + 50,
    marginRight: 16, paddingVertical: 6, minWidth: 200, elevation: 5,
    borderWidth: 1, borderColor: '#EAEAEA'
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  menuItemText: { fontSize: 15, color: '#2C2C2C', fontWeight: '500' },
  deleteText: { color: '#DC2626' },
  searchFilterContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#2C2C2C',
    fontFamily: 'serif',
    paddingVertical: 0,
  },
  filterPills: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E4E2',
    backgroundColor: 'transparent',
  },
  filterPillActive: {
    backgroundColor: '#2C2C2C',
    borderColor: '#2C2C2C',
  },
  filterPillText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
});