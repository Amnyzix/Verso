import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Modal, Pressable, Alert, Switch, ScrollView, BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Poem, Collection, importBackupData } from '../db';
import { shareFullBackupAsJson } from '../exportTxt';
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
  onDataRestored: () => Promise<void>;
  theme: Theme;
}

export default function HomeView({
  poems, collections, activeTab, setActiveTab,
  isDarkMode, onToggleTheme, onNewPoem, onEditPoem,
  onNewCollection, onOpenCollection, onDataRestored, theme,
}: Props) {
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [searchQuery, setSearchQuery] = useState('');
  const [poemFilter, setPoemFilter] = useState<'all' | 'poems' | 'fragments'>('all');

  // État pour afficher la page Settings depuis l'icône en haut à gauche
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Restore Modal State
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [backupJsonInput, setBackupJsonInput] = useState('');

  // Bouton retour physique Android quand on est dans Settings
  useEffect(() => {
    if (!isSettingsOpen) return;
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      setIsSettingsOpen(false);
      return true;
    });
    return () => backSub.remove();
  }, [isSettingsOpen]);

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

  const handleExportBackup = async () => {
    try {
      await shareFullBackupAsJson();
    } catch (err:any) {
      console.error('Backup error:', err);
      Alert.alert('Export Error', err?.message || String(err));
      //Alert.alert('Export Error', 'Could not export backup.');
    }
  };

  const handleConfirmRestore = async () => {
    if (!backupJsonInput.trim()) return;
    try {
      const result = await importBackupData(backupJsonInput.trim());
      setBackupJsonInput('');
      setRestoreModalVisible(false);
      await onDataRestored();
      Alert.alert(
        'Backup Restored',
        `Imported ${result.poems} poems and ${result.collections} collections.`
      );
    } catch (err) {
      Alert.alert('Invalid Backup', 'Please paste a valid JSON backup.');
    }
  };

  /* =========================================================
      VUE SETTINGS (ouverte via l'icône en haut à gauche)
  ========================================================= */
  if (isSettingsOpen) {
    return (
      <>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setIsSettingsOpen(false)}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.editorHeaderTitle, { flex: 1 }]}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.list}>
          <Text style={styles.sectionLabel}>Appearance</Text>
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons
                  name={isDarkMode ? 'moon' : 'sunny-outline'}
                  size={20}
                  color={theme.text}
                />
                <View>
                  <Text style={[styles.cardTitle, { fontSize: 16 }]}>Dark Mode (Night Ink)</Text>
                  <Text style={{ fontSize: 12, color: theme.textMuted }}>
                    Soft dark background for night writing
                  </Text>
                </View>
              </View>
              <Switch value={isDarkMode} onValueChange={onToggleTheme} />
            </View>
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Data & Backup</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}
              onPress={handleExportBackup}
            >
              <Ionicons name="cloud-upload-outline" size={22} color={theme.text} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { fontSize: 16 }]}>Export Full Backup (.json)</Text>
                <Text style={{ fontSize: 12, color: theme.textMuted }}>
                  Save all your poems and collections to a file
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>

            <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 12 }} />

            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}
              onPress={() => setRestoreModalVisible(true)}
            >
              <Ionicons name="cloud-download-outline" size={22} color={theme.text} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { fontSize: 16 }]}>Restore from Backup</Text>
                <Text style={{ fontSize: 12, color: theme.textMuted }}>
                  Import poems and collections from a backup file
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Restore Backup Modal */}
        <Modal
          visible={restoreModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setRestoreModalVisible(false)}
        >
          <Pressable
            style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}
            onPress={() => setRestoreModalVisible(false)}
          >
            <Pressable
              style={[styles.card, { width: '100%', maxHeight: 380 }]}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={[styles.cardTitle, { flex: 0, marginBottom: 8 }]}>
                Restore Backup
              </Text>
              <Text style={[styles.fragmentLabel, { marginBottom: 12 }]}>
                Paste the contents of your backup (.json) file below:
              </Text>
              <TextInput
                style={[
                  styles.searchBar,
                  { height: 140, textAlignVertical: 'top', paddingVertical: 10, color: theme.text },
                ]}
                placeholder='{"version": 1, "poems": [...]}'
                placeholderTextColor={theme.textMuted}
                value={backupJsonInput}
                onChangeText={setBackupJsonInput}
                multiline
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => setRestoreModalVisible(false)}
                >
                  <Text style={{ color: theme.textMuted, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleConfirmRestore}>
                  <Text style={styles.primaryBtnText}>Restore</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </>
    );
  }

  /* =========================================================
      VUE D'ACCUEIL PRINCIPALE (Poems & Collections)
  ========================================================= */
  return (
    <>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setIsSettingsOpen(true)}
          >
            <Ionicons name="settings-outline" size={22} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verso</Text>
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => (activeTab === 'poems' ? onNewPoem() : onNewCollection())}
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