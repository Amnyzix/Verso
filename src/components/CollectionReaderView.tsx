import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ScrollView,
  Modal, Pressable, Alert, useWindowDimensions, BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Poem, Collection, getCollectionPoems, addPoemToCollection,
  removePoemFromCollection, updateCollectionOrder, deleteCollection,
  updateCollection,
} from '../db';
import { shareCollectionAsTxt, shareCollectionAsPdf } from '../exportTxt';
import { Theme, getStyles } from '../theme';

interface Props {
  collection: Collection;
  allPoems: Poem[];
  initialPage: number;
  onPageChange: (page: number) => void;
  onClose: () => Promise<void>;
  onDataChange: () => Promise<void>;
  onEditPoem: (poem: Poem) => void;
  onUpdateCollectionMeta: (updated: Collection) => void;
  theme: Theme;
}

type ReaderItem =
  | { type: 'cover'; id: string }
  | { type: 'poem'; id: string; poem: Poem };

export default function CollectionReaderView({
  collection, allPoems, initialPage, onPageChange, onClose, onDataChange,
  onEditPoem, onUpdateCollectionMeta, theme,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const readerRef = useRef<FlatList<ReaderItem>>(null);

  const [collectionPoems, setCollectionPoems] = useState<Poem[]>([]);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [isManaging, setIsManaging] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  // Modal pour éditer le titre / la préface du recueil
  const [editMetaVisible, setEditMetaVisible] = useState(false);
  const [editTitle, setEditTitle] = useState(collection.title);
  const [editDesc, setEditDesc] = useState(collection.description || '');

  const loadPoems = async () => {
    const colPoems = await getCollectionPoems(collection.id);
    setCollectionPoems(colPoems);
  };

  // Recharge les poèmes du recueil (y compris quand on revient de l'éditeur de poème)
  useEffect(() => {
    loadPoems();
  }, [collection.id, allPoems]);

  // Liste des pages : Page 0 = Couverture, Pages 1..N = Poèmes
  const readerPages: ReaderItem[] = useMemo(() => {
    if (collectionPoems.length === 0) return [];
    return [
      { type: 'cover', id: 'cover-page' },
      ...collectionPoems.map((poem) => ({
        type: 'poem' as const,
        id: `poem-${poem.id}`,
        poem,
      })),
    ];
  }, [collectionPoems]);

  // Poème affiché sur la page actuelle (null si on est sur la couverture)
  const currentPoem =
    currentPage > 0 && currentPage <= collectionPoems.length
      ? collectionPoems[currentPage - 1]
      : null;

  useEffect(() => {
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isManaging) {
        setIsManaging(false);
      } else {
        onClose();
      }
      return true;
    });
    return () => backSub.remove();
  }, [isManaging]);

  const togglePoem = async (poemId: number) => {
    const exists = collectionPoems.some((p) => p.id === poemId);
    if (exists) {
      await removePoemFromCollection(collection.id, poemId);
    } else {
      await addPoemToCollection(collection.id, poemId);
    }
    await loadPoems();
    await onDataChange();
  };

  const movePoemOrder = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= collectionPoems.length) return;
    const updated = [...collectionPoems];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setCollectionPoems(updated);
    await updateCollectionOrder(collection.id, updated);
  };

  const goToPage = (pageIndex: number) => {
    if (pageIndex < 0 || pageIndex >= readerPages.length) return;
    readerRef.current?.scrollToIndex({ index: pageIndex, animated: true });
    setCurrentPage(pageIndex);
    onPageChange(pageIndex);
  };

  const handleSaveCollectionMeta = async () => {
    if (!editTitle.trim()) {
      Alert.alert('Missing Title', 'Please give your collection a title.');
      return;
    }
    await updateCollection(collection.id, editTitle, editDesc);
    onUpdateCollectionMeta({
      ...collection,
      title: editTitle.trim(),
      description: editDesc.trim(),
    });
    setEditMetaVisible(false);
    await onDataChange();
  };


const handleExport = async () => {
    setMenuVisible(false);
    if (collectionPoems.length === 0) {
      Alert.alert('Empty Collection', 'Add at least one poem before exporting.');
      return;
    }
    try {
      await shareCollectionAsTxt(collection.id, collection.title);
    } catch (err: any) {
      console.error('Export TXT error:', err);
      Alert.alert('Export Error', err?.message || String(err));
    }
  };

  const handleExportPdf = async () => {
    setMenuVisible(false);
    if (collectionPoems.length === 0) {
      Alert.alert('Empty Collection', 'Add at least one poem before exporting.');
      return;
    }
    try {
      await shareCollectionAsPdf(collection);
    } catch (err: any) {
      console.error('Export PDF error:', err);
      Alert.alert('PDF Export Error', err?.message || String(err));
    }
  };

  
  const handleDelete = () => {
    setMenuVisible(false);
    Alert.alert(
      'Delete Collection',
      'Delete this collection? (Your individual poems will be kept safe).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteCollection(collection.id);
            await onClose();
          },
        },
      ]
    );
  };

  return (
    <>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => (isManaging ? setIsManaging(false) : onClose())}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>

        <Text style={[styles.editorHeaderTitle, { flex: 1 }]} numberOfLines={1}>
          {collection.title}
        </Text>

        <View style={styles.headerRightActions}>
          {/* Bouton rapide d'édition : édite le poème affiché OU la couverture */}
          {!isManaging && collectionPoems.length > 0 && (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                if (currentPoem) {
                  onEditPoem(currentPoem);
                } else {
                  setEditTitle(collection.title);
                  setEditDesc(collection.description || '');
                  setEditMetaVisible(true);
                }
              }}
            >
              <Ionicons name="create-outline" size={22} color={theme.text} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setIsManaging(!isManaging)}
          >
            <Ionicons
              name={isManaging ? 'book-outline' : 'list-outline'}
              size={23}
              color={theme.text}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconBtn} onPress={() => setMenuVisible(true)}>
            <Ionicons name="ellipsis-vertical" size={22} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      {isManaging ? (
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
                      color={index === 0 ? theme.disabled : theme.text}
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
                      color={index === collectionPoems.length - 1 ? theme.disabled : theme.text}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />

          <Text style={styles.sectionLabel}>Add or Remove Poems</Text>
          <FlatList
            data={allPoems}
            keyExtractor={(item) => `pick-${item.id}`}
            renderItem={({ item }) => {
              const isIncluded = collectionPoems.some((p) => p.id === item.id);
              return (
                <TouchableOpacity
                  style={[styles.pickerCard, isIncluded && styles.pickerCardSelected]}
                  onPress={() => togglePoem(item.id)}
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
                    color={isIncluded ? theme.text : theme.textMuted}
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
            onPress={() => setIsManaging(true)}
          >
            <Text style={styles.primaryBtnText}>Select Poems</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            ref={readerRef}
            data={readerPages}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={
              initialPage < readerPages.length ? initialPage : 0
            }
            onMomentumScrollEnd={(e) => {
              const page = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
              setCurrentPage(page);
              onPageChange(page);
            }}
            getItemLayout={(_, index) => ({
              length: screenWidth,
              offset: screenWidth * index,
              index,
            })}
            renderItem={({ item }) => {
              if (item.type === 'cover') {
                return (
                  <View style={[styles.coverPageContainer, { width: screenWidth }]}>
                    <Text style={styles.coverTitle}>{collection.title}</Text>
                    <View style={styles.bookDivider} />
                    {!!collection.description && (
                      <Text style={styles.coverDescription}>
                        {collection.description}
                      </Text>
                    )}
                    <Text style={styles.coverMeta}>
                      {collectionPoems.length}{' '}
                      {collectionPoems.length === 1 ? 'poem' : 'poems'}
                    </Text>
                  </View>
                );
              }

              return (
                <View style={[styles.bookPage, { width: screenWidth }]}>
                  <ScrollView
                    contentContainerStyle={styles.bookPageScroll}
                    showsVerticalScrollIndicator={false}
                  >
                    <Text style={styles.bookPoemTitle}>{item.poem.title}</Text>
                    <View style={styles.bookDivider} />
                    <Text style={styles.bookPoemContent}>{item.poem.content}</Text>
                  </ScrollView>
                </View>
              );
            }}
          />

          <View style={styles.readerFooter}>
            <TouchableOpacity
              style={styles.pageNavBtn}
              onPress={() => goToPage(currentPage - 1)}
              disabled={currentPage === 0}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={currentPage === 0 ? theme.disabled : theme.text}
              />
              <Text style={[styles.pageNavText, currentPage === 0 && styles.pageNavDisabled]}>
                Previous
              </Text>
            </TouchableOpacity>

            <Text style={styles.pageIndicator}>
              {currentPage === 0
                ? 'Cover'
                : `Poem ${currentPage} of ${collectionPoems.length}`}
            </Text>

            <TouchableOpacity
              style={styles.pageNavBtn}
              onPress={() => goToPage(currentPage + 1)}
              disabled={currentPage === readerPages.length - 1}
            >
              <Text
                style={[
                  styles.pageNavText,
                  currentPage === readerPages.length - 1 && styles.pageNavDisabled,
                ]}
              >
                Next
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={currentPage === readerPages.length - 1 ? theme.disabled : theme.text}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Menu d'options du Recueil (...) */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.dropdownMenu}>
            {currentPoem && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false);
                  onEditPoem(currentPoem);
                }}
              >
                <Ionicons name="create-outline" size={20} color={theme.text} />
                <Text style={styles.menuItemText}>Edit Current Poem</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                setEditTitle(collection.title);
                setEditDesc(collection.description || '');
                setEditMetaVisible(true);
              }}
            >
              <Ionicons name="book-outline" size={20} color={theme.text} />
              <Text style={styles.menuItemText}>Edit Title / Preface</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                setIsManaging(!isManaging);
              }}
            >
              <Ionicons name="list-outline" size={20} color={theme.text} />
              <Text style={styles.menuItemText}>
                {isManaging ? 'Read Collection' : 'Manage Poems / Order'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleExport}>
              <Ionicons name="share-outline" size={20} color={theme.text} />
              <Text style={styles.menuItemText}>Export Collection (.txt)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleExportPdf}>
              <Ionicons name="print-outline" size={20} color={theme.text} />
              <Text style={styles.menuItemText}>Export Book (.pdf)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color={theme.danger} />
              <Text style={[styles.menuItemText, styles.deleteText]}>Delete Collection</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Modal pour modifier le Titre / Préface du Recueil */}
      <Modal
        visible={editMetaVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditMetaVisible(false)}
      >
        <Pressable
          style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}
          onPress={() => setEditMetaVisible(false)}
        >
          <Pressable
            style={[styles.card, { width: '100%' }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.cardTitle, { flex: 0, marginBottom: 12 }]}>
              Edit Collection Cover
            </Text>
            <TextInput
              style={styles.titleInput}
              placeholder="Collection Title..."
              placeholderTextColor={theme.textMuted}
              value={editTitle}
              onChangeText={setEditTitle}
            />
            <TextInput
              style={[styles.subtitleInput, { minHeight: 80, textAlignVertical: 'top' }]}
              placeholder="Short description or preface (optional)..."
              placeholderTextColor={theme.textMuted}
              value={editDesc}
              onChangeText={setEditDesc}
              multiline
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => setEditMetaVisible(false)}
              >
                <Text style={{ color: theme.textMuted, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveCollectionMeta}>
                <Text style={styles.primaryBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}