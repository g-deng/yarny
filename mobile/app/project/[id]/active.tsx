import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Pressable,
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

  // Pin / annotation state
  const [imageAspect, setImageAspect] = useState(1);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{ x: number; y: number } | null>(null);
  const [skipPin, setSkipPin] = useState(false);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id || !userId) return;
    try {
      const [detail, userProjects] = await Promise.all([
        getProjectDetail(id, userId),
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

  // Fetch comments whenever the current row changes. Also reset any in-flight
  // pin placement and selection, since pins are per-row.
  useEffect(() => {
    setAddMode(false);
    setPendingCoords(null);
    setSkipPin(false);
    setSelectedCommentId(null);
    setNewComment('');
    if (!currentRow) {
      setRowComments([]);
      return;
    }
    getRowComments(currentRow.id)
      .then(setRowComments)
      .catch((err) => console.error('Failed to load row comments:', err));
  }, [currentRow?.id]);

  const handleImageTap = (e: any) => {
    if (!addMode || !containerSize) return;
    const { locationX, locationY } = e.nativeEvent;
    const x = Math.min(1, Math.max(0, locationX / containerSize.w));
    const y = Math.min(1, Math.max(0, locationY / containerSize.h));
    setPendingCoords({ x, y });
    setSelectedCommentId(null);
  };

  const startAddComment = () => {
    setAddMode(true);
    setPendingCoords(null);
    setSkipPin(false);
    setSelectedCommentId(null);
    setNewComment('');
    // Projects without an image have no pinning stage — jump straight to composer.
    if (!project?.image_url) setSkipPin(true);
  };

  const cancelAddComment = () => {
    setAddMode(false);
    setPendingCoords(null);
    setSkipPin(false);
    setNewComment('');
  };

  const composerOpen = addMode && (pendingCoords !== null || skipPin);

  const handlePostComment = async () => {
    if (!userId || !id || !currentRow || !newComment.trim() || postingComment) return;
    setPostingComment(true);
    try {
      const comment = await createComment(id, {
        user_id: userId,
        body: newComment.trim(),
        row_id: currentRow.id,
        ...(pendingCoords
          ? { image_x: pendingCoords.x, image_y: pendingCoords.y }
          : {}),
      });
      // Optimistically add to list with a placeholder username
      const commentWithUser: Comment = { ...comment, username: 'You' };
      setRowComments((prev) => [commentWithUser, ...prev]);
      setNewComment('');
      setPendingCoords(null);
      setSkipPin(false);
      setAddMode(false);
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
        <View style={styles.imageWrap}>
          <Pressable
            onPress={handleImageTap}
            onLayout={(e) =>
              setContainerSize({
                w: e.nativeEvent.layout.width,
                h: e.nativeEvent.layout.height,
              })
            }
            style={[styles.imageContainer, { aspectRatio: imageAspect }]}
          >
            <Image
              source={{ uri: project.image_url }}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              onLoad={(ev: any) => {
                const w = ev?.source?.width;
                const h = ev?.source?.height;
                if (w && h) setImageAspect(w / h);
              }}
            />
            {rowComments
              .filter((c) => c.image_x !== null && c.image_y !== null)
              .map((c) => {
                const isActive = c.id === selectedCommentId;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => {
                      setSelectedCommentId(c.id);
                      setPendingCoords(null);
                    }}
                    style={[
                      styles.pin,
                      isActive && styles.pinActive,
                      {
                        left: `${(c.image_x ?? 0) * 100}%`,
                        top: `${(c.image_y ?? 0) * 100}%`,
                      },
                    ]}
                  />
                );
              })}
            {pendingCoords && (
              <View
                pointerEvents="none"
                style={[
                  styles.pin,
                  styles.pinPending,
                  {
                    left: `${pendingCoords.x * 100}%`,
                    top: `${pendingCoords.y * 100}%`,
                  },
                ]}
              />
            )}
          </Pressable>
          {addMode && !pendingCoords && !skipPin && (
            <View style={styles.addBanner}>
              <Text style={styles.addBannerText}>Tap the image to pin your comment</Text>
              <View style={styles.addBannerActions}>
                <TouchableOpacity onPress={() => setSkipPin(true)}>
                  <Text style={styles.addBannerAction}>No pin</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={cancelAddComment}>
                  <Text style={[styles.addBannerAction, styles.addBannerCancel]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
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
                  {rowComments.map((c) => {
                    const isSelected = c.id === selectedCommentId;
                    const hasPin = c.image_x !== null && c.image_y !== null;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.commentItem, isSelected && styles.commentItemSelected]}
                        onPress={() => setSelectedCommentId(c.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.commentHeaderRow}>
                          <Text style={styles.commentAuthor}>{c.username}</Text>
                          {hasPin && <Text style={styles.commentPinBadge}>📍</Text>}
                        </View>
                        <Text style={styles.commentBody}>{c.body}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

              {!addMode && (
                <TouchableOpacity
                  style={styles.addCommentButton}
                  onPress={startAddComment}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addCommentButtonText}>Add a comment</Text>
                </TouchableOpacity>
              )}

              {composerOpen && (
                <View style={styles.commentInputRow}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder={pendingCoords ? 'Write your pinned comment...' : 'Write your comment...'}
                    placeholderTextColor={YarnyColors.border}
                    value={newComment}
                    onChangeText={setNewComment}
                    multiline
                    autoFocus
                  />
                  <View style={styles.composerButtons}>
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
                    <TouchableOpacity onPress={cancelAddComment} disabled={postingComment}>
                      <Text style={styles.composerCancel}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
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
  imageWrap: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  imageContainer: {
    width: '100%',
    maxHeight: '100%',
    alignSelf: 'center',
    backgroundColor: YarnyColors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  pin: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: YarnyColors.button,
    borderWidth: 2,
    borderColor: YarnyColors.textSecondary,
    marginLeft: -9,
    marginTop: -9,
  },
  pinActive: {
    backgroundColor: YarnyColors.textSecondary,
    borderColor: YarnyColors.button,
    transform: [{ scale: 1.3 }],
  },
  pinPending: {
    backgroundColor: 'transparent',
    borderColor: YarnyColors.button,
    borderStyle: 'dashed',
  },
  addBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 12,
    backgroundColor: YarnyColors.button,
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  addBannerText: {
    flex: 1,
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: 13,
    color: YarnyColors.textSecondary,
  },
  addBannerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  addBannerAction: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: 13,
    color: YarnyColors.textSecondary,
    textDecorationLine: 'underline',
  },
  addBannerCancel: {
    opacity: 0.8,
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
    borderWidth: 2,
    borderColor: 'transparent',
  },
  commentItemSelected: {
    borderColor: YarnyColors.button,
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentAuthor: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.caption,
    color: YarnyColors.textPrimary,
  },
  commentPinBadge: {
    fontSize: 12,
  },
  addCommentButton: {
    backgroundColor: YarnyColors.button,
    borderRadius: 20,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  addCommentButtonText: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.caption,
    color: YarnyColors.textSecondary,
  },
  composerButtons: {
    alignItems: 'flex-end',
    gap: 6,
  },
  composerCancel: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: 12,
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
