import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Pressable, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BadgeDefinition, getBadgeById } from '@/data/badges';
import { Spacing, BorderRadius } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface BadgeToastProps {
  badgeIds: string[];
  onDismiss: () => void;
}

export function BadgeToast({ badgeIds, onDismiss }: BadgeToastProps) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const translateY = useSharedValue(-120);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);

  const currentBadge = badgeIds.length > 0 ? getBadgeById(badgeIds[currentIndex]) : undefined;

  useEffect(() => {
    if (badgeIds.length === 0) return;

    translateY.value = withTiming(0, { duration: 400 });
    opacity.value = withTiming(1, { duration: 300 });
    scale.value = withSequence(
      withTiming(1.05, { duration: 300 }),
      withTiming(1, { duration: 200 })
    );

    const timer = setTimeout(() => {
      if (currentIndex < badgeIds.length - 1) {
        translateY.value = withTiming(-120, { duration: 300 });
        opacity.value = withTiming(0, { duration: 300 });
        setTimeout(() => {
          setCurrentIndex(prev => prev + 1);
          translateY.value = withTiming(0, { duration: 400 });
          opacity.value = withTiming(1, { duration: 300 });
          scale.value = withSequence(
            withTiming(1.05, { duration: 300 }),
            withTiming(1, { duration: 200 })
          );
        }, 350);
      } else {
        translateY.value = withTiming(-120, { duration: 300 });
        opacity.value = withTiming(0, { duration: 300 });
        setTimeout(() => {
          runOnJS(onDismiss)();
        }, 350);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [currentIndex, badgeIds.length]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!currentBadge || badgeIds.length === 0) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + Spacing.md },
        animatedStyle,
      ]}
    >
      <Pressable onPress={onDismiss} style={styles.pressable}>
        <LinearGradient
          colors={['rgba(20, 10, 40, 0.95)', 'rgba(10, 20, 40, 0.95)']}
          style={styles.gradient}
        >
          <View style={styles.content}>
            <View style={[styles.iconContainer, { backgroundColor: `${currentBadge.color}20` }]}>
              <Feather
                name={currentBadge.icon as any}
                size={24}
                color={currentBadge.color}
              />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.label}>BADGE EARNED</Text>
              <Text style={[styles.title, { color: currentBadge.color }]}>
                {currentBadge.name}
              </Text>
              <Text style={styles.description} numberOfLines={1}>
                {currentBadge.description}
              </Text>
            </View>
          </View>
          {badgeIds.length > 1 ? (
            <View style={styles.counter}>
              <Text style={styles.counterText}>
                {currentIndex + 1}/{badgeIds.length}
              </Text>
            </View>
          ) : null}
          <View style={[styles.glowBar, { backgroundColor: currentBadge.color }]} />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 1000,
  },
  pressable: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  gradient: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  description: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 1,
  },
  counter: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  counterText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '600',
  },
  glowBar: {
    height: 2,
    opacity: 0.6,
  },
});
