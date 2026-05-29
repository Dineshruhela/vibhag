/**
 * Avatar Component
 * Displays user initials with colored background
 */
import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { getInitials } from '@/lib/format';
import { BorderRadius } from '@/constants/Spacing';

type Props = {
  name: string;
  color: string;
  size?: number;
  fontSize?: number;
  avatarUrl?: string | null;
};

export function Avatar({ name, color, size = 44, fontSize = 16, avatarUrl }: Props) {
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[styles.text, { fontSize }]}>{getInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
