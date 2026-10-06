import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Switch, Modal, Pressable, Alert, Keyboard, BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Poem, savePoem, updatePoem, deletePoem } from '../db';
import { sharePoemAsTxt, sharePoemAsPdf } from '../exportTxt';
import { Theme, getStyles } from '../theme';

interface Props {
  initialPoem: Poem | null;
  onClose: () => Promise<void>;
  theme: Theme;
}

export default function PoemEditorView({ initialPoem, onClose, theme }: Props) {
  const styles = useMemo(() => getStyles(theme), [theme]);

  const cleanInitialTitle = initialPoem ? (initialPoem.title === 'Untitled' ? '' : initialPoem.title) : '';
  const initialFrag = initialPoem ? initialPoem.is_fragment === 1 : false;
  const initialContent = initialPoem?.content ?? '';

  const [editingId, setEditingId] = useState<number | null>(initialPoem?.id ?? null);
  const [title, setTitle] = useState(cleanInitialTitle);
  const [content, setContent] = useState(initialContent);
  const [isFragment, setIsFragment] = useState(initialFrag);
  const [initialState, setInitialState] = useState({
    title: cleanInitialTitle,
    content: initialContent,
    isFragment: initialFrag,
  });

  // --- Undo / Redo State ---
  const [history, setHistory] = useState<string[]>([initialContent]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const isUndoRedoAction = useRef(false);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Enregistre un snapshot dans l'historique 400ms après une pause de frappe
  useEffect(() => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }
    if (content === history[historyIndex]) return;

    const timer = setTimeout(() => {
      setHistory((prev) => {
        const sliced = prev.slice(0, historyIndex + 1);
        return [...sliced, content];
      });
      setHistoryIndex((prev) => prev + 1);
    }, 400);

    return () => clearTimeout(timer);
  }, [content, history, historyIndex]);

  const handleUndo = () => {
    if (!canUndo) return;
    isUndoRedoAction.current = true;
    const prevIndex = historyIndex - 1;
    setHistoryIndex(prevIndex);
    setContent(history[prevIndex]);
  };

  const handleRedo = () => {
    if (!canRedo) return;
    isUndoRedoAction.current = true;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    setContent(history[nextIndex]);
  };

  // --- Compteur de Vers (lignes non vides) et de Mots ---
  const { lineCount, wordCount } = useMemo(() => {
    const trimmed = content.trim();
    if (!trimmed) return { lineCount: 0, wordCount: 0 };
    const lines = trimmed.split('\n').filter((line) => line.trim().length > 0).length;
    const words = trimmed.split(/\s+/).filter(Boolean).length;
    return { lineCount: lines, wordCount: words };
  }, [content]);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [menuVisible, setMenuVisible] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const hasUnsavedChanges = () =>
    title !== initialState.title ||
    content !== initialState.content ||
    isFragment !== initialState.isFragment;

  // Détection du clavier
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Auto-save 800ms après la dernière frappe
  useEffect(() => {
    if (!hasUnsavedChanges()) return;
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
  }, [title, content, isFragment, editingId, initialState]);

  // Masquer "Saved" au bout de 1.2s
  useEffect(() => {
    if (saveStatus === 'saved') {
      const hideTimer = setTimeout(() => setSaveStatus('idle'), 1200);
      return () => clearTimeout(hideTimer);
    }
  }, [saveStatus]);

  const handleBackPress = async () => {
    if (hasUnsavedChanges() && (content.trim() || title.trim())) {
      if (editingId !== null) {
        await updatePoem(editingId, title, content, isFragment);
      } else {
        await savePoem(title, content, isFragment);
      }
    }
    await onClose();
  };

  // Bouton Retour physique Android
  useEffect(() => {
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackPress();
      return true;
    });
    return () => backSub.remove();
  }, [title, content, isFragment, editingId, initialState]);

  const handleShare = async () => {
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

  const handleSharePdf = async () => {
    setMenuVisible(false);
    if (!content.trim()) return;
    await sharePoemAsPdf({
      id: editingId ?? 0,
      title: title.trim() || 'Untitled',
      content,
      is_fragment: isFragment ? 1 : 0,
      created_at: new Date().toISOString(),
    });
  };

  const handleDelete = () => {
    setMenuVisible(false);
    if (editingId === null) return;
    Alert.alert('Delete Poem', 'Are you sure you want to permanently delete this poem?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deletePoem(editingId);
          await onClose();
        },
      },
    ]);
  };

  return (
    <>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={handleBackPress}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
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
          {(isKeyboardVisible || canUndo || canRedo) && (
            <>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={handleUndo}
                disabled={!canUndo}
              >
                <Ionicons
                  name="arrow-undo-outline"
                  size={20}
                  color={canUndo ? theme.text : theme.disabled}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={handleRedo}
                disabled={!canRedo}
              >
                <Ionicons
                  name="arrow-redo-outline"
                  size={20}
                  color={canRedo ? theme.text : theme.disabled}
                />
              </TouchableOpacity>
            </>
          )}

          {isKeyboardVisible && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => Keyboard.dismiss()}>
              <Ionicons name="chevron-down" size={24} color={theme.text} />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.iconBtn} onPress={() => setMenuVisible(true)}>
            <Ionicons name="ellipsis-vertical" size={22} color={theme.text} />
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
            isKeyboardVisible && { marginBottom: 4, paddingVertical: 4 },
          ]}
          placeholder="Title (optional)..."
          placeholderTextColor={theme.textMuted}
          value={title}
          onChangeText={setTitle}
        />

        {/* Compteur discret de vers et de mots */}
        <Text style={styles.statsText}>
          {lineCount} {lineCount === 1 ? 'line' : 'lines'} · {wordCount}{' '}
          {wordCount === 1 ? 'word' : 'words'}
        </Text>

        <TextInput
          style={styles.contentInput}
          placeholder="Write your verses here..."
          placeholderTextColor={theme.textMuted}
          value={content}
          onChangeText={setContent}
          multiline
          scrollEnabled={false}
          textAlignVertical="top"
          autoFocus={initialPoem === null}
        />
      </ScrollView>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.dropdownMenu}>
            <TouchableOpacity style={styles.menuItem} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color={theme.text} />
              <Text style={styles.menuItemText}>Share (.txt)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleSharePdf}>
              <Ionicons name="book-outline" size={20} color={theme.text} />
              <Text style={styles.menuItemText}>Share (.pdf)</Text>
            </TouchableOpacity>
            {editingId !== null && (
              <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={20} color={theme.danger} />
                <Text style={[styles.menuItemText, styles.deleteText]}>Delete Poem</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}