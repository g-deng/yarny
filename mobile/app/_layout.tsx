import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import 'react-native-reanimated';

import { UserProvider, useUser } from '@/hooks/use-user';
import { YarnyColors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { loading } = useUser();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: YarnyColors.background }}>
        <ActivityIndicator size="large" color={YarnyColors.button} />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="new-project" />
        <Stack.Screen name="project/[id]/active" />
        <Stack.Screen name="project/[id]/details" />
        <Stack.Screen name="project/[id]/pdf" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'MarkoOne-Regular': require('../assets/fonts/MarkoOne-Regular.ttf'),
    'Montserrat-Regular': require('../assets/fonts/Montserrat-Regular.ttf'),
    'Montserrat-SemiBold': require('../assets/fonts/Montserrat-SemiBold.ttf'),
    'Montserrat-Bold': require('../assets/fonts/Montserrat-Bold.ttf'),
  });

  useEffect(() => {
    // Hide splash once fonts load OR fail — don't block the app
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Render app even if fonts fail to load — fall back to system fonts
  if (!fontsLoaded && !fontError) return null;

  return (
    <UserProvider>
      <RootNavigator />
    </UserProvider>
  );
}
