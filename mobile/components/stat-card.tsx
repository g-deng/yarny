import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  BrutalColors,
  BrutalFonts,
  BrutalTokens,
  YarnySizes,
} from '@/constants/theme';
import { BrutalShadow } from './brutal/brutal-shadow';

interface StatCardProps {
  title: string;
  stats: { label: string; value: string | number }[];
  color?: string;
}

export function StatCard({ title, stats, color = BrutalColors.yellow }: StatCardProps) {
  return (
    <BrutalShadow style={styles.shadow}>
      <View style={[styles.card, { backgroundColor: color }]}>
        <Text style={styles.title}>{title.toUpperCase()}</Text>
        {stats.map((stat, i) => (
          <Text key={i} style={styles.stat}>
            <Text style={styles.statValue}>{stat.value}</Text> {stat.label}
          </Text>
        ))}
      </View>
    </BrutalShadow>
  );
}

const styles = StyleSheet.create({
  shadow: {
    marginBottom: 16,
    marginRight: BrutalTokens.shadowOffset.x,
  },
  card: {
    borderRadius: BrutalTokens.radius,
    borderWidth: BrutalTokens.borderWidthThick,
    borderColor: BrutalColors.outline,
    padding: 16,
  },
  title: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    marginBottom: 8,
    letterSpacing: 1,
  },
  stat: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    lineHeight: 28,
  },
  statValue: {
    fontFamily: BrutalFonts.black,
  },
});
