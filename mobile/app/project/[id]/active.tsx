import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useUser } from '@/hooks/use-user';
import {
  getProjectDetail,
  getUserProjects,
  advanceProgress,
  type ProjectDetail,
  type Row,
} from '@/services/api';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { YarnyColors, YarnyFonts, YarnySizes } from '@/constants/theme';

export default function ActiveCrochetingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useUser();
  const router = useRouter();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [rowsCompleted, setRowsCompleted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id || !userId) return;
    try {
      const [detail, userProjects] = await Promise.all([
        getProjectDetail(id),
        getUserProjects(userId),
      ]);
      setProject(detail);
      const myProject = userProjects.find((p) => p.id === id);
      setRowsCompleted(myProject?.rows_completed ?? 0);
    } catch (err) {
      console.error('Failed to fetch project:', err);
    } finally {
      setLoading(false);
    }
  }, [id, userId]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  // Flatten all rows across sections, sorted by position
  const allRows: (Row & { sectionTitle: string })[] = [];
  if (project) {
    for (const section of project.sections) {
      for (const row of section.rows) {
        allRows.push({ ...row, sectionTitle: section.title });
      }
    }
    allRows.sort((a, b) => a.position - b.position);
  }

  const currentRow = allRows[rowsCompleted] ?? null;
  const isComplete = project && rowsCompleted >= allRows.length;

  const handleNextRow = async () => {
    if (!userId || !id || advancing) return;
    setAdvancing(true);
    try {
      await advanceProgress(userId, id, 1);
      setRowsCompleted((prev) => prev + 1);
    } catch (err) {
      console.error('Failed to advance:', err);
    } finally {
      setAdvancing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={YarnyColors.button} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!project) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Project not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.backButton}>
          <IconSymbol name="chevron.right" size={24} color={YarnyColors.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{project.title}</Text>
      </View>

      {project.image_url ? (
        <Image source={{ uri: project.image_url }} style={styles.projectImage} contentFit="cover" />
      ) : (
        <View style={[styles.projectImage, { backgroundColor: YarnyColors.border }]} />
      )}

      <View style={styles.bottomCard}>
        {isComplete ? (
          <Text style={styles.instruction}>Project complete!</Text>
        ) : currentRow ? (
          <>
            <Text style={styles.sectionName}>Section: {currentRow.sectionTitle}</Text>
            <Text style={styles.instruction}>
              Row {currentRow.row_number}: {currentRow.instruction}
            </Text>
          </>
        ) : (
          <Text style={styles.instruction}>Upload a pattern to get started</Text>
        )}

        <TouchableOpacity
          style={[styles.nextButton, (isComplete || !currentRow) && styles.buttonDisabled]}
          onPress={handleNextRow}
          disabled={isComplete || !currentRow || advancing}
          activeOpacity={0.8}
        >
          {advancing ? (
            <ActivityIndicator color={YarnyColors.textSecondary} />
          ) : (
            <Text style={styles.nextButtonText}>Next row</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.detailsButton}
          onPress={() => router.push(`/project/${id}/details`)}
          activeOpacity={0.8}
        >
          <Text style={styles.detailsButtonText}>Pattern details</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: YarnyColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: YarnyColors.button,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    fontFamily: YarnyFonts.header,
    fontSize: YarnySizes.subtitle,
    color: YarnyColors.textSecondary,
  },
  projectImage: {
    width: '100%',
    flex: 1,
  },
  bottomCard: {
    backgroundColor: YarnyColors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  sectionName: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.body,
    color: YarnyColors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  instruction: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.body,
    color: YarnyColors.textSecondary,
    marginBottom: 16,
  },
  nextButton: {
    backgroundColor: YarnyColors.button,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  nextButtonText: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.body,
    color: YarnyColors.textSecondary,
  },
  detailsButton: {
    borderWidth: 2,
    borderColor: YarnyColors.button,
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  detailsButtonText: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.body,
    color: YarnyColors.textSecondary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  errorText: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.body,
    color: YarnyColors.textPrimary,
    textAlign: 'center',
    marginTop: 40,
  },
});
