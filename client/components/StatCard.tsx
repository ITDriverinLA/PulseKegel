import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius } from '@/constants/theme';

interface StatCardProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string | number;
  color?: string;
  darkMode?: boolean;
}

export function StatCard({ icon, label, value, color, darkMode }: StatCardProps) {
  const { theme } = useTheme();
  const iconColor = color || theme.primary;

  if (darkMode) {
    return (
      <View style={styles.darkCard}>
        <View style={[styles.iconContainer, { backgroundColor: `${iconColor}20` }]}>
          <Feather name={icon} size={20} color={iconColor} />
        </View>
        <Text style={styles.darkValue}>
          {value}
        </Text>
        <Text style={styles.darkLabel}>
          {label}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.iconContainer, { backgroundColor: `${iconColor}15` }]}>
        <Feather name={icon} size={20} color={iconColor} />
      </View>
      <ThemedText type="h3" style={styles.value}>
        {value}
      </ThemedText>
      <ThemedText
        type="small"
        style={[styles.label, { color: theme.textSecondary }]}
      >
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  darkCard: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
  },
  darkValue: {
    marginBottom: Spacing.xs,
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  label: {
    textAlign: 'center',
  },
  darkLabel: {
    textAlign: 'center',
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
});
