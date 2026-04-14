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
import { YarnyColors, YarnyFonts, YarnySizes } from '@/constants/theme';

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
    <SafeAreaView style={styles.container}>
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
          <IconSymbol name="chevron.right" size={24} color={YarnyColors.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
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
            <IconSymbol name="ellipsis" size={24} color={YarnyColors.textSecondary} />
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

      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero image — entrance to the tracker */}
        {(inLibrary || isOwnProject) ? (
          <TouchableOpacity
            style={styles.heroImageWrap}
            onPress={() => router.push(`/project/${id}/active`)}
            activeOpacity={0.85}
          >
            {project.image_url ? (
              <Image source={{ uri: project.image_url }} style={styles.heroImage} />
            ) : (
              <View style={[styles.heroImage, { backgroundColor: YarnyColors.border }]} />
            )}
            <View style={styles.heroOverlay}>
              <Text style={styles.heroOverlayText}>Open tracker</Text>
              <IconSymbol name="chevron.right" size={20} color={YarnyColors.textSecondary} />
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.heroImageWrap}>
            {project.image_url ? (
              <Image source={{ uri: project.image_url }} style={styles.heroImage} />
            ) : (
              <View style={[styles.heroImage, { backgroundColor: YarnyColors.border }]} />
            )}
          </View>
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
              <CircularProgress percent={overallPercent} size={44} />
              <Text style={styles.overviewText}>complete</Text>
            </View>
            <View style={styles.overviewRow}>
              <IconSymbol name="house.fill" size={18} color={YarnyColors.textPrimary} />
              <Text style={styles.overviewText}>
                last worked {formatLastWorked(project.last_worked_at)}
              </Text>
            </View>
            <View style={styles.overviewRow}>
              <IconSymbol name="person.fill" size={18} color={YarnyColors.textPrimary} />
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
          <TouchableOpacity
            style={[styles.addButton, busy && styles.addButtonDisabled]}
            onPress={handleAddToLibrary}
            disabled={busy}
            activeOpacity={0.8}
          >
            {busy ? (
              <ActivityIndicator color={YarnyColors.textSecondary} />
            ) : (
              <View style={styles.addButtonContent}>
                <IconSymbol name="plus" size={18} color={YarnyColors.textSecondary} />
                <Text style={styles.addButtonText}>Add to library</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {!isOwnProject && inLibrary && (
          <View style={[styles.addButton, styles.addedButton]}>
            <View style={styles.addButtonContent}>
              <IconSymbol name="checkmark" size={18} color={YarnyColors.textSecondary} />
              <Text style={styles.addButtonText}>Added to your library</Text>
            </View>
          </View>
        )}

        {isOwnProject && !project.is_public && (
          <TouchableOpacity
            style={[styles.addButton, busy && styles.addButtonDisabled]}
            onPress={handlePublish}
            disabled={busy}
            activeOpacity={0.8}
          >
            <Text style={styles.addButtonText}>Make public</Text>
          </TouchableOpacity>
        )}

        {project.pdf_url && (
          <TouchableOpacity
            style={styles.viewPdfButton}
            onPress={() => router.push(`/project/${id}/pdf`)}
            activeOpacity={0.8}
          >
            <Text style={styles.viewPdfButtonText}>View pattern PDF</Text>
          </TouchableOpacity>
        )}

        {/* Sections */}
        <Text style={styles.sectionHeader}>Sections</Text>
        {sectionProgress.map((section) => (
          <View key={section.id} style={styles.sectionRow}>
            <CircularProgress percent={section.percent} size={40} strokeWidth={3} />
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        ))}

        {/* Project-level comments */}
        <Text style={styles.sectionHeader}>Community</Text>
        <View style={styles.commentInputRow}>
          <TextInput
            style={styles.commentInput}
            placeholder="Share your wisdom..."
            placeholderTextColor={YarnyColors.border}
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
              <ActivityIndicator size="small" color={YarnyColors.textSecondary} />
            ) : (
              <Text style={styles.commentPostText}>Post</Text>
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
    flex: 1,
    fontFamily: YarnyFonts.header,
    fontSize: YarnySizes.subtitle,
    color: YarnyColors.textSecondary,
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
    top: 72,
    right: 12,
    backgroundColor: YarnyColors.card,
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 220,
    zIndex: 11,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.body,
    color: YarnyColors.textSecondary,
  },
  menuDivider: {
    height: 1,
    backgroundColor: YarnyColors.border,
    marginHorizontal: 8,
  },
  content: {
    padding: 16,
  },
  addButton: {
    backgroundColor: YarnyColors.button,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addedButton: {
    opacity: 0.55,
  },
  addButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    marginTop: 20,
    marginBottom: 16,
  },
  viewPdfButton: {
    borderWidth: 2,
    borderColor: YarnyColors.button,
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  viewPdfButtonText: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.body,
    color: YarnyColors.button,
  },
  removeButtonText: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.body,
    color: YarnyColors.button,
  },
  sectionHeader: {
    fontFamily: YarnyFonts.header,
    fontSize: YarnySizes.subtitle,
    color: YarnyColors.textPrimary,
    marginBottom: 8,
    marginTop: 8,
    borderBottomWidth: 2,
    borderBottomColor: YarnyColors.button,
    paddingBottom: 4,
  },
  overviewCard: {
    marginBottom: 8,
  },
  heroImageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: YarnyColors.border,
    marginBottom: 16,
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  heroOverlayText: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.body,
    color: YarnyColors.textSecondary,
  },
  overviewInfo: {
    justifyContent: 'center',
    gap: 6,
  },
  overviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overviewText: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.body,
    color: YarnyColors.textPrimary,
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
  },
  creatorAvatarFallback: {
    backgroundColor: YarnyColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorAvatarText: {
    fontFamily: YarnyFonts.header,
    fontSize: 16,
    color: YarnyColors.textPrimary,
  },
  creatorLabel: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.body,
    color: YarnyColors.textPrimary,
  },
  creatorLink: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.body,
    color: YarnyColors.button,
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
    backgroundColor: YarnyColors.button,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  tagText: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.caption,
    color: YarnyColors.textSecondary,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: YarnyColors.border,
  },
  sectionTitle: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.body,
    color: YarnyColors.textPrimary,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 12,
  },
  commentInput: {
    flex: 1,
    backgroundColor: YarnyColors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.body,
    color: YarnyColors.textSecondary,
    maxHeight: 100,
  },
  commentPost: {
    backgroundColor: YarnyColors.button,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  commentPostText: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.body,
    color: YarnyColors.textSecondary,
  },
  commentCard: {
    backgroundColor: YarnyColors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  commentMeta: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.caption,
    color: YarnyColors.border,
    marginBottom: 2,
    fontStyle: 'italic',
  },
  commentAuthor: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.body,
    color: YarnyColors.textSecondary,
  },
  commentBody: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.body,
    color: YarnyColors.textSecondary,
    marginTop: 2,
  },
  emptyComments: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.body,
    color: YarnyColors.textPrimary,
    textAlign: 'center',
    marginVertical: 12,
    fontStyle: 'italic',
  },
  errorText: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.body,
    color: YarnyColors.textPrimary,
    textAlign: 'center',
    marginTop: 40,
  },
});
