import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { BrutalColors, BrutalTokens } from '@/constants/theme';

interface BrutalShadowProps {
  children: React.ReactNode;
  offset?: number;
  radius?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function BrutalShadow({
  children,
  offset = BrutalTokens.shadowOffset.x,
  radius = BrutalTokens.radius,
  color = BrutalColors.shadow,
  style,
}: BrutalShadowProps) {
  return (
    <View style={[styles.wrap, style]}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: offset,
          left: offset,
          right: -offset,
          bottom: -offset,
          backgroundColor: color,
          borderRadius: radius,
        }}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
});
