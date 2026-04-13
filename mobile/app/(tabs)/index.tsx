import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useUser } from '@/hooks/use-user';
import { getUserProjects, type ProjectWithProgress } from '@/services/api';
import { ProjectCard } from '@/components/project-card';
import { YarnyColors, YarnyFonts, YarnySizes } from '@/constants/theme';

export default function HomeScreen() {
  const { userId, loading: userLoading } = useUser();
  const [projects, setProjects] = useState<ProjectWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

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
        <Text style={styles.headerTitle}>Home</Text>
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
            return (
              <ProjectCard
                title={item.title}
                imageUrl={item.image_url}
                percentComplete={percent}
                lastWorkedAt={item.last_worked_at}
                isPublic={item.is_public}
                onPress={() => router.push(`/project/${item.id}/active`)}
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
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: YarnyFonts.header,
    fontSize: YarnySizes.subtitle,
    color: YarnyColors.textSecondary,
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
