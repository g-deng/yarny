import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BrutalColors, BrutalFonts, BrutalTokens, YarnySizes } from '@/constants/theme';

interface ToggleSwitchProps {
  value: boolean;
  onToggle: (value: boolean) => void;
  leftLabel?: string;
  rightLabel?: string;
}

export function ToggleSwitch({
  value,
  onToggle,
  leftLabel = 'Private',
  rightLabel = 'Public',
}: ToggleSwitchProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => onToggle(false)} activeOpacity={0.7}>
        <Text style={[styles.label, !value && styles.activeLabel]}>{leftLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.track}
        onPress={() => onToggle(!value)}
        activeOpacity={0.8}
      >
        <View style={[styles.thumb, value && styles.thumbRight]} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onToggle(true)} activeOpacity={0.7}>
        <Text style={[styles.label, value && styles.activeLabel]}>{rightLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginVertical: 16,
  },
  label: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: '#8A8A8A',
  },
  activeLabel: {
    color: BrutalColors.textPrimary,
    fontFamily: BrutalFonts.black,
  },
  track: {
    width: 54,
    height: 30,
    borderRadius: 15,
    backgroundColor: BrutalColors.surface,
    borderWidth: BrutalTokens.borderWidth,
    borderColor: BrutalColors.outline,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BrutalColors.pink,
    borderWidth: 2,
    borderColor: BrutalColors.outline,
  },
  thumbRight: {
    alignSelf: 'flex-end',
  },
});
