import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { useThemePreference } from '@/contexts/ThemePreferenceContext';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { Spacing, BorderRadius } from '@/constants/theme';

interface StatCardProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string | number;
  color?: string;
}

export function StatCard({ icon, label, value, color }: StatCardProps) {
  const { cp } = useThemePreference();
  const { fontScale } = useAccessibility();
  const iconColor = color || cp.neonGreen;

  return (
    <View style={[styles.card, { backgroundColor: cp.cardBg, borderColor: cp.cardBorder }]}>
      <View style={[styles.iconContainer, { backgroundColor: `${iconColor}20` }]}>
        <Feather name={icon} size={20 * fontScale} color={iconColor} />
      </View>
      <Text style={[styles.value, { fontSize: 24 * fontScale, color: cp.text }]}>
        {value}
      </Text>
      <Text style={[styles.label, { color: cp.textSecondary, fontSize: 11 * fontScale }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  value: {
    marginBottom: Spacing.xs,
    fontWeight: '600',
  },
  label: {
    textAlign: 'center',
  },
});
