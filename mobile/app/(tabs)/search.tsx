import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { getPublicProjects, type ProjectWithUser } from '@/services/api';
import { YarnyColors, YarnyFonts, YarnySizes } from '@/constants/theme';

export default function SearchScreen() {
  const [projects, setProjects] = useState<ProjectWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Search</Text>
        </View>
        <ActivityIndicator size="large" color={YarnyColors.button} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
      </View>
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          fetchProjects();
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No public projects yet</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/project/${item.id}/details`)}
            activeOpacity={0.8}
          >
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
        )}
      />
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
