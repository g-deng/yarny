import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useCallback } from 'react';
import { useUser } from '@/hooks/use-user';
import { createProject, uploadImage, parsePdf } from '@/services/api';
import { ImageUpload } from '@/components/image-upload';
import { ToggleSwitch } from '@/components/toggle-switch';
import { YarnyColors, YarnyFonts, YarnySizes } from '@/constants/theme';

export default function CreateScreen() {
  const { userId } = useUser();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Reset form whenever user returns to this tab
  useFocusEffect(
    useCallback(() => {
      setTitle('');
      setImageUri(null);
      setPdfUri(null);
      setPdfName(null);
      setIsPublic(false);
      setSaving(false);
      setStatus(null);
    }, [])
  );

  const pickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
    });
    if (!result.canceled && result.assets[0]) {
      setPdfUri(result.assets[0].uri);
      setPdfName(result.assets[0].name);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a project title');
      return;
    }
    if (!userId) return;

    setSaving(true);
    try {
      let imageUrl: string | null = null;
      if (imageUri) {
        setStatus('Uploading image...');
        const { url } = await uploadImage(imageUri);
        imageUrl = url;
      }

      setStatus('Creating project...');
      const project = await createProject({
        title: title.trim(),
        image_url: imageUrl,
        is_public: isPublic,
        user_id: userId,
      });

      if (pdfUri && pdfName) {
        setStatus('Uploading pattern PDF...');
        // parsePdf uploads to storage then calls the AI parse endpoint in one go;
        // flip the label right before awaiting since the AI step dominates runtime.
        const parsePromise = parsePdf(project.id, pdfUri, pdfName);
        // Best-effort UX: after a short delay, update label to reflect the long step.
        setTimeout(() => setStatus('Parsing pattern with AI (this can take a minute)...'), 1500);
        await parsePromise;
      }

      setStatus('Done!');
      router.replace(`/project/${project.id}/active`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create project');
    } finally {
      setSaving(false);
      setStatus(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>New Project</Text>
      </View>

      <ScrollView style={styles.form} contentContainerStyle={styles.formContent}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Project title"
          placeholderTextColor={YarnyColors.border}
        />

        <ImageUpload imageUri={imageUri} onImageSelected={setImageUri} />

        <Text style={[styles.label, { marginTop: 16 }]}>Upload pattern</Text>
        <TouchableOpacity style={styles.pdfArea} onPress={pickPdf} activeOpacity={0.7}>
          <Text style={styles.pdfText}>{pdfName || 'Tap to select a PDF'}</Text>
        </TouchableOpacity>

        <ToggleSwitch value={isPublic} onToggle={setIsPublic} />

        {saving && status && (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={YarnyColors.button} />
            <Text style={styles.statusText}>{status}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color={YarnyColors.textSecondary} />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
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
    backgroundColor: YarnyColors.button,
    paddingVertical: 12,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: YarnyFonts.header,
    fontSize: YarnySizes.subtitle,
    color: YarnyColors.textSecondary,
  },
  form: {
    flex: 1,
  },
  formContent: {
    padding: 16,
  },
  label: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.body,
    color: YarnyColors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: YarnyColors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.body,
    color: YarnyColors.textPrimary,
    marginBottom: 16,
  },
  pdfArea: {
    backgroundColor: YarnyColors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pdfText: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.body,
    color: YarnyColors.textPrimary,
  },
  saveButton: {
    backgroundColor: YarnyColors.button,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.body,
    color: YarnyColors.textSecondary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  statusText: {
    fontFamily: YarnyFonts.body,
    fontSize: 14,
    color: YarnyColors.textPrimary,
    textAlign: 'center',
  },
});
