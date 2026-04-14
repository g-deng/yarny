import React, { useEffect, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import {
  BrutalColors,
  BrutalFonts,
  BrutalTokens,
  YarnySizes,
} from '@/constants/theme';
import { BrutalShadow } from '@/components/brutal/brutal-shadow';
import type { User } from '@/services/api';

interface Props {
  title: string;
  fetcher: () => Promise<User[]>;
}

export function UserListScreen({ title, fetcher }: Props) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setUsers(await fetcher());
      } catch (err) {
        console.error(`Failed to fetch ${title}:`, err);
      } finally {
        setLoading(false);
      }
    })();
  }, [fetcher, title]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol
            name="chevron.right"
            size={22}
            color={BrutalColors.outline}
            style={{ transform: [{ rotate: '180deg' }] }}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title.toUpperCase()}</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={BrutalColors.outline} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No users yet</Text>}
          renderItem={({ item }) => (
            <BrutalShadow style={styles.rowShadow}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => router.push(`/user/${item.id}`)}
                activeOpacity={0.85}
              >
                {item.profile_photo_url ? (
                  <Image source={{ uri: item.profile_photo_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarText}>
                      {item.username.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.username}>{item.username}</Text>
              </TouchableOpacity>
            </BrutalShadow>
          )}
        />
      )}
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
    letterSpacing: 1.5,
  },
  list: {
    padding: 16,
  },
  rowShadow: {
    marginBottom: 14,
    marginRight: BrutalTokens.shadowOffset.x,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrutalColors.surface,
    borderRadius: BrutalTokens.radius,
    borderWidth: BrutalTokens.borderWidth,
    borderColor: BrutalColors.outline,
    padding: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: BrutalTokens.borderWidth,
    borderColor: BrutalColors.outline,
  },
  avatarFallback: {
    backgroundColor: BrutalColors.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: BrutalFonts.black,
    fontSize: 22,
    color: BrutalColors.textPrimary,
  },
  username: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    marginLeft: 12,
  },
  emptyText: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    textAlign: 'center',
    marginTop: 40,
    fontStyle: 'italic',
  },
});
