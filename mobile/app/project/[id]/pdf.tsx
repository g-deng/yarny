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
  type ProjectDetail,
} from '@/services/api';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrutalColors, BrutalFonts, YarnySizes } from '@/constants/theme';

export default function PdfViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useUser();
  const router = useRouter();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!id || !userId) return;
      (async () => {
        try {
          const detail = await getProjectDetail(id, userId);
          setProject(detail);
        } catch (err) {
          console.error('Failed to fetch project:', err);
        } finally {
          setLoading(false);
        }
      })();
    }, [id, userId])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={BrutalColors.outline} style={{ flex: 1 }} />
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
          <IconSymbol name="chevron.right" size={24} color={BrutalColors.outline} style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pdf Viewer</Text>
      </View>

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
                  <ActivityIndicator size="large" color={BrutalColors.outline} style={{ flex: 1 }} />
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
    backgroundColor: BrutalColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BrutalColors.yellow,
    borderBottomWidth: 4,
    borderBottomColor: BrutalColors.outline,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.subtitle,
    color: BrutalColors.textPrimary,
    letterSpacing: 1,
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
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
  },
  errorText: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    textAlign: 'center',
    marginTop: 40,
  },
});
