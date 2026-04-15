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
import { BrutalColors, BrutalFonts, BrutalTokens, YarnySizes } from '@/constants/theme';
import { BrutalShadow } from '@/components/brutal/brutal-shadow';

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
      router.replace(`/project/${project.id}/details`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create project');
    } finally {
      setSaving(false);
      setStatus(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>NEW PROJECT</Text>
      </View>

      <ScrollView style={styles.form} contentContainerStyle={styles.formContent}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Project title"
          placeholderTextColor="#8A8A8A"
        />

        <ImageUpload imageUri={imageUri} onImageSelected={setImageUri} />

        <Text style={[styles.label, { marginTop: 16 }]}>Upload pattern</Text>
        <TouchableOpacity style={styles.pdfArea} onPress={pickPdf} activeOpacity={0.7}>
          <Text style={styles.pdfText}>{pdfName || 'Tap to select a PDF'}</Text>
        </TouchableOpacity>

        <ToggleSwitch value={isPublic} onToggle={setIsPublic} />

        {saving && status && (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={BrutalColors.outline} />
            <Text style={styles.statusText}>{status}</Text>
          </View>
        )}

        <BrutalShadow style={styles.saveButtonShadow}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={BrutalColors.outline} />
            ) : (
              <Text style={styles.saveButtonText}>SAVE</Text>
            )}
          </TouchableOpacity>
        </BrutalShadow>
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
    backgroundColor: BrutalColors.yellow,
    borderBottomWidth: BrutalTokens.borderWidthThick,
    borderBottomColor: BrutalColors.outline,
    paddingVertical: 14,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.subtitle,
    color: BrutalColors.textPrimary,
    letterSpacing: 1.5,
  },
  form: {
    flex: 1,
  },
  formContent: {
    padding: 16,
  },
  label: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: BrutalColors.surface,
    borderRadius: BrutalTokens.radius,
    borderWidth: BrutalTokens.borderWidth,
    borderColor: BrutalColors.outline,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    marginBottom: 16,
  },
  pdfArea: {
    backgroundColor: BrutalColors.surface,
    borderRadius: BrutalTokens.radius,
    borderWidth: BrutalTokens.borderWidth,
    borderColor: BrutalColors.outline,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pdfText: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
  },
  saveButtonShadow: {
    marginTop: 16,
    marginRight: BrutalTokens.shadowOffset.x,
  },
  saveButton: {
    backgroundColor: BrutalColors.yellow,
    borderRadius: BrutalTokens.radius,
    borderWidth: BrutalTokens.borderWidthThick,
    borderColor: BrutalColors.outline,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    letterSpacing: 1.2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  statusText: {
    fontFamily: BrutalFonts.semibold,
    fontSize: 14,
    color: BrutalColors.textPrimary,
    textAlign: 'center',
  },
});
