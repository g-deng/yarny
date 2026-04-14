import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { CircularProgress } from './circular-progress';
import {
  BrutalColors,
  BrutalFonts,
  BrutalTokens,
  YarnySizes,
} from '@/constants/theme';
import { IconSymbol } from './ui/icon-symbol';
import { BrutalShadow } from './brutal/brutal-shadow';
import { HatchPattern } from './brutal/hatch-pattern';

interface ProjectCardProps {
  title: string;
  imageUrl: string | null;
  percentComplete: number;
  lastWorkedAt: string | null;
  isPublic: boolean;
  authorUsername?: string | null;
  isOwn?: boolean;
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
  authorUsername,
  isOwn,
  onPress,
  onLongPress,
  selectionMode = false,
  selected = false,
}: ProjectCardProps) {
  return (
    <BrutalShadow style={styles.shadowWrap}>
      <TouchableOpacity
        style={[styles.card, selected && styles.cardSelected]}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        activeOpacity={0.85}
      >
        {selectionMode && (
          <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
            {selected && (
              <IconSymbol name="checkmark" size={16} color={BrutalColors.outline} />
            )}
          </View>
        )}
        <View style={styles.imageWrap}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} />
          ) : (
            <>
              <View style={[styles.image, styles.imagePlaceholder]} />
              <View style={StyleSheet.absoluteFill}>
                <HatchPattern width="100%" height="100%" spacing={7} strokeWidth={2} />
              </View>
            </>
          )}
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {authorUsername && (
            <Text style={styles.author}>
              {isOwn ? 'your project' : `by @${authorUsername}`}
            </Text>
          )}
          <View style={styles.row}>
            <CircularProgress
              percent={percentComplete}
              size={40}
              strokeWidth={3}
              trackColor={BrutalColors.outline}
              fillColor={BrutalColors.yellow}
              labelColor={BrutalColors.textPrimary}
            />
            <Text style={styles.detail}>complete</Text>
          </View>
          <View style={styles.row}>
            <IconSymbol name="house.fill" size={18} color={BrutalColors.outline} />
            <Text style={styles.detail}>
              {lastWorkedAt ? `last worked ${formatLastWorked(lastWorkedAt)}` : 'Not started yet'}
            </Text>
          </View>
          <View style={styles.row}>
            <IconSymbol name="person.fill" size={18} color={BrutalColors.outline} />
            <Text style={styles.detail}>{isPublic ? 'public project' : 'private project'}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </BrutalShadow>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    marginBottom: 16,
    marginRight: BrutalTokens.shadowOffset.x,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: BrutalColors.surface,
    borderRadius: BrutalTokens.radius,
    padding: 12,
    alignItems: 'center',
    borderWidth: BrutalTokens.borderWidth,
    borderColor: BrutalColors.outline,
  },
  cardSelected: {
    borderWidth: BrutalTokens.borderWidthThick,
    borderColor: BrutalColors.pink,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: BrutalTokens.borderWidth,
    borderColor: BrutalColors.outline,
    backgroundColor: BrutalColors.surface,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: BrutalColors.pink,
  },
  imageWrap: {
    width: 90,
    height: 90,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: BrutalTokens.borderWidth,
    borderColor: BrutalColors.outline,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    backgroundColor: BrutalColors.yellow,
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  author: {
    fontFamily: BrutalFonts.body,
    fontSize: 12,
    color: BrutalColors.textPrimary,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  detail: {
    fontFamily: BrutalFonts.semibold,
    fontSize: 14,
    color: BrutalColors.textPrimary,
  },
});
