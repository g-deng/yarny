import Constants from 'expo-constants';

const devHost = Constants.expoConfig?.hostUri?.split(':')[0];

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (devHost ? `http://${devHost}:3000` : 'http://localhost:3000');
