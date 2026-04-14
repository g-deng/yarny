import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { useUser } from '@/hooks/use-user';
import { BrutalColors, BrutalFonts, BrutalTokens, YarnySizes } from '@/constants/theme';
import { BrutalShadow } from '@/components/brutal/brutal-shadow';

type Mode = 'signup' | 'login';

export default function WelcomeScreen() {
  const [mode, setMode] = useState<Mode>('signup');
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { userId, signUp, logIn } = useUser();

  // Redirect once logged in
  if (userId) {
    return <Redirect href="/(tabs)" />;
  }

  const handleSubmit = async () => {
    setError(null);
    const trimmed = username.trim();

    if (!trimmed) {
      setError('Please enter a username.');
      return;
    }
    if (mode === 'signup' && trimmed.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'signup') {
        await signUp(trimmed);
      } else {
        await logIn(trimmed);
      }
      // Redirect happens automatically via _layout.tsx auth guard
    } catch (err: any) {
      if (mode === 'signup') {
        if (err.message?.includes('already taken') || err.message?.includes('23505')) {
          setError('That username is already taken. Try another one.');
        } else if (err.message?.includes('fetch') || err.message?.includes('Network')) {
          setError('Unable to connect to the server. Check your internet connection.');
        } else {
          setError(err.message || 'Something went wrong. Please try again.');
        }
      } else {
        if (err.message?.includes('not found') || err.message?.includes('404')) {
          setError('No account with that username. Try signing up instead.');
        } else if (err.message?.includes('fetch') || err.message?.includes('Network')) {
          setError('Unable to connect to the server. Check your internet connection.');
        } else {
          setError(err.message || 'Something went wrong. Please try again.');
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === 'signup' ? 'login' : 'signup'));
    setError(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Text style={styles.title}>Welcome to Yarny</Text>
        <Text style={styles.subtitle}>
          {mode === 'signup' ? "Let's make something amazing!" : 'Welcome back!'}
        </Text>

        <Text style={styles.label}>
          {mode === 'signup' ? 'Choose a username' : 'Enter your username'}
        </Text>
        <TextInput
          style={[styles.input, error ? styles.inputError : null]}
          value={username}
          onChangeText={(text) => {
            setUsername(text);
            if (error) setError(null);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <BrutalShadow style={styles.buttonShadow}>
          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={BrutalColors.outline} />
            ) : (
              <Text style={styles.buttonText}>
                {mode === 'signup' ? 'GET STARTED' : 'LOG IN'}
              </Text>
            )}
          </TouchableOpacity>
        </BrutalShadow>

        <TouchableOpacity onPress={toggleMode} style={styles.toggleLink}>
          <Text style={styles.toggleText}>
            {mode === 'signup'
              ? 'Already have an account? Log in'
              : "Don't have an account? Sign up"}
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BrutalColors.background,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.title,
    color: BrutalColors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    textAlign: 'center',
    marginBottom: 40,
  },
  label: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: BrutalColors.surface,
    borderRadius: BrutalTokens.radius,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    marginBottom: 8,
    borderWidth: BrutalTokens.borderWidth,
    borderColor: BrutalColors.outline,
  },
  inputError: {
    borderColor: BrutalColors.red,
  },
  errorText: {
    fontFamily: BrutalFonts.bold,
    fontSize: YarnySizes.caption,
    color: BrutalColors.red,
    marginBottom: 16,
  },
  buttonShadow: {
    marginTop: 12,
    marginRight: BrutalTokens.shadowOffset.x,
  },
  button: {
    backgroundColor: BrutalColors.yellow,
    borderRadius: BrutalTokens.radius,
    borderWidth: BrutalTokens.borderWidthThick,
    borderColor: BrutalColors.outline,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontFamily: BrutalFonts.black,
    fontSize: YarnySizes.body,
    color: BrutalColors.textPrimary,
    letterSpacing: 1.2,
  },
  toggleLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  toggleText: {
    fontFamily: BrutalFonts.semibold,
    fontSize: YarnySizes.caption,
    color: BrutalColors.outline,
    textDecorationLine: 'underline',
  },
});
