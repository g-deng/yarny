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
import {
  BrutalColors,
  BrutalFonts,
  BrutalTokens,
  YarnySizes,
} from '@/constants/theme';
import { BrutalShadow } from '@/components/brutal/brutal-shadow';

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
            <IconSymbol name="chevron.right" size={22} color={BrutalColors.outline} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>PROFILE</Text>
          <View style={styles.backButton} />
        </View>
        <ActivityIndicator size="large" color={BrutalColors.outline} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.right" size={22} color={BrutalColors.outline} style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{user.username.toUpperCase()}</Text>
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
          <BrutalShadow style={styles.followButtonShadow}>
            <TouchableOpacity
              style={[
                styles.followButton,
                user.is_following && styles.followingButton,
                busy && { opacity: 0.6 },
              ]}
              onPress={handleToggleFollow}
              disabled={busy}
              activeOpacity={0.85}
            >
              <Text style={styles.followButtonText}>
                {user.is_following ? 'FOLLOWING' : 'FOLLOW'}
              </Text>
            </TouchableOpacity>
          </BrutalShadow>
        )}

        <Text style={styles.sectionHeader}>PUBLIC PROJECTS</Text>
        {projects.length === 0 ? (
          <Text style={styles.emptyProjects}>No public projects yet</Text>
        ) : (
          projects.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.projectCard}
              onPress={() => router.push(`/project/${p.id}/details?from=user`)}
              activeOpacity={0.85}
            >
              {p.image_url ? (
                <Image source={{ uri: p.image_url }} style={styles.projectImage} />
              ) : (
                <View style={[styles.projectImage, { backgroundColor: BrutalColors.yellow }]} />
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
    backgroundColor: BrutalColors.background,
  },
  header: {
    backgroundColor: BrutalColors.yellow,
    borderBottomWidth: BrutalTokens.borderWidthThick,
    borderBottomColor: BrutalColors.outline,
    paddingVertical: 14,
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
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.subtitle,
    color: BrutalColors.textPrimary,
    letterSpacing: 1,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  photo: {
    width: 110,
    height: 110,
    borderRadius: 55,
    marginBottom: 12,
    borderWidth: BrutalTokens.borderWidthThick,
    borderColor: BrutalColors.outline,
  },
  avatarFallback: {
    backgroundColor: BrutalColors.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.title,
    color: BrutalColors.textPrimary,
  },
  username: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.subtitle,
    color: BrutalColors.textPrimary,
    marginBottom: 2,
  },
  memberSince: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.caption,
    color: BrutalColors.textPrimary,
    marginBottom: 12,
  },
  bio: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  bioEmpty: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: '#8A8A8A',
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
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.subtitle,
    color: BrutalColors.textPrimary,
  },
  countLabel: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.caption,
    color: BrutalColors.textPrimary,
  },
  countDivider: {
    width: 2,
    height: 30,
    backgroundColor: BrutalColors.outline,
  },
  followButtonShadow: {
    marginBottom: 24,
    marginRight: BrutalTokens.shadowOffset.x,
  },
  followButton: {
    backgroundColor: BrutalColors.pink,
    borderRadius: BrutalTokens.radius,
    borderWidth: BrutalTokens.borderWidthThick,
    borderColor: BrutalColors.outline,
    paddingVertical: 12,
    paddingHorizontal: 40,
  },
  followingButton: {
    backgroundColor: BrutalColors.lime,
  },
  followButtonText: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    letterSpacing: 1,
  },
  sectionHeader: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.subtitle,
    color: BrutalColors.textPrimary,
    alignSelf: 'stretch',
    borderBottomWidth: BrutalTokens.borderWidthThick,
    borderBottomColor: BrutalColors.outline,
    paddingBottom: 4,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  emptyProjects: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: '#8A8A8A',
    fontStyle: 'italic',
    marginVertical: 16,
  },
  projectCard: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    backgroundColor: BrutalColors.surface,
    borderRadius: BrutalTokens.radius,
    borderWidth: BrutalTokens.borderWidth,
    borderColor: BrutalColors.outline,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  projectImage: {
    width: 50,
    height: 50,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: BrutalColors.outline,
  },
  projectTitle: {
    flex: 1,
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    marginLeft: 12,
  },
});
