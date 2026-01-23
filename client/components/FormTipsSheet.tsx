import React from 'react';
import { StyleSheet, View, Modal, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius } from '@/constants/theme';

interface FormTipsSheetProps {
  visible: boolean;
  onClose: () => void;
}

const tips = [
  {
    icon: 'wind' as const,
    title: 'Breathe Normally',
    description: 'Don\'t hold your breath during exercises. Keep breathing steadily throughout.',
  },
  {
    icon: 'x-circle' as const,
    title: 'Isolate the Muscles',
    description: 'Avoid squeezing your glutes, thighs, or abdominal muscles. Focus only on the pelvic floor.',
  },
  {
    icon: 'refresh-cw' as const,
    title: 'Full Relaxation Matters',
    description: 'Complete relaxation between squeezes is just as important as the squeeze itself.',
  },
  {
    icon: 'alert-triangle' as const,
    title: 'Don\'t Practice While Urinating',
    description: 'Never practice these exercises by stopping urine midstream. This can lead to bladder issues.',
  },
  {
    icon: 'clock' as const,
    title: 'Be Patient',
    description: 'Results take time. Most people notice improvements after 4-6 weeks of consistent practice.',
  },
];

export function FormTipsSheet({ visible, onClose }: FormTipsSheetProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <ThemedView
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + Spacing.xl },
          ]}
        >
          <View style={styles.handle} />
          
          <View style={styles.header}>
            <ThemedText type="h3">Form Tips</ThemedText>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {tips.map((tip, index) => (
              <View
                key={index}
                style={[
                  styles.tipCard,
                  { backgroundColor: theme.backgroundDefault },
                ]}
              >
                <View
                  style={[
                    styles.tipIcon,
                    { backgroundColor: `${theme.primary}15` },
                  ]}
                >
                  <Feather name={tip.icon} size={20} color={theme.primary} />
                </View>
                <View style={styles.tipContent}>
                  <ThemedText type="body" style={styles.tipTitle}>
                    {tip.title}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={[styles.tipDescription, { color: theme.textSecondary }]}
                  >
                    {tip.description}
                  </ThemedText>
                </View>
              </View>
            ))}
          </ScrollView>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  content: {
    flex: 1,
  },
  tipCard: {
    flexDirection: 'row',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  tipIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  tipDescription: {
    lineHeight: 20,
  },
});
