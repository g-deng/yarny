import { API_BASE_URL } from '@/constants/api';

// Types
export interface User {
  id: string;
  username: string;
  created_at: string;
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
  created_at: string;
  last_worked_at: string | null;
}

export interface ProjectWithUser extends Project {
  username: string;
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

export function getUser(userId: string) {
  return apiFetch<User>(`/api/users/${userId}`);
}

export function getUserByUsername(username: string) {
  return apiFetch<User>(`/api/users/by-username/${encodeURIComponent(username)}`);
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

export function getPublicProjects() {
  return apiFetch<ProjectWithUser[]>('/api/projects');
}

export function getProjectDetail(id: string) {
  return apiFetch<ProjectDetail>(`/api/projects/${id}`);
}

export function deleteProject(id: string) {
  return apiFetch<{ message: string }>(`/api/projects/${id}`, {
    method: 'DELETE',
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

// Stats
export function getUserStats(userId: string) {
  return apiFetch<UserStats>(`/api/users/${userId}/stats`);
}

// Uploads — image goes directly to Supabase Storage from the client
export async function uploadImage(imageUri: string): Promise<{ url: string }> {
  const { supabase } = await import('@/services/supabase');

  // Fetch the image file as a blob
  const response = await fetch(imageUri);
  const blob = await response.blob();

  // Derive extension from blob mime type (reliable) or fallback to jpg
  const mimeExt = blob.type?.split('/')[1]?.split(';')[0];
  const ext = mimeExt && /^[a-z0-9]+$/i.test(mimeExt) ? mimeExt : 'jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from('project-images')
    .upload(filename, blob, { contentType: blob.type || `image/${ext}` });

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

  // Upload PDF to Supabase Storage
  const response = await fetch(pdfUri);
  const blob = await response.blob();
  const storageName = `${Date.now()}-${fileName}`;

  const { error } = await supabase.storage
    .from('project-pdfs')
    .upload(storageName, blob, { contentType: 'application/pdf' });

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
