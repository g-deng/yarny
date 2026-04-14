import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useUser } from '@/hooks/use-user';
import {
  getUser,
  getUserPublicProjects,
  followUser,
  unfollowUser,
  type User,
  type Project,
} from '@/services/api';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { YarnyColors, YarnyFonts, YarnySizes } from '@/constants/theme';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId: viewerId } = useUser();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const isOwnProfile = viewerId === id;

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      (async () => {
        try {
          const [u, p] = await Promise.all([
            getUser(id, viewerId || undefined),
            getUserPublicProjects(id),
          ]);
          setUser(u);
          setProjects(p);
        } catch (err) {
          console.error('Failed to fetch user profile:', err);
        } finally {
          setLoading(false);
        }
      })();
    }, [id, viewerId])
  );

  const handleToggleFollow = async () => {
    if (!viewerId || !user || busy) return;
    const wasFollowing = !!user.is_following;
    setBusy(true);
    // Optimistic
    setUser({
      ...user,
      is_following: !wasFollowing,
      follower_count: (user.follower_count ?? 0) + (wasFollowing ? -1 : 1),
    });
    try {
      if (wasFollowing) await unfollowUser(viewerId, user.id);
      else await followUser(viewerId, user.id);
    } catch (err) {
      console.error('Follow toggle failed:', err);
      // revert
      setUser({
        ...user,
        is_following: wasFollowing,
        follower_count: user.follower_count,
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <IconSymbol name="chevron.right" size={22} color={YarnyColors.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.backButton} />
        </View>
        <ActivityIndicator size="large" color={YarnyColors.button} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.right" size={22} color={YarnyColors.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{user.username}</Text>
        <View style={styles.backButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {user.profile_photo_url ? (
          <Image source={{ uri: user.profile_photo_url }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.avatarFallback]}>
            <Text style={styles.avatarText}>
              {user.username?.charAt(0)?.toUpperCase() ?? '?'}
            </Text>
          </View>
        )}

        <Text style={styles.username}>{user.username}</Text>
        {user.created_at && (
          <Text style={styles.memberSince}>
            Member since {new Date(user.created_at).toLocaleDateString()}
          </Text>
        )}

        {user.bio ? (
          <Text style={styles.bio}>{user.bio}</Text>
        ) : (
          <Text style={styles.bioEmpty}>No bio yet</Text>
        )}

        <View style={styles.countsRow}>
          <TouchableOpacity
            style={styles.countItem}
            onPress={() => router.push(`/user/${id}/followers`)}
            activeOpacity={0.7}
          >
            <Text style={styles.countNumber}>{user.follower_count ?? 0}</Text>
            <Text style={styles.countLabel}>Followers</Text>
          </TouchableOpacity>
          <View style={styles.countDivider} />
          <TouchableOpacity
            style={styles.countItem}
            onPress={() => router.push(`/user/${id}/following`)}
            activeOpacity={0.7}
          >
            <Text style={styles.countNumber}>{user.following_count ?? 0}</Text>
            <Text style={styles.countLabel}>Following</Text>
          </TouchableOpacity>
        </View>

        {!isOwnProfile && (
          <TouchableOpacity
            style={[
              styles.followButton,
              user.is_following && styles.followingButton,
              busy && { opacity: 0.6 },
            ]}
            onPress={handleToggleFollow}
            disabled={busy}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.followButtonText,
                user.is_following && styles.followingButtonText,
              ]}
            >
              {user.is_following ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionHeader}>Public projects</Text>
        {projects.length === 0 ? (
          <Text style={styles.emptyProjects}>No public projects yet</Text>
        ) : (
          projects.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.projectCard}
              onPress={() => router.push(`/project/${p.id}/details?from=user`)}
              activeOpacity={0.8}
            >
              {p.image_url ? (
                <Image source={{ uri: p.image_url }} style={styles.projectImage} />
              ) : (
                <View style={[styles.projectImage, { backgroundColor: YarnyColors.border }]} />
              )}
              <Text style={styles.projectTitle} numberOfLines={1}>
                {p.title}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 32,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontFamily: YarnyFonts.header,
    fontSize: YarnySizes.subtitle,
    color: YarnyColors.textSecondary,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
  },
  avatarFallback: {
    backgroundColor: YarnyColors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: YarnyFonts.header,
    fontSize: YarnySizes.title,
    color: YarnyColors.textSecondary,
  },
  username: {
    fontFamily: YarnyFonts.header,
    fontSize: YarnySizes.subtitle,
    color: YarnyColors.textPrimary,
    marginBottom: 2,
  },
  memberSince: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.caption,
    color: YarnyColors.textPrimary,
    marginBottom: 12,
  },
  bio: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.body,
    color: YarnyColors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  bioEmpty: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.body,
    color: YarnyColors.border,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  countsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 24,
  },
  countItem: {
    alignItems: 'center',
  },
  countNumber: {
    fontFamily: YarnyFonts.header,
    fontSize: YarnySizes.subtitle,
    color: YarnyColors.textPrimary,
  },
  countLabel: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.caption,
    color: YarnyColors.textPrimary,
  },
  countDivider: {
    width: 1,
    height: 30,
    backgroundColor: YarnyColors.border,
  },
  followButton: {
    backgroundColor: YarnyColors.button,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 40,
    marginBottom: 24,
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: YarnyColors.button,
  },
  followButtonText: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.body,
    color: YarnyColors.textSecondary,
  },
  followingButtonText: {
    color: YarnyColors.button,
  },
  sectionHeader: {
    fontFamily: YarnyFonts.header,
    fontSize: YarnySizes.subtitle,
    color: YarnyColors.textPrimary,
    alignSelf: 'stretch',
    borderBottomWidth: 2,
    borderBottomColor: YarnyColors.button,
    paddingBottom: 4,
    marginBottom: 8,
  },
  emptyProjects: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.body,
    color: YarnyColors.border,
    fontStyle: 'italic',
    marginVertical: 16,
  },
  projectCard: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    backgroundColor: YarnyColors.card,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    alignItems: 'center',
  },
  projectImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  projectTitle: {
    flex: 1,
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.body,
    color: YarnyColors.textSecondary,
    marginLeft: 12,
  },
});
