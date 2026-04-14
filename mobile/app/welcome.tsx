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
import { YarnyColors, YarnyFonts, YarnySizes } from '@/constants/theme';

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

        <TouchableOpacity
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color={YarnyColors.textSecondary} />
          ) : (
            <Text style={styles.buttonText}>
              {mode === 'signup' ? 'Get Started' : 'Log In'}
            </Text>
          )}
        </TouchableOpacity>

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
    backgroundColor: YarnyColors.background,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontFamily: YarnyFonts.header,
    fontSize: YarnySizes.title,
    color: YarnyColors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.body,
    color: YarnyColors.textPrimary,
    textAlign: 'center',
    marginBottom: 40,
  },
  label: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.body,
    color: YarnyColors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: YarnyColors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.body,
    color: YarnyColors.textPrimary,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: '#D32F2F',
  },
  errorText: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.caption,
    color: '#D32F2F',
    marginBottom: 16,
  },
  button: {
    backgroundColor: YarnyColors.button,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontFamily: YarnyFonts.bodySemiBold,
    fontSize: YarnySizes.body,
    color: YarnyColors.textSecondary,
  },
  toggleLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  toggleText: {
    fontFamily: YarnyFonts.body,
    fontSize: YarnySizes.caption,
    color: YarnyColors.button,
    textDecorationLine: 'underline',
  },
});
