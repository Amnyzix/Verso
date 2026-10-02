import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, ScrollView,
  Modal, Pressable, Alert, useWindowDimensions, BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Poem, Collection, getCollectionPoems, addPoemToCollection,
  removePoemFromCollection, updateCollectionOrder, deleteCollection,
} from '../db';
import { shareCollectionAsTxt } from '../exportTxt';
import { Theme, getStyles } from '../theme';

interface Props {
  collection: Collection;
  allPoems: Poem[];
  onClose: () => Promise<void>;
  onDataChange: () => Promise<void>;
  theme: Theme;
}

export default function CollectionReaderView({
  collection, allPoems, onClose, onDataChange, theme,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const readerRef = useRef<FlatList<Poem>>(null);

  const [collectionPoems, setCollectionPoems] = useState<Poem[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isManaging, setIsManaging] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const loadPoems = async () => {
    const colPoems = await getCollectionPoems(collection.id);
    setCollectionPoems(colPoems);
  };

  useEffect(() => {
    loadPoems();
  }, [collection.id]);

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
    if (pageIndex < 0 || pageIndex >= collectionPoems.length) return;
    readerRef.current?.scrollToIndex({ index: pageIndex, animated: true });
    setCurrentPage(pageIndex);
  };

  const handleExport = async () => {
    setMenuVisible(false);
    if (collectionPoems.length === 0) {
      Alert.alert('Empty Collection', 'Add at least one poem before exporting.');
      return;
    }
    await shareCollectionAsTxt(collection.id, collection.title);
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
                color={currentPage === collectionPoems.length - 1 ? theme.disabled : theme.text}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.dropdownMenu}>
            <TouchableOpacity style={styles.menuItem} onPress={handleExport}>
              <Ionicons name="share-outline" size={20} color={theme.text} />
              <Text style={styles.menuItemText}>Export Collection (.txt)</Text>
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
                {isManaging ? 'Read Collection' : 'Edit Poems / Order'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={20} color={theme.danger} />
              <Text style={[styles.menuItemText, styles.deleteText]}>Delete Collection</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}