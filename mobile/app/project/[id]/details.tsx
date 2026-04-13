import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useUser();
  const router = useRouter();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [rowsCompleted, setRowsCompleted] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [isOwnProject, setIsOwnProject] = useState(false);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [projectComments, setProjectComments] = useState<Comment[]>([]);
  const [inlineComments, setInlineComments] = useState<InlineComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id || !userId) return;
      (async () => {
        try {
          const [detail, userProjects, projectCs, inlineCs] = await Promise.all([
            getProjectDetail(id),
            getUserProjects(userId),
            getProjectComments(id),
            getInlineComments(id),
          ]);
          setProject(detail);
          setIsOwnProject(detail.user_id === userId);
          const myProject = userProjects.find((p) => p.id === id);
          setRowsCompleted(myProject?.rows_completed ?? 0);
          setIsTracking(!!myProject);
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

  const handleAddProject = async () => {
    if (!userId || !id) return;
    setAdding(true);
    try {
      await addProjectToTrack(userId, id);
      setIsTracking(true);
    } catch (err) {
      console.error('Failed to add project:', err);
    } finally {
      setAdding(false);
    }
  };

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
        <TouchableOpacity onPress={() => router.replace(`/project/${id}/active`)} style={styles.backButton}>
          <IconSymbol name="chevron.right" size={24} color={YarnyColors.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{project.title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Add to my projects button */}
        {!isOwnProject && !isTracking && (
          <TouchableOpacity
            style={[styles.addButton, adding && styles.addButtonDisabled]}
            onPress={handleAddProject}
            disabled={adding}
            activeOpacity={0.8}
          >
            {adding ? (
              <ActivityIndicator color={YarnyColors.textSecondary} />
            ) : (
              <Text style={styles.addButtonText}>Add to my projects</Text>
            )}
          </TouchableOpacity>
        )}

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
              <Text style={styles.removeButtonText}>Stop tracking</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Overview */}
        <Text style={styles.sectionHeader}>Overview</Text>
        <View style={styles.overviewCard}>
          {project.image_url ? (
            <Image source={{ uri: project.image_url }} style={styles.overviewImage} />
          ) : (
            <View style={[styles.overviewImage, { backgroundColor: YarnyColors.border }]} />
          )}
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
    fontFamily: YarnyFonts.header,
    fontSize: YarnySizes.subtitle,
    color: YarnyColors.textSecondary,
  },
  content: {
    padding: 16,
  },
  addButton: {
    backgroundColor: YarnyColors.button,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
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
    marginBottom: 16,
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
    flexDirection: 'row',
    marginBottom: 8,
  },
  overviewImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  overviewInfo: {
    flex: 1,
    marginLeft: 12,
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
