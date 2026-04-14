import React, { useState, useCallback, useMemo, useEffect } from 'react';
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
  searchUsers,
  type ProjectWithUser,
  type User,
} from '@/services/api';
import { useUser } from '@/hooks/use-user';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ToggleSwitch } from '@/components/toggle-switch';
import { YarnyColors, YarnyFonts, YarnySizes } from '@/constants/theme';

type SearchMode = 'projects' | 'users';
type ProjectFilter = 'all' | 'following';

export default function FeedScreen() {
  const { userId } = useUser();
  const router = useRouter();

  // false = projects, true = users
  const [modeIsUsers, setModeIsUsers] = useState(false);
  // false = all, true = following
  const [filterIsFollowing, setFilterIsFollowing] = useState(false);
  const searchMode: SearchMode = modeIsUsers ? 'users' : 'projects';
  const projectFilter: ProjectFilter = filterIsFollowing ? 'following' : 'all';

  const [projects, setProjects] = useState<ProjectWithUser[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

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
    if (!userId) return;
    try {
      const data = await getPublicProjects({
        filter: projectFilter,
        viewerId: userId,
        sort: projectFilter === 'following' ? 'created' : 'adds',
      });
      setProjects(data);
    } catch (err) {
      console.error('Failed to fetch public projects:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, projectFilter]);

  // Debounced user search
  useEffect(() => {
    if (searchMode !== 'users') return;
    if (!query.trim()) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await searchUsers(query.trim(), userId || undefined);
        setUsers(data);
      } catch (err) {
        console.error('Failed to search users:', err);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchMode, query, userId]);

  useFocusEffect(
    useCallback(() => {
      if (searchMode === 'projects') {
        setLoading(true);
        fetchProjects();
      }
    }, [searchMode, fetchProjects])
  );

  // Re-fetch projects whenever filter changes
  useEffect(() => {
    if (searchMode === 'projects') {
      setLoading(true);
      fetchProjects();
    }
  }, [projectFilter, searchMode, fetchProjects]);

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
          <Text style={styles.headerTitle}>Feed</Text>
        )}
      </View>

      <View style={styles.searchBar}>
        <IconSymbol name="magnifyingglass" size={18} color={YarnyColors.border} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={
            searchMode === 'users' ? 'Search users...' : 'Search patterns or users...'
          }
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

      <View style={styles.toggles}>
        <ToggleSwitch
          value={modeIsUsers}
          onToggle={setModeIsUsers}
          leftLabel="Projects"
          rightLabel="Users"
        />
        {searchMode === 'projects' && (
          <ToggleSwitch
            value={filterIsFollowing}
            onToggle={setFilterIsFollowing}
            leftLabel="All"
            rightLabel="Following"
          />
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={YarnyColors.button} style={{ flex: 1 }} />
      ) : searchMode === 'users' ? (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {query.trim() ? `No users match "${query}"` : 'Start typing to search users'}
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.userCard}
              onPress={() => router.push(`/user/${item.id}`)}
              activeOpacity={0.8}
            >
              {item.profile_photo_url ? (
                <Image source={{ uri: item.profile_photo_url }} style={styles.userAvatar} />
              ) : (
                <View style={[styles.userAvatar, styles.userAvatarFallback]}>
                  <Text style={styles.userAvatarText}>
                    {item.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.username}</Text>
                <Text style={styles.userMeta}>
                  {item.follower_count ?? 0}{' '}
                  {item.follower_count === 1 ? 'follower' : 'followers'}
                </Text>
              </View>
              {item.is_following && (
                <View style={styles.followingBadge}>
                  <Text style={styles.followingBadgeText}>Following</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
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
                : projectFilter === 'following'
                ? "You aren't following anyone with public projects yet"
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
                  <View style={styles.cardAuthorRow}>
                    {item.profile_photo_url ? (
                      <Image
                        source={{ uri: item.profile_photo_url }}
                        style={styles.cardAuthorAvatar}
                      />
                    ) : (
                      <View style={[styles.cardAuthorAvatar, styles.cardAuthorAvatarFallback]}>
                        <Text style={styles.cardAuthorAvatarText}>
                          {item.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.cardAuthor}>by @{item.username}</Text>
                  </View>
                  <View style={styles.cardMetaRow}>
                    <IconSymbol name="plus.circle.fill" size={14} color={YarnyColors.textSecondary} />
                    <Text style={styles.cardMeta}>
                      {item.adds_count ?? 0} {item.adds_count === 1 ? 'add' : 'adds'}
                    </Text>
                  </View>
                  {(item.project_type || item.yarn_weight !== null || item.hook_size !== null) && (
                    <View style={styles.cardTagRow}>
                      {item.project_type && (
                        <View style={styles.cardTag}>
                          <Text style={styles.cardTagText}>{item.project_type}</Text>
                        </View>
                      )}
                      {item.yarn_weight !== null && (
                        <View style={styles.cardTag}>
                          <Text style={styles.cardTagText}>Weight {item.yarn_weight}</Text>
                        </View>
                      )}
                      {item.hook_size !== null && (
                        <View style={styles.cardTag}>
                          <Text style={styles.cardTagText}>{item.hook_size}mm</Text>
                        </View>
                      )}
                    </View>
                  )}
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
    paddingLeft: 12,
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
  toggles: {
    paddingHorizontal: 16,
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
  cardAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  cardAuthorAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  cardAuthorAvatarFallback: {
    backgroundColor: YarnyColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardAuthorAvatarText: {
    fontFamily: YarnyFonts.header,
    fontSize: 10,
    color: YarnyColors.textPrimary,
  },
  cardAuthor: {
    fontFamily: YarnyFonts.body,
    fontSize: 14,
    color: YarnyColors.textSecondary,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  cardMeta: {
    fontFamily: YarnyFonts.body,
    fontSize: 12,
    color: YarnyColors.textSecondary,
  },
  cardTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  cardTag: {
    backgroundColor: YarnyColors.button,
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  cardTagText: {
    fontFamily: YarnyFonts.body,
    fontSize: 11,
    color: YarnyColors.textSecondary,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: YarnyColors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  userAvatarFallback: {
    backgroundColor: YarnyColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontFamily: YarnyFonts.header,
    fontSize: 22,
    color: YarnyColors.textPrimary,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontFamily: YarnyFonts.header,
    fontSize: YarnySizes.body,
    color: YarnyColors.textSecondary,
  },
  userMeta: {
    fontFamily: YarnyFonts.body,
    fontSize: 13,
    color: YarnyColors.textSecondary,
    marginTop: 2,
  },
  followingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: YarnyColors.textSecondary,
  },
  followingBadgeText: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: 12,
    color: YarnyColors.textSecondary,
  },
  emptyText: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.body,
    color: YarnyColors.textPrimary,
    textAlign: 'center',
    marginTop: 40,
  },
});
