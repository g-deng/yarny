import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { BrutalColors, BrutalFonts, BrutalTokens, YarnySizes } from '@/constants/theme';
import { HatchPattern } from './brutal/hatch-pattern';

interface ImageUploadProps {
  imageUri: string | null;
  onImageSelected: (uri: string) => void;
}

export function ImageUpload({ imageUri, onImageSelected }: ImageUploadProps) {
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      onImageSelected(result.assets[0].uri);
    }
  };

  return (
    <View>
      <Text style={styles.label}>Upload image</Text>
      <TouchableOpacity style={styles.area} onPress={pickImage} activeOpacity={0.85}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.preview} />
        ) : (
          <View style={styles.placeholder}>
            <HatchPattern width="100%" height="100%" spacing={10} strokeWidth={2} />
            <Text style={styles.placeholderText}>Tap to add image</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  area: {
    borderRadius: BrutalTokens.radius,
    overflow: 'hidden',
    backgroundColor: BrutalColors.cyan,
    borderWidth: BrutalTokens.borderWidth,
    borderColor: BrutalColors.outline,
    height: 160,
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    position: 'absolute',
    fontFamily: BrutalFonts.black,
    fontSize: 16,
    color: BrutalColors.textPrimary,
    backgroundColor: BrutalColors.surface,
    borderWidth: 2,
    borderColor: BrutalColors.outline,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    letterSpacing: 0.5,
  },
});
