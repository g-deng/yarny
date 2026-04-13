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
import { getUser, getUserPublicProjects, type User, type Project } from '@/services/api';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { YarnyColors, YarnyFonts, YarnySizes } from '@/constants/theme';

export default function ProfileScreen() {
  const { userId, loading: userLoading, logOut } = useUser();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      (async () => {
        try {
          const [u, p] = await Promise.all([
            getUser(userId),
            getUserPublicProjects(userId),
          ]);
          setUser(u);
          setProjects(p);
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
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <ActivityIndicator size="large" color={YarnyColors.button} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
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

        <TouchableOpacity
          style={styles.editButton}
          onPress={() => router.push('/edit-profile')}
          activeOpacity={0.8}
        >
          <Text style={styles.editButtonText}>Edit profile</Text>
        </TouchableOpacity>

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
                <View style={[styles.projectImage, { backgroundColor: YarnyColors.border }]} />
              )}
              <Text style={styles.projectTitle} numberOfLines={1}>
                {p.title}
              </Text>
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={async () => {
            await logOut();
            router.replace('/welcome');
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutButtonText}>Log out</Text>
        </TouchableOpacity>
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
    alignItems: 'center',
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
  editButton: {
    borderWidth: 2,
    borderColor: YarnyColors.button,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 32,
    marginBottom: 24,
  },
  editButtonText: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.body,
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
  logoutButton: {
    borderWidth: 2,
    borderColor: YarnyColors.button,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 48,
    marginTop: 24,
  },
  logoutButtonText: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.body,
    color: YarnyColors.button,
  },
});
