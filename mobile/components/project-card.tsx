import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { CircularProgress } from './circular-progress';
import { YarnyColors, YarnyFonts, YarnySizes } from '@/constants/theme';
import { IconSymbol } from './ui/icon-symbol';

interface ProjectCardProps {
  title: string;
  imageUrl: string | null;
  percentComplete: number;
  lastWorkedAt: string | null;
  isPublic: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  selectionMode?: boolean;
  selected?: boolean;
}

function formatLastWorked(dateStr: string | null): string {
  if (!dateStr) return 'Not started';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

export function ProjectCard({
  title,
  imageUrl,
  percentComplete,
  lastWorkedAt,
  isPublic,
  onPress,
  onLongPress,
  selectionMode = false,
  selected = false,
}: ProjectCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      activeOpacity={0.8}
    >
      {selectionMode && (
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected && (
            <IconSymbol name="checkmark" size={16} color={YarnyColors.textSecondary} />
          )}
        </View>
      )}
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.image} />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]} />
      )}
      <View style={styles.info}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.row}>
          <CircularProgress percent={percentComplete} size={40} strokeWidth={3} />
          <Text style={styles.detail}>complete</Text>
        </View>
        <View style={styles.row}>
          <IconSymbol name="house.fill" size={18} color={YarnyColors.textPrimary} />
          <Text style={styles.detail}>last worked {formatLastWorked(lastWorkedAt)}</Text>
        </View>
        <View style={styles.row}>
          <IconSymbol name="person.fill" size={18} color={YarnyColors.textPrimary} />
          <Text style={styles.detail}>{isPublic ? 'public project' : 'private project'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: YarnyColors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: YarnyColors.button,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: YarnyColors.textSecondary,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: YarnyColors.button,
    borderColor: YarnyColors.button,
  },
  image: {
    width: 90,
    height: 90,
    borderRadius: 8,
  },
  imagePlaceholder: {
    backgroundColor: YarnyColors.border,
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontFamily: YarnyFonts.header,
    fontSize: YarnySizes.body,
    color: YarnyColors.textSecondary,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  detail: {
    fontFamily: YarnyFonts.body,
    fontSize: 14,
    color: YarnyColors.textSecondary,
  },
});
