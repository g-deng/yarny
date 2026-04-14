import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { API_BASE_URL } from '@/constants/api';

// Reads a local URI into an ArrayBuffer. On web we use fetch() since URIs
// there are blob: / object URLs that expo-file-system can't handle; on native
// we use expo-file-system + base64-arraybuffer because RN's fetch(fileUri).blob()
// produces a 0-byte blob that silently hangs Supabase uploads.
async function readUriAsBody(uri: string): Promise<ArrayBuffer> {
  if (Platform.OS === 'web') {
    const res = await fetch(uri);
    return res.arrayBuffer();
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return decodeBase64(base64);
}

// Types
export interface User {
  id: string;
  username: string;
  profile_photo_url: string | null;
  bio: string | null;
  created_at: string;
  follower_count?: number;
  following_count?: number;
  is_following?: boolean;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  image_url: string | null;
  pdf_url: string | null;
  is_public: boolean;
  total_yards: number | null;
  total_rows: number | null;
  yarn_weight: number | null;
  hook_size: number | null;
  project_type: string | null;
  created_at: string;
  last_worked_at: string | null;
}

export interface ProjectWithUser extends Project {
  username: string;
  profile_photo_url: string | null;
  adds_count: number;
}

export interface ProjectWithProgress extends Project {
  rows_completed: number;
  current_row_id: string | null;
  progress_updated_at: string | null;
  yards_used: number;
}

export interface Row {
  id: string;
  row_number: number;
  instruction: string;
  position: number;
}

export interface Section {
  id: string;
  title: string;
  position: number;
  rows: Row[];
}

export interface ProjectDetail extends Project {
  sections: Section[];
  username: string;
  profile_photo_url: string | null;
  adds_count: number;
}

export interface Progress {
  id: string;
  user_id: string;
  project_id: string;
  current_row_id: string | null;
  rows_completed: number;
  updated_at: string;
}

export interface UserStats {
  rows: { today: number; week: number; all_time: number };
  yards: { used: number };
}

// Fetch wrapper
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Users
export function createUser(username: string) {
  return apiFetch<User>('/api/users', {
    method: 'POST',
    body: JSON.stringify({ username }),
  });
}

export function getUser(userId: string, viewerId?: string) {
  const qs = viewerId ? `?viewer_id=${encodeURIComponent(viewerId)}` : '';
  return apiFetch<User>(`/api/users/${userId}${qs}`);
}

export function searchUsers(query: string, viewerId?: string) {
  const params = new URLSearchParams({ q: query });
  if (viewerId) params.set('viewer_id', viewerId);
  return apiFetch<User[]>(`/api/users/search?${params.toString()}`);
}

export function followUser(userId: string, targetId: string) {
  return apiFetch<{ ok: boolean }>(`/api/users/${userId}/follow`, {
    method: 'POST',
    body: JSON.stringify({ target_id: targetId }),
  });
}

export function unfollowUser(userId: string, targetId: string) {
  return apiFetch<{ ok: boolean }>(`/api/users/${userId}/follow/${targetId}`, {
    method: 'DELETE',
  });
}

export function getFollowers(userId: string) {
  return apiFetch<User[]>(`/api/users/${userId}/followers`);
}

export function getFollowing(userId: string) {
  return apiFetch<User[]>(`/api/users/${userId}/following`);
}

export function getUserByUsername(username: string) {
  return apiFetch<User>(`/api/users/by-username/${encodeURIComponent(username)}`);
}

export function updateUser(userId: string, data: { profile_photo_url?: string | null; bio?: string | null }) {
  return apiFetch<User>(`/api/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function getUserPublicProjects(userId: string) {
  return apiFetch<Project[]>(`/api/users/${userId}/public-projects`);
}

// Projects
export function createProject(data: {
  title: string;
  image_url?: string | null;
  is_public: boolean;
  user_id: string;
}) {
  return apiFetch<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getPublicProjects(opts?: {
  filter?: 'all' | 'following';
  viewerId?: string;
  sort?: 'adds' | 'created';
}) {
  const params = new URLSearchParams();
  if (opts?.filter) params.set('filter', opts.filter);
  if (opts?.viewerId) params.set('viewer_id', opts.viewerId);
  if (opts?.sort) params.set('sort', opts.sort);
  const qs = params.toString();
  return apiFetch<ProjectWithUser[]>(`/api/projects${qs ? `?${qs}` : ''}`);
}

export function getProjectDetail(id: string, userId: string) {
  return apiFetch<ProjectDetail>(`/api/projects/${id}?user_id=${encodeURIComponent(userId)}`);
}

export function deleteProject(id: string, userId: string) {
  return apiFetch<{ kept_global: boolean; message: string }>(
    `/api/projects/${id}?user_id=${encodeURIComponent(userId)}`,
    { method: 'DELETE' }
  );
}

export function publishProject(id: string, userId: string) {
  return apiFetch<Project>(`/api/projects/${id}/publish`, {
    method: 'PATCH',
    body: JSON.stringify({ user_id: userId }),
  });
}

// User projects + progress
export function getUserProjects(userId: string) {
  return apiFetch<ProjectWithProgress[]>(`/api/users/${userId}/projects`);
}

export function advanceProgress(userId: string, projectId: string, rowsToAdd: number) {
  return apiFetch<Progress>(`/api/users/${userId}/projects/${projectId}/progress`, {
    method: 'PATCH',
    body: JSON.stringify({ rows_to_add: rowsToAdd }),
  });
}

export function restartProject(userId: string, projectId: string) {
  return apiFetch<Progress>(`/api/users/${userId}/projects/${projectId}/restart`, {
    method: 'POST',
  });
}

// Add project to track
export function addProjectToTrack(userId: string, projectId: string) {
  return apiFetch<any>(`/api/users/${userId}/projects/${projectId}/add`, {
    method: 'POST',
  });
}

// Stop tracking a project
export function removeProjectTracking(userId: string, projectId: string) {
  return apiFetch<any>(`/api/users/${userId}/projects/${projectId}/track`, {
    method: 'DELETE',
  });
}

// Comments
export interface Comment {
  id: string;
  user_id: string;
  project_id: string;
  row_id: string | null;
  body: string;
  created_at: string;
  username: string;
  image_x: number | null;
  image_y: number | null;
}

export interface InlineComment extends Comment {
  row_number: number;
  section_title: string;
}

export function createComment(
  projectId: string,
  data: {
    user_id: string;
    body: string;
    row_id?: string | null;
    image_x?: number | null;
    image_y?: number | null;
  }
) {
  return apiFetch<Comment>(`/api/projects/${projectId}/comments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getProjectComments(projectId: string) {
  return apiFetch<Comment[]>(`/api/projects/${projectId}/comments`);
}

export function getInlineComments(projectId: string) {
  return apiFetch<InlineComment[]>(`/api/projects/${projectId}/comments/inline`);
}

export function getRowComments(rowId: string) {
  return apiFetch<Comment[]>(`/api/rows/${rowId}/comments`);
}

export function deleteComment(commentId: string) {
  return apiFetch<{ message: string }>(`/api/comments/${commentId}`, {
    method: 'DELETE',
  });
}

// Stats
export function getUserStats(userId: string) {
  return apiFetch<UserStats>(`/api/users/${userId}/stats`);
}

export interface ActivityLogEntry {
  project_id: string;
  project_title: string;
  rows_added: number;
  logged_at: string;
}

export function getActivityLog(userId: string) {
  return apiFetch<ActivityLogEntry[]>(`/api/users/${userId}/activity-log`);
}

// Uploads — image goes directly to Supabase Storage from the client.
export async function uploadImage(imageUri: string): Promise<{ url: string }> {
  const { supabase } = await import('@/services/supabase');

  const uriExt = imageUri.split('.').pop()?.split('?')[0]?.toLowerCase();
  const ext = uriExt && /^[a-z0-9]+$/.test(uriExt) ? uriExt : 'jpg';
  const contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const body = await readUriAsBody(imageUri);

  const { error } = await supabase.storage
    .from('project-images')
    .upload(filename, body, { contentType });

  if (error) throw new Error(error.message);

  const { data: urlData } = supabase.storage
    .from('project-images')
    .getPublicUrl(filename);

  return { url: urlData.publicUrl };
}

export async function parsePdf(
  projectId: string,
  pdfUri: string,
  fileName: string
): Promise<any> {
  const { supabase } = await import('@/services/supabase');

  const storageName = `${Date.now()}-${fileName}`;
  const body = await readUriAsBody(pdfUri);

  const { error } = await supabase.storage
    .from('project-pdfs')
    .upload(storageName, body, { contentType: 'application/pdf' });

  if (error) throw new Error(error.message);

  const { data: urlData } = supabase.storage
    .from('project-pdfs')
    .getPublicUrl(storageName);

  // Send the URL to backend for parsing
  return apiFetch(`/api/projects/${projectId}/parse-pdf`, {
    method: 'POST',
    body: JSON.stringify({ pdf_url: urlData.publicUrl }),
  });
}
