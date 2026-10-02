import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Poem, Collection } from '../db';
import { Theme, getStyles } from '../theme';

interface Props {
  poems: Poem[];
  collections: Collection[];
  activeTab: 'poems' | 'collections';
  setActiveTab: (tab: 'poems' | 'collections') => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onNewPoem: () => void;
  onEditPoem: (poem: Poem) => void;
  onNewCollection: () => void;
  onOpenCollection: (col: Collection) => void;
  theme: Theme;
}

export default function HomeView({
  poems, collections, activeTab, setActiveTab,
  isDarkMode, onToggleTheme, onNewPoem, onEditPoem,
  onNewCollection, onOpenCollection, theme,
}: Props) {
  const styles = useMemo(() => getStyles(theme), [theme]);
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

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Poetry Notebook</Text>
        <View style={styles.headerRightActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={onToggleTheme}>
            <Ionicons
              name={isDarkMode ? 'sunny-outline' : 'moon-outline'}
              size={21}
              color={theme.text}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => (activeTab === 'poems' ? onNewPoem() : onNewCollection())}
          >
            <Text style={styles.primaryBtnText}>
              {activeTab === 'poems' ? '+ New Poem' : '+ New Collection'}
            </Text>
          </TouchableOpacity>
        </View>
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
          <View style={styles.searchFilterContainer}>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={16} color={theme.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search title or verses..."
                placeholderTextColor={theme.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={theme.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.filterPills}>
              {(['all', 'poems', 'fragments'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterPill, poemFilter === f && styles.filterPillActive]}
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
                onPress={() => onEditPoem(item)}
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
              onPress={() => onOpenCollection(item)}
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
  );
}