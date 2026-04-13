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
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useUser } from '@/hooks/use-user';
import { createProject, uploadImage, parsePdf } from '@/services/api';
import { ImageUpload } from '@/components/image-upload';
import { ToggleSwitch } from '@/components/toggle-switch';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { YarnyColors, YarnyFonts, YarnySizes } from '@/constants/theme';

export default function NewProjectScreen() {
  const { userId } = useUser();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);

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
      // 1. Upload image if selected
      let imageUrl: string | null = null;
      if (imageUri) {
        const { url } = await uploadImage(imageUri);
        imageUrl = url;
      }

      // 2. Create project
      const project = await createProject({
        title: title.trim(),
        image_url: imageUrl,
        is_public: isPublic,
        user_id: userId,
      });

      // 3. Parse PDF if selected
      if (pdfUri && pdfName) {
        await parsePdf(project.id, pdfUri, pdfName);
      }

      // 4. Navigate to the new project
      router.replace(`/project/${project.id}/active`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create project');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.backButton}>
          <IconSymbol name="chevron.right" size={24} color={YarnyColors.textSecondary} style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>
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
});
