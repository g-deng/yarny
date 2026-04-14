import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import {
  getPublicProjects,
  addProjectToTrack,
  type ProjectWithUser,
} from '@/services/api';
import { useUser } from '@/hooks/use-user';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { YarnyColors, YarnyFonts, YarnySizes } from '@/constants/theme';

export default function SearchScreen() {
  const { userId } = useUser();
  const [projects, setProjects] = useState<ProjectWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const router = useRouter();

  const selectionMode = selectedIds.size > 0;

  const exitSelection = useCallback(() => setSelectedIds(new Set()), []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleLongPress = useCallback(
    (id: string) => {
      if (!selectionMode) setSelectedIds(new Set([id]));
    },
    [selectionMode]
  );

  const addSelectedToLibrary = useCallback(async () => {
    if (!userId || selectedIds.size === 0) return;
    setAdding(true);
    try {
      const results = await Promise.allSettled(
        Array.from(selectedIds).map((id) => addProjectToTrack(userId, id))
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      const added = results.length - failed;
      exitSelection();
      if (failed > 0) {
        Alert.alert(
          'Added with errors',
          `${added} added, ${failed} failed (maybe already in your library).`
        );
      }
    } catch (err) {
      console.error('Failed to add projects:', err);
      Alert.alert('Error', 'Failed to add projects to library.');
    } finally {
      setAdding(false);
    }
  }, [userId, selectedIds, exitSelection]);

  const fetchProjects = useCallback(async () => {
    try {
      const data = await getPublicProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to fetch public projects:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProjects();
    }, [fetchProjects])
  );

  const filteredProjects = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.username.toLowerCase().includes(q)
    );
  }, [projects, query]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {selectionMode ? (
          <View style={styles.selectionHeader}>
            <TouchableOpacity onPress={exitSelection} disabled={adding}>
              <Text style={styles.headerAction}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{selectedIds.size} selected</Text>
            <TouchableOpacity onPress={addSelectedToLibrary} disabled={adding}>
              <Text style={styles.headerAction}>{adding ? '...' : 'Add'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.headerTitle}>Search</Text>
        )}
      </View>

      <View style={styles.searchBar}>
        <IconSymbol name="magnifyingglass" size={18} color={YarnyColors.border} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search patterns or users..."
          placeholderTextColor={YarnyColors.card}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={YarnyColors.button} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={filteredProjects}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchProjects();
          }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {query.trim()
                ? `No projects match "${query}"`
                : 'No public projects yet'}
            </Text>
          }
          renderItem={({ item }) => {
            const isSelected = selectedIds.has(item.id);
            return (
              <TouchableOpacity
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => {
                  if (selectionMode) toggleSelect(item.id);
                  else router.push(`/project/${item.id}/details?from=search`);
                }}
                onLongPress={() => handleLongPress(item.id)}
                delayLongPress={350}
                activeOpacity={0.8}
              >
                {selectionMode && (
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && (
                      <IconSymbol name="checkmark" size={16} color={YarnyColors.textSecondary} />
                    )}
                  </View>
                )}
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.cardImage} />
                ) : (
                  <View style={[styles.cardImage, { backgroundColor: YarnyColors.border }]} />
                )}
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardAuthor}>by {item.username}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: YarnyColors.background,
  },
  header: {
    backgroundColor: YarnyColors.button,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: YarnyFonts.header,
    fontSize: YarnySizes.subtitle,
    color: YarnyColors.textSecondary,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  headerAction: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.body,
    color: YarnyColors.textSecondary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: YarnyColors.border,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    paddingRight: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.body,
    color: YarnyColors.textPrimary,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  clearText: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.caption,
    color: YarnyColors.button,
  },
  list: {
    padding: 16,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: YarnyColors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: YarnyColors.button,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: YarnyColors.textSecondary,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: YarnyColors.button,
    borderColor: YarnyColors.button,
  },
  cardImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  cardTitle: {
    fontFamily: YarnyFonts.header,
    fontSize: YarnySizes.body,
    color: YarnyColors.textSecondary,
  },
  cardAuthor: {
    fontFamily: YarnyFonts.body,
    fontSize: 14,
    color: YarnyColors.textSecondary,
    marginTop: 2,
  },
  emptyText: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.body,
    color: YarnyColors.textPrimary,
    textAlign: 'center',
    marginTop: 40,
  },
});
