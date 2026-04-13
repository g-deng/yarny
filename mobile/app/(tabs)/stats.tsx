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
import { YarnyColors, YarnyFonts, YarnySizes } from '@/constants/theme';

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
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Statistics</Text>
        </View>
        <ActivityIndicator size="large" color={YarnyColors.button} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Statistics</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {stats ? (
          <>
            <StatCard
              title="Today"
              stats={[
                { label: 'rows', value: stats.rows.today },
                { label: 'yards of yarn', value: stats.yards.used },
              ]}
            />
            <StatCard
              title="All Time"
              stats={[
                { label: 'rows', value: stats.rows.all_time.toLocaleString() },
                { label: 'yards of yarn', value: stats.yards.used.toLocaleString() },
              ]}
            />

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
    padding: 16,
  },
  recordCard: {
    backgroundColor: YarnyColors.card,
    borderRadius: 12,
    padding: 16,
  },
  recordTitle: {
    fontFamily: YarnyFonts.header,
    fontSize: YarnySizes.body,
    color: YarnyColors.textSecondary,
    marginBottom: 12,
  },
  placeholderText: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.body,
    color: YarnyColors.textSecondary,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: YarnyColors.border,
    gap: 12,
  },
  activityDelta: {
    fontFamily: YarnyFonts.bodyBold,
    fontSize: YarnySizes.body,
    color: YarnyColors.textSecondary,
    minWidth: 70,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.body,
    color: YarnyColors.textSecondary,
  },
  activityTime: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.caption,
    color: YarnyColors.border,
    fontStyle: 'italic',
    marginTop: 2,
  },
  noData: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.body,
    color: YarnyColors.textPrimary,
    textAlign: 'center',
    marginTop: 40,
  },
  expandButton: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  expandButtonText: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.caption,
    color: YarnyColors.textSecondary,
    textDecorationLine: 'underline',
  },
});
