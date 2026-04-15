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
import { useRouter } from 'expo-router';
import { useUser } from '@/hooks/use-user';
import {
  getUser,
  getUserPublicProjects,
  getUserProjects,
  type User,
  type Project,
  type ProjectWithProgress,
} from '@/services/api';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrutalColors, BrutalFonts, BrutalTokens, YarnySizes } from '@/constants/theme';
import { BrutalShadow } from '@/components/brutal/brutal-shadow';

export default function ProfileScreen() {
  const { userId, loading: userLoading, logOut } = useUser();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [inProgress, setInProgress] = useState<ProjectWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      (async () => {
        try {
          const [u, p, mine] = await Promise.all([
            getUser(userId, userId),
            getUserPublicProjects(userId),
            getUserProjects(userId),
          ]);
          setUser(u);
          setProjects(p);
          setInProgress(
            mine.filter(
              (pr) =>
                !(pr.total_rows && pr.total_rows > 0 && pr.rows_completed >= pr.total_rows)
            )
          );
        } catch (err) {
          console.error('Failed to fetch profile:', err);
        } finally {
          setLoading(false);
        }
      })();
    }, [userId])
  );

  if (userLoading || loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>PROFILE</Text>
        </View>
        <ActivityIndicator size="large" color={BrutalColors.outline} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PROFILE</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {user?.profile_photo_url ? (
          <Image source={{ uri: user.profile_photo_url }} style={styles.photo} />
        ) : (
          <View style={[styles.photo, styles.avatarFallback]}>
            <Text style={styles.avatarText}>
              {user?.username?.charAt(0)?.toUpperCase() ?? '?'}
            </Text>
          </View>
        )}

        <Text style={styles.username}>{user?.username ?? 'Unknown'}</Text>
        {user?.created_at && (
          <Text style={styles.memberSince}>
            Member since {new Date(user.created_at).toLocaleDateString()}
          </Text>
        )}

        {user?.bio ? (
          <Text style={styles.bio}>{user.bio}</Text>
        ) : (
          <Text style={styles.bioEmpty}>No bio yet</Text>
        )}

        <View style={styles.countsRow}>
          <TouchableOpacity
            style={styles.countItem}
            onPress={() => userId && router.push(`/user/${userId}/followers`)}
            activeOpacity={0.7}
          >
            <Text style={styles.countNumber}>{user?.follower_count ?? 0}</Text>
            <Text style={styles.countLabel}>Followers</Text>
          </TouchableOpacity>
          <View style={styles.countDivider} />
          <TouchableOpacity
            style={styles.countItem}
            onPress={() => userId && router.push(`/user/${userId}/following`)}
            activeOpacity={0.7}
          >
            <Text style={styles.countNumber}>{user?.following_count ?? 0}</Text>
            <Text style={styles.countLabel}>Following</Text>
          </TouchableOpacity>
        </View>

        <BrutalShadow style={styles.editButtonShadow}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push('/edit-profile')}
            activeOpacity={0.85}
          >
            <Text style={styles.editButtonText}>EDIT PROFILE</Text>
          </TouchableOpacity>
        </BrutalShadow>

        <Text style={styles.sectionHeader}>In progress</Text>
        {inProgress.length === 0 ? (
          <Text style={styles.emptyProjects}>No projects in progress</Text>
        ) : (
          inProgress.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.projectCard}
              onPress={() => router.push(`/project/${p.id}/active`)}
              activeOpacity={0.8}
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

        <Text style={styles.sectionHeader}>My public projects</Text>
        {projects.length === 0 ? (
          <Text style={styles.emptyProjects}>No public projects yet</Text>
        ) : (
          projects.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.projectCard}
              onPress={() => router.push(`/project/${p.id}/details?from=profile`)}
              activeOpacity={0.8}
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

        <BrutalShadow style={styles.logoutButtonShadow}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={async () => {
              await logOut();
              router.replace('/welcome');
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.logoutButtonText}>LOG OUT</Text>
          </TouchableOpacity>
        </BrutalShadow>
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
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.subtitle,
    color: BrutalColors.textPrimary,
    letterSpacing: 1.5,
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
    letterSpacing: 0.5,
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
  editButtonShadow: {
    marginBottom: 24,
    marginRight: BrutalTokens.shadowOffset.x,
  },
  editButton: {
    backgroundColor: BrutalColors.cyan,
    borderWidth: BrutalTokens.borderWidthThick,
    borderColor: BrutalColors.outline,
    borderRadius: BrutalTokens.radius,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  editButtonText: {
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
    marginTop: 16,
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
    letterSpacing: 0.3,
  },
  logoutButtonShadow: {
    marginTop: 24,
    marginRight: BrutalTokens.shadowOffset.x,
  },
  logoutButton: {
    backgroundColor: BrutalColors.red,
    borderWidth: BrutalTokens.borderWidthThick,
    borderColor: BrutalColors.outline,
    borderRadius: BrutalTokens.radius,
    paddingVertical: 14,
    paddingHorizontal: 48,
  },
  logoutButtonText: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    letterSpacing: 1.2,
  },
});
