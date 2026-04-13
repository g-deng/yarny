import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
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
  restartProject,
  getRowComments,
  createComment,
  type ProjectDetail,
  type Row,
  type Comment,
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
  const [rowComments, setRowComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);

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

  // Fetch comments whenever the current row changes
  useEffect(() => {
    if (!currentRow) {
      setRowComments([]);
      return;
    }
    getRowComments(currentRow.id)
      .then(setRowComments)
      .catch((err) => console.error('Failed to load row comments:', err));
  }, [currentRow?.id]);

  const handlePostComment = async () => {
    if (!userId || !id || !currentRow || !newComment.trim() || postingComment) return;
    setPostingComment(true);
    try {
      const comment = await createComment(id, {
        user_id: userId,
        body: newComment.trim(),
        row_id: currentRow.id,
      });
      // Optimistically add to list with a placeholder username
      const commentWithUser: Comment = { ...comment, username: 'You' };
      setRowComments((prev) => [commentWithUser, ...prev]);
      setNewComment('');
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setPostingComment(false);
    }
  };

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

  const handlePreviousRow = async () => {
    if (!userId || !id || advancing || rowsCompleted === 0) return;
    setAdvancing(true);
    try {
      await advanceProgress(userId, id, -1);
      setRowsCompleted((prev) => Math.max(prev - 1, 0));
    } catch (err) {
      console.error('Failed to go back:', err);
    } finally {
      setAdvancing(false);
    }
  };

  const handleRestart = async () => {
    if (!userId || !id || advancing) return;
    setAdvancing(true);
    try {
      await restartProject(userId, id);
      setRowsCompleted(0);
    } catch (err) {
      console.error('Failed to restart:', err);
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
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 12 }}>
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

          {currentRow && (
            <View style={styles.commentsSection}>
              {rowComments.length > 0 && (
                <>
                  <Text style={styles.commentsHeader}>Comments on this row</Text>
                  {rowComments.map((c) => (
                    <View key={c.id} style={styles.commentItem}>
                      <Text style={styles.commentAuthor}>{c.username}</Text>
                      <Text style={styles.commentBody}>{c.body}</Text>
                    </View>
                  ))}
                </>
              )}
              <View style={styles.commentInputRow}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Add a comment..."
                  placeholderTextColor={YarnyColors.border}
                  value={newComment}
                  onChangeText={setNewComment}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.commentPost, (!newComment.trim() || postingComment) && styles.buttonDisabled]}
                  onPress={handlePostComment}
                  disabled={!newComment.trim() || postingComment}
                >
                  {postingComment ? (
                    <ActivityIndicator size="small" color={YarnyColors.textSecondary} />
                  ) : (
                    <Text style={styles.commentPostText}>Post</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Fixed bottom navigation */}
        <View style={styles.footerNav}>
          {isComplete ? (
            <TouchableOpacity
              style={[styles.nextButton, advancing && styles.buttonDisabled]}
              onPress={handleRestart}
              disabled={advancing}
              activeOpacity={0.8}
            >
              {advancing ? (
                <ActivityIndicator color={YarnyColors.textSecondary} />
              ) : (
                <Text style={styles.nextButtonText}>Restart project</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.rowButtons}>
              <TouchableOpacity
                style={[styles.prevButton, (rowsCompleted === 0 || advancing) && styles.buttonDisabled]}
                onPress={handlePreviousRow}
                disabled={rowsCompleted === 0 || advancing || !currentRow}
                activeOpacity={0.8}
              >
                <Text style={styles.prevButtonText}>Previous</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.nextButton, { flex: 1, marginBottom: 0 }, !currentRow && styles.buttonDisabled]}
                onPress={handleNextRow}
                disabled={!currentRow || advancing}
                activeOpacity={0.8}
              >
                {advancing ? (
                  <ActivityIndicator color={YarnyColors.textSecondary} />
                ) : (
                  <Text style={styles.nextButtonText}>Next row</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.detailsButton}
            onPress={() => router.push(`/project/${id}/details`)}
            activeOpacity={0.8}
          >
            <Text style={styles.detailsButtonText}>Pattern details</Text>
          </TouchableOpacity>
        </View>
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
    maxHeight: '60%',
  },
  footerNav: {
    padding: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: YarnyColors.border,
  },
  commentsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: YarnyColors.border,
  },
  commentsHeader: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.caption,
    color: YarnyColors.textSecondary,
    marginBottom: 8,
  },
  commentItem: {
    backgroundColor: YarnyColors.background,
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  commentAuthor: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.caption,
    color: YarnyColors.textPrimary,
  },
  commentBody: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.caption,
    color: YarnyColors.textPrimary,
    marginTop: 2,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: YarnyColors.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.caption,
    color: YarnyColors.textPrimary,
    maxHeight: 80,
  },
  commentPost: {
    backgroundColor: YarnyColors.button,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  commentPostText: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.caption,
    color: YarnyColors.textSecondary,
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
  rowButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
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
  prevButton: {
    borderWidth: 2,
    borderColor: YarnyColors.textSecondary,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevButtonText: {
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
