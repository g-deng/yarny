import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useUser } from '@/hooks/use-user';
import { getUserProjects, deleteProject, type ProjectWithProgress } from '@/services/api';
import { ProjectCard } from '@/components/project-card';
import { YarnyColors, YarnyFonts, YarnySizes } from '@/constants/theme';

export default function HomeScreen() {
  const { userId, loading: userLoading } = useUser();
  const [projects, setProjects] = useState<ProjectWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
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

  const fetchProjects = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await getUserProjects(userId);
      setProjects(data);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  const confirmDelete = useCallback(() => {
    if (!userId || selectedIds.size === 0) return;
    const count = selectedIds.size;
    Alert.alert(
      `Delete ${count} project${count === 1 ? '' : 's'}?`,
      'This will remove them from your home screen. Projects you own will be deleted permanently.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await Promise.all(
                Array.from(selectedIds).map((id) => deleteProject(id, userId))
              );
              exitSelection();
              await fetchProjects();
            } catch (err) {
              console.error('Failed to delete projects:', err);
              Alert.alert('Error', 'Failed to delete some projects.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [userId, selectedIds, exitSelection, fetchProjects]);

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        setLoading(true);
        fetchProjects();
      }
    }, [userId, fetchProjects])
  );

  if (userLoading || loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={YarnyColors.button} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {selectionMode ? (
          <View style={styles.selectionHeader}>
            <TouchableOpacity onPress={exitSelection} disabled={deleting}>
              <Text style={styles.headerAction}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{selectedIds.size} selected</Text>
            <TouchableOpacity onPress={confirmDelete} disabled={deleting}>
              <Text style={[styles.headerAction, styles.headerActionDanger]}>
                {deleting ? '...' : 'Delete'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.headerTitle}>Home</Text>
        )}
      </View>
      <Text style={styles.subtitle}>Let's make something amazing!</Text>

      {projects.length === 0 ? (
        <View style={styles.emptyState}>
          <TouchableOpacity
            style={styles.newButton}
            onPress={() => router.push('/(tabs)/create')}
            activeOpacity={0.8}
          >
            <Text style={styles.newButtonText}>New project</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchProjects();
          }}
          renderItem={({ item }) => {
            const percent =
              item.total_rows && item.total_rows > 0
                ? (item.rows_completed / item.total_rows) * 100
                : 0;
            const isSelected = selectedIds.has(item.id);
            return (
              <ProjectCard
                title={item.title}
                imageUrl={item.image_url}
                percentComplete={percent}
                lastWorkedAt={item.last_worked_at}
                isPublic={item.is_public}
                selectionMode={selectionMode}
                selected={isSelected}
                onLongPress={() => handleLongPress(item.id)}
                onPress={() => {
                  if (selectionMode) toggleSelect(item.id);
                  else router.push(`/project/${item.id}/active`);
                }}
              />
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
  headerActionDanger: {
    color: '#ffdede',
  },
  subtitle: {
    fontFamily: YarnyFonts.header,
    fontSize: YarnySizes.subtitle,
    color: YarnyColors.textPrimary,
    padding: 16,
  },
  emptyState: {
    flex: 1,
    paddingHorizontal: 16,
  },
  newButton: {
    backgroundColor: YarnyColors.card,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  newButtonText: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.body,
    color: YarnyColors.textSecondary,
  },
  list: {
    paddingHorizontal: 16,
  },
});
