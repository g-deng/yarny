import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useUser } from '@/hooks/use-user';
import { getUserProjects, deleteProject, type ProjectWithProgress } from '@/services/api';
import { ProjectCard } from '@/components/project-card';
import { BrutalShadow } from '@/components/brutal/brutal-shadow';
import {
  BrutalColors,
  BrutalFonts,
  BrutalTokens,
  YarnySizes,
} from '@/constants/theme';

export default function HomeScreen() {
  const { userId, loading: userLoading } = useUser();
  const [projects, setProjects] = useState<ProjectWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [inProgressCollapsed, setInProgressCollapsed] = useState(false);
  const [completedCollapsed, setCompletedCollapsed] = useState(false);
  const router = useRouter();

  const { inProgress, completed } = React.useMemo(() => {
    const ip: ProjectWithProgress[] = [];
    const done: ProjectWithProgress[] = [];
    for (const p of projects) {
      if (p.total_rows && p.total_rows > 0 && p.rows_completed >= p.total_rows) {
        done.push(p);
      } else {
        ip.push(p);
      }
    }
    return { inProgress: ip, completed: done };
  }, [projects]);

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
        <ActivityIndicator size="large" color={BrutalColors.outline} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerOuter}>
        <View style={styles.header}>
          {selectionMode ? (
            <View style={styles.selectionHeader}>
              <TouchableOpacity onPress={exitSelection} disabled={deleting}>
                <Text style={styles.headerAction}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>{selectedIds.size} SELECTED</Text>
              <TouchableOpacity onPress={confirmDelete} disabled={deleting}>
                <Text style={[styles.headerAction, styles.headerActionDanger]}>
                  {deleting ? '...' : 'DELETE'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.headerTitle}>HOME</Text>
          )}
        </View>
      </View>
      <Text style={styles.subtitle}>Let&apos;s make something amazing!</Text>

      {projects.length === 0 ? (
        <View style={styles.emptyState}>
          <BrutalShadow style={{ marginRight: BrutalTokens.shadowOffset.x }}>
            <TouchableOpacity
              style={styles.newButton}
              onPress={() => router.push('/(tabs)/create')}
              activeOpacity={0.85}
            >
              <Text style={styles.newButtonText}>NEW PROJECT</Text>
            </TouchableOpacity>
          </BrutalShadow>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchProjects();
              }}
              tintColor={BrutalColors.outline}
            />
          }
        >
          <SectionHeader
            title="In progress"
            count={inProgress.length}
            collapsed={inProgressCollapsed}
            color={BrutalColors.cyan}
            onToggle={() => setInProgressCollapsed((v) => !v)}
          />
          {!inProgressCollapsed &&
            (inProgress.length === 0 ? (
              <Text style={styles.emptySection}>No projects in progress</Text>
            ) : (
              inProgress.map((item) => renderProject(item))
            ))}

          <SectionHeader
            title="Completed"
            count={completed.length}
            collapsed={completedCollapsed}
            color={BrutalColors.lime}
            onToggle={() => setCompletedCollapsed((v) => !v)}
          />
          {!completedCollapsed &&
            (completed.length === 0 ? (
              <Text style={styles.emptySection}>No completed projects yet</Text>
            ) : (
              completed.map((item) => renderProject(item))
            ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );

  function renderProject(item: ProjectWithProgress) {
    const percent =
      item.total_rows && item.total_rows > 0
        ? (item.rows_completed / item.total_rows) * 100
        : 0;
    const isSelected = selectedIds.has(item.id);
    const isOwn = item.user_id === userId;
    return (
      <ProjectCard
        key={item.id}
        title={item.title}
        imageUrl={item.image_url}
        percentComplete={percent}
        lastWorkedAt={item.last_worked_at}
        isPublic={item.is_public}
        authorUsername={item.author_username}
        isOwn={isOwn}
        selectionMode={selectionMode}
        selected={isSelected}
        onLongPress={() => handleLongPress(item.id)}
        onPress={() => {
          if (selectionMode) toggleSelect(item.id);
          else router.push(`/project/${item.id}/details`);
        }}
      />
    );
  }
}

function SectionHeader({
  title,
  count,
  collapsed,
  color,
  onToggle,
}: {
  title: string;
  count: number;
  collapsed: boolean;
  color: string;
  onToggle: () => void;
}) {
  return (
    <BrutalShadow style={styles.sectionHeaderWrap}>
      <TouchableOpacity
        style={[styles.sectionHeader, { backgroundColor: color }]}
        onPress={onToggle}
        activeOpacity={0.85}
      >
        <Text style={styles.sectionHeaderText}>
          {title.toUpperCase()} ({count})
        </Text>
        <IconSymbol
          name="chevron.right"
          size={20}
          color={BrutalColors.outline}
          style={{ transform: [{ rotate: collapsed ? '0deg' : '90deg' }] }}
        />
      </TouchableOpacity>
    </BrutalShadow>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BrutalColors.background,
  },
  headerOuter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  header: {
    backgroundColor: BrutalColors.yellow,
    borderWidth: BrutalTokens.borderWidthThick,
    borderColor: BrutalColors.outline,
    borderRadius: BrutalTokens.radius,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.subtitle,
    color: BrutalColors.textPrimary,
    letterSpacing: 1.5,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  headerAction: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    letterSpacing: 1,
  },
  headerActionDanger: {
    color: BrutalColors.red,
  },
  subtitle: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.subtitle,
    color: BrutalColors.textPrimary,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  emptyState: {
    flex: 1,
    paddingHorizontal: 16,
  },
  newButton: {
    backgroundColor: BrutalColors.yellow,
    borderWidth: BrutalTokens.borderWidthThick,
    borderColor: BrutalColors.outline,
    borderRadius: BrutalTokens.radius,
    paddingVertical: 18,
    alignItems: 'center',
  },
  newButtonText: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    letterSpacing: 1.2,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sectionHeaderWrap: {
    marginTop: 12,
    marginBottom: 12,
    marginRight: BrutalTokens.shadowOffset.x,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: BrutalTokens.borderWidth,
    borderColor: BrutalColors.outline,
    borderRadius: BrutalTokens.radius,
  },
  sectionHeaderText: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    letterSpacing: 1,
  },
  emptySection: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: BrutalColors.outline,
    fontStyle: 'italic',
    marginBottom: 12,
    paddingLeft: 4,
  },
});
