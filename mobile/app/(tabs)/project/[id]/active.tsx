import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
  Animated,
  Easing,
  PanResponder,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Reanimated, {
  LinearTransition,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
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
  deleteProject,
  removeProjectTracking,
  deleteMyProjectComments,
  getRowComments,
  createComment,
  type ProjectDetail,
  type Row,
  type Comment,
} from '@/services/api';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrutalColors, BrutalFonts, BrutalTokens, YarnySizes } from '@/constants/theme';

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
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  const pressCoordsRef = useRef<{ x: number; y: number } | null>(null);

  const expandComments = useCallback(() => {
    setCommentsExpanded(true);
  }, []);

  const collapseComments = useCallback(() => {
    setCommentsExpanded(false);
    setAddMode(false);
    setPendingCoords(null);
    setSkipPin(false);
    setNewComment('');
  }, []);

  const instructionPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 8,
      onPanResponderRelease: (_e, g) => {
        if (g.dy < -20) expandComments();
        else if (g.dy > 20) collapseComments();
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  const menuAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (menuOpen) {
      setMenuMounted(true);
      Animated.timing(menuAnim, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    } else if (menuMounted) {
      Animated.timing(menuAnim, {
        toValue: 0,
        duration: 120,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMenuMounted(false);
      });
    }
  }, [menuOpen, menuMounted, menuAnim]);

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
    setCommentsExpanded(false);
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

  const isOwnProject = !!project && project.user_id === userId;

  const handleDeleteFromLibrary = () => {
    if (!userId || !id || !project) return;
    setMenuOpen(false);
    const run = async (
      fn: () => Promise<any>,
      errorTitle = 'Could not delete'
    ) => {
      try {
        await fn();
        router.replace('/(tabs)');
      } catch (err) {
        console.error(err);
        Alert.alert(errorTitle, (err as Error).message);
      }
    };
    if (isOwnProject && !project.is_public) {
      Alert.alert(
        'Delete project?',
        "This will permanently delete this project and your progress. This can't be undone.",
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => run(() => deleteProject(id, userId)),
          },
        ]
      );
    } else if (isOwnProject && project.is_public) {
      const canHardDelete = (project.adds_count ?? 0) <= 1;
      const buttons: any[] = [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove from library',
          onPress: () => run(() => deleteProject(id, userId)),
        },
      ];
      if (canHardDelete) {
        buttons.push({
          text: 'Delete entirely',
          style: 'destructive',
          onPress: () => run(() => deleteProject(id, userId, true)),
        });
      }
      Alert.alert(
        'Remove from your library?',
        canHardDelete
          ? "No one else is tracking this project. You can keep it public and just remove it from your library, or delete it entirely for everyone."
          : "This project will stay public for the community. We'll remove it from your library and reset your progress.",
        buttons
      );
    } else {
      Alert.alert(
        'Remove from your library?',
        'Your progress on this project will be deleted.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => run(() => removeProjectTracking(userId, id)),
          },
        ]
      );
    }
  };

  const handleClearProgress = () => {
    if (!userId || !id) return;
    setMenuOpen(false);
    Alert.alert(
      'Clear progress?',
      'This will reset your progress on this project back to row 0.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await restartProject(userId, id);
              setRowsCompleted(0);
            } catch (err) {
              console.error('Failed to clear progress:', err);
              Alert.alert('Could not clear progress', (err as Error).message);
            }
          },
        },
      ]
    );
  };

  const handleDeleteMyComments = () => {
    if (!userId || !id) return;
    setMenuOpen(false);
    Alert.alert(
      'Delete your comments?',
      'This will remove every comment you posted on this project.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMyProjectComments(id, userId);
              setRowComments((prev) => prev.filter((c) => c.user_id !== userId));
            } catch (err) {
              console.error('Failed to delete comments:', err);
              Alert.alert('Could not delete comments', (err as Error).message);
            }
          },
        },
      ]
    );
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
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color={BrutalColors.outline} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!project) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <Text style={styles.errorText}>Project not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace(`/project/${id}/details`)} style={styles.backButton}>
          <IconSymbol name="chevron.right" size={24} color={BrutalColors.outline} style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {project.title}
        </Text>
        <TouchableOpacity
          onPress={() => setMenuOpen((v) => !v)}
          style={styles.menuButton}
          hitSlop={10}
        >
          <IconSymbol name="ellipsis" size={24} color={BrutalColors.outline} />
        </TouchableOpacity>
      </View>

      {menuMounted && (
        <>
          <TouchableOpacity
            style={styles.menuBackdrop}
            activeOpacity={1}
            onPress={() => setMenuOpen(false)}
          />
          <Animated.View
            style={[
              styles.menu,
              {
                opacity: menuAnim,
                transform: [
                  {
                    translateY: menuAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-8, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity style={styles.menuItem} onPress={handleDeleteFromLibrary}>
              <Text style={styles.menuItemText}>Delete from my library</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleClearProgress}>
              <Text style={styles.menuItemText}>Clear my progress</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleDeleteMyComments}>
              <Text style={styles.menuItemText}>Delete my comments</Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}

      {project.image_url ? (
        <View style={styles.imageWrap}>
          <Pressable
            onPressIn={(e: any) => {
              pressCoordsRef.current = {
                x: e.nativeEvent.locationX,
                y: e.nativeEvent.locationY,
              };
            }}
            onPress={handleImageTap}
            onLongPress={() => {
              if (!containerSize || !pressCoordsRef.current) return;
              const x = Math.min(1, Math.max(0, pressCoordsRef.current.x / containerSize.w));
              const y = Math.min(1, Math.max(0, pressCoordsRef.current.y / containerSize.h));
              setAddMode(true);
              setSkipPin(false);
              setSelectedCommentId(null);
              setNewComment('');
              setPendingCoords({ x, y });
              expandComments();
            }}
            delayLongPress={350}
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
        <View style={[styles.projectImage, { backgroundColor: BrutalColors.yellow }]} />
      )}

      <Reanimated.View
        style={styles.bottomCard}
        layout={LinearTransition.duration(220)}
      >
        <View style={styles.instructionDragArea} {...instructionPanResponder.panHandlers}>
          <View style={styles.dragHandleWrap}>
            <View style={styles.dragHandle} />
          </View>
          <View style={styles.instructionInner}>
            {isComplete ? (
              <Text style={styles.instruction}>Project complete!</Text>
            ) : currentRow ? (
              <>
                <Text style={styles.sectionName}>Section: {currentRow.sectionTitle}</Text>
                <Text style={styles.instruction}>
                  <Text style={styles.instructionLabel}>Row {currentRow.row_number}:</Text>{' '}
                  {currentRow.instruction}
                </Text>
                {!commentsExpanded && rowComments.length > 0 && (
                  <View style={styles.commentsHint}>
                    <IconSymbol
                      name="bubble.left"
                      size={14}
                      color={BrutalColors.outline}
                    />
                    <Text style={styles.commentsHintText}>swipe up to view comments</Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.instruction}>Upload a pattern to get started</Text>
            )}
          </View>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}>
          {currentRow && commentsExpanded && (
            <Reanimated.View
              style={styles.commentsSection}
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(140)}
            >
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
                    placeholderTextColor={BrutalColors.outline}
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
                        <ActivityIndicator size="small" color={BrutalColors.outline} />
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
            </Reanimated.View>
          )}

          <View style={styles.footerNav}>
            {isComplete ? (
              <TouchableOpacity
                style={[styles.nextButton, advancing && styles.buttonDisabled]}
                onPress={handleRestart}
                disabled={advancing}
                activeOpacity={0.8}
              >
                {advancing ? (
                  <ActivityIndicator color={BrutalColors.outline} />
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
                    <ActivityIndicator color={BrutalColors.outline} />
                  ) : (
                    <Text style={styles.nextButtonText}>Next row</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </Reanimated.View>
      </KeyboardAvoidingView>
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
    borderBottomWidth: BrutalTokens.borderWidthThick,
    borderBottomColor: BrutalColors.outline,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  backButton: {
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.subtitle,
    color: BrutalColors.textPrimary,
    letterSpacing: 0.5,
  },
  menuButton: {
    marginLeft: 12,
    padding: 4,
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  menu: {
    position: 'absolute',
    top: 78,
    right: 12,
    backgroundColor: BrutalColors.surface,
    borderRadius: BrutalTokens.radius,
    borderWidth: BrutalTokens.borderWidthThick,
    borderColor: BrutalColors.outline,
    paddingVertical: 4,
    minWidth: 240,
    zIndex: 11,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    letterSpacing: 0.3,
  },
  menuDivider: {
    height: 2,
    backgroundColor: BrutalColors.outline,
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
    backgroundColor: BrutalColors.yellow,
    borderRadius: BrutalTokens.radius,
    borderWidth: BrutalTokens.borderWidthThick,
    borderColor: BrutalColors.outline,
    overflow: 'hidden',
  },
  pin: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BrutalColors.pink,
    borderWidth: 3,
    borderColor: BrutalColors.outline,
    marginLeft: -10,
    marginTop: -10,
  },
  pinActive: {
    backgroundColor: BrutalColors.yellow,
    borderColor: BrutalColors.outline,
    transform: [{ scale: 1.3 }],
  },
  pinPending: {
    backgroundColor: 'transparent',
    borderColor: BrutalColors.outline,
    borderStyle: 'dashed',
  },
  addBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 12,
    backgroundColor: BrutalColors.yellow,
    borderRadius: BrutalTokens.radius,
    borderWidth: BrutalTokens.borderWidthThick,
    borderColor: BrutalColors.outline,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  addBannerText: {
    flex: 1,
    fontFamily: BrutalFonts.black,
    fontSize: 13,
    color: BrutalColors.textPrimary,
  },
  addBannerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  addBannerAction: {
    fontFamily: BrutalFonts.black,
    fontSize: 13,
    color: BrutalColors.textPrimary,
    textDecorationLine: 'underline',
  },
  addBannerCancel: {
    opacity: 0.8,
  },
  bottomCard: {
    backgroundColor: BrutalColors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: BrutalTokens.borderWidthThick,
    borderLeftWidth: BrutalTokens.borderWidthThick,
    borderRightWidth: BrutalTokens.borderWidthThick,
    borderColor: BrutalColors.outline,
    maxHeight: '60%',
  },
  instructionDragArea: {},
  instructionInner: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: BrutalColors.outline,
  },
  footerNav: {
    paddingTop: 12,
    paddingBottom: 8,
    marginTop: 12,
    borderTopWidth: 2,
    borderTopColor: BrutalColors.outline,
  },
  commentsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: BrutalColors.outline,
  },
  commentsHeader: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.caption,
    color: BrutalColors.textPrimary,
    marginTop: 12,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  commentItem: {
    backgroundColor: BrutalColors.background,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: BrutalColors.outline,
  },
  commentItemSelected: {
    borderWidth: BrutalTokens.borderWidthThick,
    borderColor: BrutalColors.pink,
  },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentAuthor: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.caption,
    color: BrutalColors.textPrimary,
  },
  commentPinBadge: {
    fontSize: 12,
  },
  addCommentButton: {
    backgroundColor: BrutalColors.yellow,
    borderRadius: 8,
    borderWidth: BrutalTokens.borderWidth,
    borderColor: BrutalColors.outline,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  addCommentButtonText: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.caption,
    color: BrutalColors.textPrimary,
    letterSpacing: 0.5,
  },
  composerButtons: {
    alignItems: 'flex-end',
    gap: 6,
  },
  composerCancel: {
    fontFamily: BrutalFonts.black,
    fontSize: 12,
    color: BrutalColors.textPrimary,
  },
  commentBody: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.caption,
    color: BrutalColors.textPrimary,
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
    backgroundColor: BrutalColors.background,
    borderRadius: 8,
    borderWidth: BrutalTokens.borderWidth,
    borderColor: BrutalColors.outline,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.caption,
    color: BrutalColors.textPrimary,
    maxHeight: 80,
  },
  commentPost: {
    backgroundColor: BrutalColors.yellow,
    borderRadius: 8,
    borderWidth: BrutalTokens.borderWidth,
    borderColor: BrutalColors.outline,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  commentPostText: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.caption,
    color: BrutalColors.textPrimary,
  },
  sectionName: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  instruction: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    marginBottom: 16,
  },
  commentsHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -8,
  },
  commentsHintText: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.caption,
    color: BrutalColors.outline,
    fontStyle: 'italic',
  },
  instructionLabel: {
    fontFamily: BrutalFonts.black,
  },
  rowButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  nextButton: {
    backgroundColor: BrutalColors.yellow,
    borderRadius: BrutalTokens.radius,
    borderWidth: BrutalTokens.borderWidthThick,
    borderColor: BrutalColors.outline,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  nextButtonText: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    letterSpacing: 1,
  },
  prevButton: {
    backgroundColor: BrutalColors.surface,
    borderWidth: BrutalTokens.borderWidthThick,
    borderColor: BrutalColors.outline,
    borderRadius: BrutalTokens.radius,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prevButtonText: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    letterSpacing: 1,
  },
  detailsButton: {
    borderWidth: BrutalTokens.borderWidthThick,
    borderColor: BrutalColors.outline,
    borderRadius: BrutalTokens.radius,
    paddingVertical: 12,
    alignItems: 'center',
  },
  detailsButtonText: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  errorText: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    textAlign: 'center',
    marginTop: 40,
  },
});
