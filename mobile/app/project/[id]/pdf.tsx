import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useUser } from '@/hooks/use-user';
import {
  getProjectDetail,
  getUserProjects,
  removeProjectTracking,
  type ProjectDetail,
} from '@/services/api';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { YarnyColors, YarnyFonts, YarnySizes } from '@/constants/theme';

export default function PdfViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useUser();
  const router = useRouter();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isOwnProject, setIsOwnProject] = useState(false);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!id || !userId) return;
      (async () => {
        try {
          const [detail, userProjects] = await Promise.all([
            getProjectDetail(id, userId),
            getUserProjects(userId),
          ]);
          setProject(detail);
          setIsOwnProject(detail.user_id === userId);
          setIsTracking(!!userProjects.find((p) => p.id === id));
        } catch (err) {
          console.error('Failed to fetch project:', err);
        } finally {
          setLoading(false);
        }
      })();
    }, [id, userId])
  );

  const handleRemoveProject = async () => {
    if (!userId || !id) return;
    setAdding(true);
    try {
      await removeProjectTracking(userId, id);
      setIsTracking(false);
    } catch (err) {
      console.error('Failed to remove project:', err);
    } finally {
      setAdding(false);
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

  const pdfUrl = project.pdf_url;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.replace(`/project/${id}/details`)}
          style={styles.backButton}
        >
          <IconSymbol name="chevron.right" size={24} color={YarnyColors.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pdf Viewer</Text>
      </View>

      {!isOwnProject && isTracking && (
        <TouchableOpacity
          style={[styles.removeButton, adding && styles.addButtonDisabled]}
          onPress={handleRemoveProject}
          disabled={adding}
          activeOpacity={0.8}
        >
          {adding ? (
            <ActivityIndicator color={YarnyColors.button} />
          ) : (
            <Text style={styles.removeButtonText}>Remove from library</Text>
          )}
        </TouchableOpacity>
      )}

      {pdfUrl ? (
        Platform.OS === 'web' ? (
          <iframe
            src={`https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(pdfUrl)}`}
            style={{ flex: 1, border: 'none', margin: 16, borderRadius: 8 } as any}
          />
        ) : (
          (() => {
            const { WebView } = require('react-native-webview');
            return (
              <WebView
                source={{ uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(pdfUrl)}` }}
                style={styles.webview}
                startInLoadingState
                renderLoading={() => (
                  <ActivityIndicator size="large" color={YarnyColors.button} style={{ flex: 1 }} />
                )}
              />
            );
          })()
        )
      ) : (
        <View style={styles.noPdf}>
          <Text style={styles.noPdfText}>No PDF available for this project</Text>
        </View>
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
  addButton: {
    backgroundColor: YarnyColors.button,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    margin: 16,
    marginBottom: 0,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.body,
    color: YarnyColors.textSecondary,
  },
  removeButton: {
    borderWidth: 2,
    borderColor: YarnyColors.button,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    margin: 16,
    marginBottom: 0,
  },
  removeButtonText: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.body,
    color: YarnyColors.button,
  },
  webview: {
    flex: 1,
    margin: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  noPdf: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPdfText: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.body,
    color: YarnyColors.textPrimary,
  },
  errorText: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.body,
    color: YarnyColors.textPrimary,
    textAlign: 'center',
    marginTop: 40,
  },
});
