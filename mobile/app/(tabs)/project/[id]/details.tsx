import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useUser } from '@/hooks/use-user';
import {
  getProjectDetail,
  getUserProjects,
  addProjectToTrack,
  removeProjectTracking,
  deleteProject,
  publishProject,
  restartProject,
  deleteMyProjectComments,
  getProjectComments,
  getInlineComments,
  createComment,
  type ProjectDetail,
  type Comment,
  type InlineComment,
} from '@/services/api';
import { CircularProgress } from '@/components/circular-progress';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrutalColors, BrutalFonts, BrutalTokens, YarnySizes } from '@/constants/theme';
import { BrutalShadow } from '@/components/brutal/brutal-shadow';

function formatLastWorked(dateStr: string | null): string {
  if (!dateStr) return 'Not started';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

export default function ProjectDetailScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const { userId } = useUser();
  const router = useRouter();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [rowsCompleted, setRowsCompleted] = useState(0);
  const [inLibrary, setInLibrary] = useState(false);
  const [isOwnProject, setIsOwnProject] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [projectComments, setProjectComments] = useState<Comment[]>([]);
  const [inlineComments, setInlineComments] = useState<InlineComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
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

  useFocusEffect(
    useCallback(() => {
      if (!id || !userId) return;
      (async () => {
        try {
          const [detail, userProjects, projectCs, inlineCs] = await Promise.all([
            getProjectDetail(id, userId),
            getUserProjects(userId),
            getProjectComments(id),
            getInlineComments(id),
          ]);
          setProject(detail);
          setIsOwnProject(detail.user_id === userId);
          const myProject = userProjects.find((p) => p.id === id);
          setRowsCompleted(myProject?.rows_completed ?? 0);
          setInLibrary(!!myProject);
          setProjectComments(projectCs);
          setInlineComments(inlineCs);
        } catch (err) {
          console.error('Failed to fetch project detail:', err);
        } finally {
          setLoading(false);
        }
      })();
    }, [id, userId])
  );

  const handleAddToLibrary = async () => {
    if (!userId || !id) return;
    setBusy(true);
    try {
      await addProjectToTrack(userId, id);
      setInLibrary(true);
    } catch (err) {
      console.error('Failed to add project:', err);
      Alert.alert('Could not add to library', (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doDeleteLocalOnly = async () => {
    if (!userId || !id) return;
    setBusy(true);
    try {
      await removeProjectTracking(userId, id);
      setInLibrary(false);
      router.replace('/(tabs)');
    } catch (err) {
      console.error('Failed to remove from library:', err);
      Alert.alert('Could not delete', (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doDeleteOwned = async () => {
    if (!userId || !id) return;
    setBusy(true);
    try {
      const result = await deleteProject(id, userId);
      if (result.kept_global) {
        Alert.alert(
          'Removed from your library',
          'Your project is still public for the community.'
        );
      }
      router.replace('/(tabs)');
    } catch (err) {
      console.error('Failed to delete project:', err);
      Alert.alert('Could not delete', (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = () => {
    if (!project) return;
    if (isOwnProject && !project.is_public) {
      Alert.alert(
        'Delete project?',
        "This will permanently delete this project and your progress. This can't be undone.",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDeleteOwned },
        ]
      );
    } else if (isOwnProject && project.is_public) {
      Alert.alert(
        'Remove from your library?',
        "This project will stay public for the community. We'll remove it from your library and reset your progress.",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: doDeleteOwned },
        ]
      );
    } else {
      Alert.alert(
        'Remove from your library?',
        'Your progress on this project will be deleted.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: doDeleteLocalOnly },
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
            setBusy(true);
            try {
              await restartProject(userId, id);
              setRowsCompleted(0);
            } catch (err) {
              console.error('Failed to clear progress:', err);
              Alert.alert('Could not clear progress', (err as Error).message);
            } finally {
              setBusy(false);
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
            setBusy(true);
            try {
              await deleteMyProjectComments(id, userId);
              setProjectComments((prev) => prev.filter((c) => c.user_id !== userId));
              setInlineComments((prev) => prev.filter((c) => c.user_id !== userId));
            } catch (err) {
              console.error('Failed to delete comments:', err);
              Alert.alert('Could not delete comments', (err as Error).message);
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const handleMenuDelete = () => {
    setMenuOpen(false);
    handleDelete();
  };

  const handlePublish = () => {
    if (!userId || !id) return;
    Alert.alert(
      'Publish this project?',
      'Publishing is permanent. Other users will be able to add this project to their library.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish',
          onPress: async () => {
            setBusy(true);
            try {
              const updated = await publishProject(id, userId);
              setProject((prev) => (prev ? { ...prev, is_public: updated.is_public } : prev));
            } catch (err) {
              console.error('Failed to publish project:', err);
              Alert.alert('Could not publish', (err as Error).message);
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const handlePostComment = async () => {
    if (!userId || !id || !newComment.trim() || postingComment) return;
    setPostingComment(true);
    try {
      const comment = await createComment(id, {
        user_id: userId,
        body: newComment.trim(),
      });
      setProjectComments((prev) => [{ ...comment, username: 'You' }, ...prev]);
      setNewComment('');
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setPostingComment(false);
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

  const totalRows = project.total_rows ?? 0;
  const overallPercent = totalRows > 0 ? (rowsCompleted / totalRows) * 100 : 0;

  // Compute per-section progress
  const sectionProgress = project.sections.map((section) => {
    const sectionRowCount = section.rows.length;
    const completedInSection = section.rows.filter((r) => r.position <= rowsCompleted).length;
    const percent = sectionRowCount > 0 ? (completedInSection / sectionRowCount) * 100 : 0;
    return { ...section, percent };
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (from === 'search') {
              router.replace('/(tabs)/search');
            } else if (from === 'profile') {
              router.replace('/(tabs)/profile');
            } else if (isOwnProject || inLibrary) {
              router.replace('/(tabs)');
            } else {
              router.replace('/(tabs)/search');
            }
          }}
          style={styles.backButton}
        >
          <IconSymbol name="chevron.right" size={24} color={BrutalColors.outline} style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {project.title}
        </Text>
        {(inLibrary || isOwnProject) && (
          <TouchableOpacity
            onPress={() => setMenuOpen((v) => !v)}
            style={styles.menuButton}
            hitSlop={10}
          >
            <IconSymbol name="ellipsis" size={24} color={BrutalColors.outline} />
          </TouchableOpacity>
        )}
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
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleMenuDelete}
              disabled={busy}
            >
              <Text style={styles.menuItemText}>Delete from my library</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleClearProgress}
              disabled={busy}
            >
              <Text style={styles.menuItemText}>Clear my progress</Text>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handleDeleteMyComments}
              disabled={busy}
            >
              <Text style={styles.menuItemText}>Delete my comments</Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        {/* Hero image — entrance to the tracker */}
        {(inLibrary || isOwnProject) ? (
          <BrutalShadow style={styles.heroShadow}>
            <TouchableOpacity
              style={styles.heroImageWrap}
              onPress={() => router.push(`/project/${id}/active`)}
              activeOpacity={0.85}
            >
              {project.image_url ? (
                <Image source={{ uri: project.image_url }} style={styles.heroImage} />
              ) : (
                <View style={[styles.heroImage, { backgroundColor: BrutalColors.yellow }]} />
              )}
              <View style={styles.heroOverlay}>
                <Text style={styles.heroOverlayText}>OPEN TRACKER</Text>
                <IconSymbol name="chevron.right" size={20} color={BrutalColors.textPrimary} />
              </View>
            </TouchableOpacity>
          </BrutalShadow>
        ) : (
          <BrutalShadow style={styles.heroShadow}>
            <View style={styles.heroImageWrap}>
              {project.image_url ? (
                <Image source={{ uri: project.image_url }} style={styles.heroImage} />
              ) : (
                <View style={[styles.heroImage, { backgroundColor: BrutalColors.yellow }]} />
              )}
            </View>
          </BrutalShadow>
        )}

        {/* Overview */}
        <Text style={styles.sectionHeader}>Overview</Text>

        {/* Creator */}
        <TouchableOpacity
          style={styles.creatorRow}
          onPress={() => router.push(`/user/${project.user_id}`)}
          activeOpacity={0.7}
        >
          {project.profile_photo_url ? (
            <Image source={{ uri: project.profile_photo_url }} style={styles.creatorAvatar} />
          ) : (
            <View style={[styles.creatorAvatar, styles.creatorAvatarFallback]}>
              <Text style={styles.creatorAvatarText}>
                {project.username?.charAt(0).toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
          <Text style={styles.creatorLabel}>Created by </Text>
          <Text style={styles.creatorLink}>@{project.username}</Text>
        </TouchableOpacity>

        <View style={styles.overviewCard}>
          <View style={styles.overviewInfo}>
            <View style={styles.overviewRow}>
              <CircularProgress
                percent={overallPercent}
                size={44}
                trackColor={BrutalColors.outline}
                fillColor={BrutalColors.yellow}
                labelColor={BrutalColors.textPrimary}
              />
              <Text style={styles.overviewText}>complete</Text>
            </View>
            <View style={styles.overviewRow}>
              <IconSymbol name="house.fill" size={18} color={BrutalColors.outline} />
              <Text style={styles.overviewText}>
                last worked {formatLastWorked(project.last_worked_at)}
              </Text>
            </View>
            <View style={styles.overviewRow}>
              <IconSymbol name="person.fill" size={18} color={BrutalColors.outline} />
              <Text style={styles.overviewText}>
                {project.is_public ? 'public project' : 'private project'}
              </Text>
            </View>
          </View>
        </View>

        {/* Tags */}
        {(project.yarn_weight !== null || project.hook_size !== null || project.project_type) && (
          <View style={styles.tagRow}>
            {project.project_type && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{project.project_type}</Text>
              </View>
            )}
            {project.yarn_weight !== null && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>Yarn weight {project.yarn_weight}</Text>
              </View>
            )}
            {project.hook_size !== null && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{project.hook_size}mm hook</Text>
              </View>
            )}
          </View>
        )}

        {/* Library / delete / publish / PDF buttons */}
        {!isOwnProject && !inLibrary && (
          <BrutalShadow style={styles.addButtonShadow}>
            <TouchableOpacity
              style={[styles.addButton, busy && styles.addButtonDisabled]}
              onPress={handleAddToLibrary}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? (
                <ActivityIndicator color={BrutalColors.outline} />
              ) : (
                <View style={styles.addButtonContent}>
                  <IconSymbol name="plus" size={18} color={BrutalColors.textPrimary} />
                  <Text style={styles.addButtonText}>ADD TO LIBRARY</Text>
                </View>
              )}
            </TouchableOpacity>
          </BrutalShadow>
        )}

        {!isOwnProject && inLibrary && (
          <BrutalShadow style={styles.addButtonShadow}>
            <View style={[styles.addButton, styles.addedButton]}>
              <View style={styles.addButtonContent}>
                <IconSymbol name="checkmark" size={18} color={BrutalColors.textPrimary} />
                <Text style={styles.addButtonText}>ADDED TO YOUR LIBRARY</Text>
              </View>
            </View>
          </BrutalShadow>
        )}

        {isOwnProject && !project.is_public && (
          <BrutalShadow style={styles.addButtonShadow}>
            <TouchableOpacity
              style={[styles.addButton, busy && styles.addButtonDisabled]}
              onPress={handlePublish}
              disabled={busy}
              activeOpacity={0.85}
            >
              <Text style={styles.addButtonText}>MAKE PUBLIC</Text>
            </TouchableOpacity>
          </BrutalShadow>
        )}

        {project.pdf_url && (
          <BrutalShadow style={styles.viewPdfShadow}>
            <TouchableOpacity
              style={styles.viewPdfButton}
              onPress={() => router.push(`/project/${id}/pdf`)}
              activeOpacity={0.85}
            >
              <Text style={styles.viewPdfButtonText}>VIEW PATTERN PDF</Text>
            </TouchableOpacity>
          </BrutalShadow>
        )}

        {/* Sections */}
        <Text style={styles.sectionHeader}>Sections</Text>
        {sectionProgress.map((section) => (
          <View key={section.id} style={styles.sectionRow}>
            <CircularProgress
              percent={section.percent}
              size={40}
              strokeWidth={3}
              trackColor={BrutalColors.outline}
              fillColor={BrutalColors.yellow}
              labelColor={BrutalColors.textPrimary}
            />
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        ))}

        {/* Project-level comments */}
        <Text style={styles.sectionHeader}>Community</Text>
        <View style={styles.commentInputRow}>
          <TextInput
            style={styles.commentInput}
            placeholder="Share your wisdom..."
            placeholderTextColor="#8A8A8A"
            value={newComment}
            onChangeText={setNewComment}
            multiline
          />
          <TouchableOpacity
            style={[styles.commentPost, (!newComment.trim() || postingComment) && styles.addButtonDisabled]}
            onPress={handlePostComment}
            disabled={!newComment.trim() || postingComment}
          >
            {postingComment ? (
              <ActivityIndicator size="small" color={BrutalColors.outline} />
            ) : (
              <Text style={styles.commentPostText}>POST</Text>
            )}
          </TouchableOpacity>
        </View>
        {projectComments.length === 0 ? (
          <Text style={styles.emptyComments}>No comments yet. Be the first!</Text>
        ) : (
          projectComments.map((c) => (
            <View key={c.id} style={styles.commentCard}>
              <Text style={styles.commentAuthor}>{c.username}</Text>
              <Text style={styles.commentBody}>{c.body}</Text>
            </View>
          ))
        )}

        {/* Inline comments (grouped by row) */}
        {inlineComments.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Row Comments</Text>
            {inlineComments.map((c) => (
              <View key={c.id} style={styles.commentCard}>
                <Text style={styles.commentMeta}>
                  {c.section_title} · Row {c.row_number}
                </Text>
                <Text style={styles.commentAuthor}>{c.username}</Text>
                <Text style={styles.commentBody}>{c.body}</Text>
              </View>
            ))}
          </>
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
    marginHorizontal: 0,
  },
  content: {
    padding: 16,
  },
  addButtonShadow: {
    marginTop: 4,
    marginBottom: 16,
    marginRight: BrutalTokens.shadowOffset.x,
  },
  addButton: {
    backgroundColor: BrutalColors.yellow,
    borderRadius: BrutalTokens.radius,
    borderWidth: BrutalTokens.borderWidthThick,
    borderColor: BrutalColors.outline,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addedButton: {
    backgroundColor: BrutalColors.lime,
    opacity: 0.85,
  },
  addButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addButtonText: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    letterSpacing: 1,
  },
  removeButton: {
    borderWidth: BrutalTokens.borderWidthThick,
    borderColor: BrutalColors.outline,
    backgroundColor: BrutalColors.red,
    borderRadius: BrutalTokens.radius,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  viewPdfShadow: {
    marginBottom: 16,
    marginRight: BrutalTokens.shadowOffset.x,
  },
  viewPdfButton: {
    backgroundColor: BrutalColors.cyan,
    borderWidth: BrutalTokens.borderWidthThick,
    borderColor: BrutalColors.outline,
    borderRadius: BrutalTokens.radius,
    paddingVertical: 14,
    alignItems: 'center',
  },
  viewPdfButtonText: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    letterSpacing: 1,
  },
  removeButtonText: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
  },
  sectionHeader: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.subtitle,
    color: BrutalColors.textPrimary,
    marginBottom: 8,
    marginTop: 16,
    borderBottomWidth: BrutalTokens.borderWidthThick,
    borderBottomColor: BrutalColors.outline,
    paddingBottom: 4,
    letterSpacing: 0.5,
  },
  overviewCard: {
    marginBottom: 8,
  },
  heroShadow: {
    marginBottom: 20,
    marginRight: BrutalTokens.shadowOffset.x,
  },
  heroImageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: BrutalTokens.radius,
    overflow: 'hidden',
    backgroundColor: BrutalColors.yellow,
    borderWidth: BrutalTokens.borderWidthThick,
    borderColor: BrutalColors.outline,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: BrutalColors.yellow,
    borderRadius: BrutalTokens.radius,
    borderWidth: BrutalTokens.borderWidthThick,
    borderColor: BrutalColors.outline,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroOverlayText: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    letterSpacing: 1,
  },
  overviewInfo: {
    justifyContent: 'center',
    gap: 8,
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  overviewText: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 6,
  },
  creatorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    borderWidth: 2,
    borderColor: BrutalColors.outline,
  },
  creatorAvatarFallback: {
    backgroundColor: BrutalColors.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorAvatarText: {
    fontFamily: BrutalFonts.black,
    fontSize: 16,
    color: BrutalColors.textPrimary,
  },
  creatorLabel: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
  },
  creatorLink: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    textDecorationLine: 'underline',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 16,
  },
  tag: {
    backgroundColor: BrutalColors.lime,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: BrutalColors.outline,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  tagText: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.caption,
    color: BrutalColors.textPrimary,
    letterSpacing: 0.3,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: BrutalColors.outline,
  },
  sectionTitle: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 12,
    marginTop: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: BrutalColors.surface,
    borderRadius: BrutalTokens.radius,
    borderWidth: BrutalTokens.borderWidth,
    borderColor: BrutalColors.outline,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    maxHeight: 100,
  },
  commentPost: {
    backgroundColor: BrutalColors.yellow,
    borderRadius: BrutalTokens.radius,
    borderWidth: BrutalTokens.borderWidth,
    borderColor: BrutalColors.outline,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  commentPostText: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
  },
  commentCard: {
    backgroundColor: BrutalColors.surface,
    borderRadius: BrutalTokens.radius,
    borderWidth: BrutalTokens.borderWidth,
    borderColor: BrutalColors.outline,
    padding: 12,
    marginBottom: 10,
  },
  commentMeta: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.caption,
    color: '#8A8A8A',
    marginBottom: 2,
    fontStyle: 'italic',
  },
  commentAuthor: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
  },
  commentBody: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    marginTop: 2,
  },
  emptyComments: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    textAlign: 'center',
    marginVertical: 12,
    fontStyle: 'italic',
  },
  errorText: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    textAlign: 'center',
    marginTop: 40,
  },
});
