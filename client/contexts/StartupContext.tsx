import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import * as Font from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { Feather } from "@expo/vector-icons";
import {
  storage,
  UserSettings,
  UserProgress,
  defaultSettings,
} from "../lib/storage";

const defaultProgress: UserProgress = {
  completedDates: [],
  workoutDates: [],
  totalSessions: 0,
  totalMinutes: 0,
  currentStreak: 0,
  longestStreak: 0,
  lastCompletedDate: null,
};

interface StartupContextType {
  ready: boolean;
  initialSettings: UserSettings;
  initialProgress: UserProgress;
  programStartDate: string | null;
}

const StartupContext = createContext<StartupContextType>({
  ready: false,
  initialSettings: defaultSettings,
  initialProgress: defaultProgress,
  programStartDate: null,
});

export function StartupProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [initialSettings, setInitialSettings] =
    useState<UserSettings>(defaultSettings);
  const [initialProgress, setInitialProgress] =
    useState<UserProgress>(defaultProgress);
  const [programStartDate, setProgramStartDate] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [settings, progress, startDate] = await Promise.all([
          storage.getSettings(),
          storage.getProgress(),
          storage.getProgramStartDate(),
        ]);
        await Font.loadAsync(Feather.font);
        setInitialSettings(settings);
        setInitialProgress(progress);
        setProgramStartDate(startDate);
      } catch {
      } finally {
        setReady(true);
        SplashScreen.hideAsync().catch(() => {});
      }
    })();
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <StartupContext.Provider
      value={{ ready, initialSettings, initialProgress, programStartDate }}
    >
      {children}
    </StartupContext.Provider>
  );
}

export function useStartup() {
  return useContext(StartupContext);
}
