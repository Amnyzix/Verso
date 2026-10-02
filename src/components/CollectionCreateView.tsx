import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Alert, BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Poem, Collection, createCollection, addPoemToCollection } from '../db';
import { Theme, getStyles } from '../theme';

interface Props {
  poems: Poem[];
  onCancel: () => void;
  onCreated: (newCollection: Collection) => Promise<void>;
  theme: Theme;
}

export default function CollectionCreateView({ poems, onCancel, onCreated, theme }: Props) {
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [selectedPoemIds, setSelectedPoemIds] = useState<number[]>([]);

  useEffect(() => {
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCancel();
      return true;
    });
    return () => backSub.remove();
  }, []);

  const togglePoem = (poemId: number) => {
    setSelectedPoemIds((prev) =>
      prev.includes(poemId) ? prev.filter((id) => id !== poemId) : [...prev, poemId]
    );
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please give your collection a title.');
      return;
    }
    const newColId = await createCollection(title, desc);
    for (const poemId of selectedPoemIds) {
      await addPoemToCollection(newColId, poemId);
    }
    await onCreated({
      id: newColId,
      title: title.trim(),
      description: desc.trim(),
    });
  };

  return (
    <>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={onCancel}>
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.editorHeaderTitle, { flex: 1 }]}>New Collection</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={handleSave}>
          <Ionicons name="checkmark" size={26} color={theme.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.editor}>
        <TextInput
          style={styles.titleInput}
          placeholder="Collection Title..."
          placeholderTextColor={theme.textMuted}
          value={title}
          onChangeText={setTitle}
          autoFocus
        />
        <TextInput
          style={styles.subtitleInput}
          placeholder="Short description or preface (optional)..."
          placeholderTextColor={theme.textMuted}
          value={desc}
          onChangeText={setDesc}
        />

        <Text style={styles.sectionLabel}>
          Select poems to include ({selectedPoemIds.length} selected)
        </Text>

        <FlatList
          data={poems}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={<Text style={styles.emptyText}>No poems written yet.</Text>}
          renderItem={({ item }) => {
            const isSelected = selectedPoemIds.includes(item.id);
            const orderNum = selectedPoemIds.indexOf(item.id) + 1;
            return (
              <TouchableOpacity
                style={[styles.pickerCard, isSelected && styles.pickerCardSelected]}
                onPress={() => togglePoem(item.id)}
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
                  <Ionicons name="square-outline" size={24} color={theme.textMuted} />
                )}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </>
  );
}