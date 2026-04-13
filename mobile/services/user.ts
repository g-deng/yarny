import AsyncStorage from '@react-native-async-storage/async-storage';
import { createUser, getUserByUsername } from './api';

const USER_ID_KEY = '@yarny_user_id';

export async function getUserId(): Promise<string | null> {
  return AsyncStorage.getItem(USER_ID_KEY);
}

export async function signUp(username: string): Promise<string> {
  const user = await createUser(username);
  await AsyncStorage.setItem(USER_ID_KEY, user.id);
  return user.id;
}

export async function logIn(username: string): Promise<string> {
  const user = await getUserByUsername(username);
  await AsyncStorage.setItem(USER_ID_KEY, user.id);
  return user.id;
}

export async function logOut(): Promise<void> {
  await AsyncStorage.removeItem(USER_ID_KEY);
}
