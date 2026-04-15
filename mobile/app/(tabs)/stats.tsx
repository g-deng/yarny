import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useUser } from '@/hooks/use-user';
import {
  getUserStats,
  getActivityLog,
  type UserStats,
  type ActivityLogEntry,
} from '@/services/api';
import { StatCard } from '@/components/stat-card';
import { BrutalShadow } from '@/components/brutal/brutal-shadow';
import { BrutalColors, BrutalFonts, BrutalTokens, YarnySizes } from '@/constants/theme';

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export default function StatsScreen() {
  const { userId, loading: userLoading } = useUser();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      (async () => {
        try {
          const [s, a] = await Promise.all([
            getUserStats(userId),
            getActivityLog(userId),
          ]);
          setStats(s);
          setActivity(a);
        } catch (err) {
          console.error('Failed to fetch stats:', err);
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
          <Text style={styles.headerTitle}>STATISTICS</Text>
        </View>
        <ActivityIndicator size="large" color={BrutalColors.outline} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>STATISTICS</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {stats ? (
          <>
            <StatCard
              title="Today"
              color={BrutalColors.yellow}
              stats={[
                { label: 'rows', value: stats.rows.today },
                { label: 'yards of yarn', value: stats.yards.used },
              ]}
            />
            <StatCard
              title="All Time"
              color={BrutalColors.cyan}
              stats={[
                { label: 'rows', value: stats.rows.all_time.toLocaleString() },
                { label: 'yards of yarn', value: stats.yards.used.toLocaleString() },
              ]}
            />

            <BrutalShadow style={styles.recordShadow}>
            <View style={styles.recordCard}>
              <Text style={styles.recordTitle}>Recent Activity</Text>
              {activity.length === 0 ? (
                <Text style={styles.placeholderText}>No activity yet</Text>
              ) : (
                <>
                  {(expanded ? activity : activity.slice(0, 5)).map((entry, i) => (
                    <View key={i} style={styles.activityRow}>
                      <Text style={styles.activityDelta}>
                        {entry.rows_added > 0 ? '+' : ''}
                        {entry.rows_added} {Math.abs(entry.rows_added) === 1 ? 'row' : 'rows'}
                      </Text>
                      <View style={styles.activityInfo}>
                        <Text style={styles.activityTitle} numberOfLines={1}>
                          {entry.project_title}
                        </Text>
                        <Text style={styles.activityTime}>{formatRelativeTime(entry.logged_at)}</Text>
                      </View>
                    </View>
                  ))}
                  {activity.length > 5 && (
                    <TouchableOpacity
                      style={styles.expandButton}
                      onPress={() => setExpanded((e) => !e)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.expandButtonText}>
                        {expanded ? 'Show less' : `Show all (${activity.length})`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
            </BrutalShadow>
          </>
        ) : (
          <Text style={styles.noData}>No stats yet. Start a project!</Text>
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
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.subtitle,
    color: BrutalColors.textPrimary,
    letterSpacing: 1.5,
  },
  content: {
    padding: 16,
  },
  recordShadow: {
    marginRight: BrutalTokens.shadowOffset.x,
  },
  recordCard: {
    backgroundColor: BrutalColors.lime,
    borderRadius: BrutalTokens.radius,
    borderWidth: BrutalTokens.borderWidthThick,
    borderColor: BrutalColors.outline,
    padding: 16,
  },
  recordTitle: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  placeholderText: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: BrutalColors.outline,
    gap: 12,
  },
  activityDelta: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    minWidth: 70,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontFamily: BrutalFonts.bold,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
  },
  activityTime: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.caption,
    color: BrutalColors.textPrimary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  noData: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    textAlign: 'center',
    marginTop: 40,
  },
  expandButton: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  expandButtonText: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.caption,
    color: BrutalColors.textPrimary,
    textDecorationLine: 'underline',
    letterSpacing: 0.5,
  },
});
