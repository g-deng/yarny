import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, type ViewStyle, type StyleProp } from 'react-native';
import { BrutalColors, BrutalFonts, BrutalTokens, YarnySizes } from '@/constants/theme';

interface ToggleSwitchProps {
  value: boolean;
  onToggle: (value: boolean) => void;
  leftLabel?: string;
  rightLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const TRACK_WIDTH = 54;
const TRACK_BORDER = BrutalTokens.borderWidth;
const THUMB_SIZE = 20;
const TRACK_PADDING = 2;
const THUMB_TRAVEL = TRACK_WIDTH - TRACK_BORDER * 2 - TRACK_PADDING * 2 - THUMB_SIZE;

export function ToggleSwitch({
  value,
  onToggle,
  leftLabel = 'Private',
  rightLabel = 'Public',
  style,
}: ToggleSwitchProps) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [value, anim]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, THUMB_TRAVEL],
  });

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity onPress={() => onToggle(false)} activeOpacity={0.7}>
        <Text style={[styles.label, !value && styles.activeLabel]}>{leftLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.track}
        onPress={() => onToggle(!value)}
        activeOpacity={0.8}
      >
        <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
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
    width: TRACK_WIDTH,
    height: 30,
    borderRadius: 15,
    backgroundColor: BrutalColors.surface,
    borderWidth: BrutalTokens.borderWidth,
    borderColor: BrutalColors.outline,
    justifyContent: 'center',
    paddingHorizontal: TRACK_PADDING,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: BrutalColors.pink,
    borderWidth: 2,
    borderColor: BrutalColors.outline,
  },
});
