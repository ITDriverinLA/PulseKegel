import React from 'react';
import {
  StyleSheet,
  View,
  Image,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useThemePreference } from '@/contexts/ThemePreferenceContext';
import { Spacing } from '@/constants/theme';

const { width } = Dimensions.get('window');
const IMAGE_ASPECT = 576 / 1024;

export default function TechniqueGuideScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { cp } = useThemePreference();

  return (
    <LinearGradient
      colors={cp.gradient as unknown as [string, string, ...string[]]}
      style={styles.container}
    >
      <Pressable
        style={[styles.closeButton, { top: insets.top + Spacing.sm, backgroundColor: `${cp.cardBorder}CC` }]}
        onPress={() => navigation.goBack()}
        testID="button-close-technique-guide"
      >
        <Feather name="x" size={24} color={cp.textSecondary} />
      </Pressable>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 56, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        maximumZoomScale={3}
        minimumZoomScale={1}
      >
        <Image
          source={require('../../assets/images/find-the-target.png')}
          style={[styles.image, { width, height: width / IMAGE_ASPECT }]}
          resizeMode="contain"
        />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    right: Spacing.lg,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    alignItems: 'center',
  },
  image: {
    alignSelf: 'center',
  },
});
