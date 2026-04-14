import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useUser } from '@/hooks/use-user';
import { getUser, updateUser, uploadImage } from '@/services/api';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BrutalColors, BrutalFonts, BrutalTokens, YarnySizes } from '@/constants/theme';
import { BrutalShadow } from '@/components/brutal/brutal-shadow';

export default function EditProfileScreen() {
  const { userId } = useUser();
  const router = useRouter();

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const u = await getUser(userId);
        setPhotoUrl(u.profile_photo_url);
        setBio(u.bio ?? '');
      } catch (err) {
        console.error('Failed to load user:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPendingPhotoUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      let finalPhotoUrl = photoUrl;
      if (pendingPhotoUri) {
        const { url } = await uploadImage(pendingPhotoUri);
        finalPhotoUrl = url;
      }
      await updateUser(userId, {
        profile_photo_url: finalPhotoUrl,
        bio: bio.trim() || null,
      });
      router.replace('/(tabs)/profile');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={BrutalColors.outline} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  const displayPhoto = pendingPhotoUri || photoUrl;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/profile')} style={styles.backButton}>
          <IconSymbol name="chevron.right" size={24} color={BrutalColors.outline} style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>EDIT PROFILE</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.photoWrapper} onPress={pickPhoto} activeOpacity={0.85}>
          {displayPhoto ? (
            <Image source={{ uri: displayPhoto }} style={styles.photo} />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <IconSymbol name="person.fill" size={48} color={BrutalColors.outline} />
            </View>
          )}
          <Text style={styles.photoHint}>Tap to change photo</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={styles.bioInput}
          value={bio}
          onChangeText={setBio}
          placeholder="Tell others about yourself..."
          placeholderTextColor="#8A8A8A"
          multiline
          numberOfLines={4}
          maxLength={280}
        />
        <Text style={styles.charCount}>{bio.length}/280</Text>

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
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.subtitle,
    color: BrutalColors.textPrimary,
    letterSpacing: 1.5,
  },
  content: {
    padding: 16,
  },
  photoWrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: BrutalTokens.borderWidthThick,
    borderColor: BrutalColors.outline,
  },
  photoPlaceholder: {
    backgroundColor: BrutalColors.pink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoHint: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.caption,
    color: BrutalColors.outline,
    marginTop: 8,
    textDecorationLine: 'underline',
  },
  label: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  bioInput: {
    backgroundColor: BrutalColors.surface,
    borderRadius: BrutalTokens.radius,
    borderWidth: BrutalTokens.borderWidth,
    borderColor: BrutalColors.outline,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.caption,
    color: BrutalColors.textPrimary,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 24,
  },
  saveButtonShadow: {
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
});
