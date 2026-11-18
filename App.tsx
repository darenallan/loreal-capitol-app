import React, { useEffect, useState, Component } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, Platform, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('AppErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    if (typeof window !== 'undefined') {
      try {
        if (window.localStorage) {
          Object.keys(window.localStorage)
            .filter(k => k.startsWith('loreal_cache_') || k.startsWith('loreal_cached_'))
            .forEach(k => window.localStorage.removeItem(k));
        }
      } catch (e) {}
      window.location.reload();
    } else {
      this.setState({ hasError: false });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.splashContainer}>
          <StatusBar style="light" />
          <View style={styles.splashLogoRing}>
            <Text style={styles.splashBrand}>C</Text>
          </View>
          <Text style={styles.splashTitle}>L'ORÉAL CAPITOL</Text>
          <Text style={[styles.splashSubtitle, { color: '#E5C158', marginTop: 10, marginBottom: 16 }]}>
            RÉINITIALISATION DE SESSION SÉCURISÉE
          </Text>
          <Text style={{ color: '#E2DCD0', fontSize: 13, textAlign: 'center', maxWidth: 360, marginBottom: 24, lineHeight: 18 }}>
            Une synchronisation a été sécurisée. Cliquez ci-dessous pour rouvrir l'application.
          </Text>
          <TouchableOpacity
            onPress={this.handleReset}
            style={{
              backgroundColor: '#E5C158',
              paddingVertical: 14,
              paddingHorizontal: 28,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: '#07070A', fontWeight: '700', fontSize: 14, letterSpacing: 0.5 }}>
              Actualiser l'application
            </Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}
import {
  PlayfairDisplay_700Bold,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
} from '@expo-google-fonts/playfair-display';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';

import { initDB } from './src/db/database';
import { initAudioUnlock } from './src/utils/ringtone';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeContext';

import LoginScreen from './src/screens/LoginScreen';
import LedgerScreen from './src/screens/LedgerScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import DailyReceiptScreen from './src/screens/DailyReceiptScreen';
import AdvancesScreen from './src/screens/AdvancesScreen';
import ArrivageHistoryScreen from './src/screens/ArrivageHistoryScreen';
import HelpScreen from './src/screens/HelpScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import TransfersScreen from './src/screens/TransfersScreen';
import PhysicalInventoryScreen from './src/screens/PhysicalInventoryScreen';
import UpdateNotificationModal from './src/components/UpdateNotificationModal';

const Stack = createNativeStackNavigator();

function RootNavigator() {
  const { isDark, colors } = useAppTheme();

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.body.style.backgroundColor = colors.bg;
      const root = document.getElementById('root');
      if (root) root.style.backgroundColor = colors.bg;
    }
  }, [colors.bg]);

  return (
    <SafeAreaProvider>
      <NavigationContainer
        theme={{
          ...DarkTheme,
          dark: true,
          colors: {
            ...DarkTheme.colors,
            primary: colors.gold,
            background: colors.bg,
            card: colors.bgElevated,
            text: colors.textPrimary,
            border: colors.border,
            notification: colors.gold,
          },
        }}
      >
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: Platform.OS === 'web' ? 'fade' : 'fade_from_bottom',
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Ledger" component={LedgerScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="Inventory" component={InventoryScreen} />
          <Stack.Screen name="DailyReceipt" component={DailyReceiptScreen} />
          <Stack.Screen name="Advances" component={AdvancesScreen} />
          <Stack.Screen name="ArrivageHistory" component={ArrivageHistoryScreen} />
          <Stack.Screen name="Help" component={HelpScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Transfers" component={TransfersScreen} />
          <Stack.Screen name="PhysicalInventory" component={PhysicalInventoryScreen} />
        </Stack.Navigator>
      </NavigationContainer>
      <UpdateNotificationModal />
      <StatusBar style={isDark ? "light" : "dark"} />
    </SafeAreaProvider>
  );
}

export default function App() {
  const [dbInitialized, setDbInitialized] = useState(false);
  const [fontTimeout, setFontTimeout] = useState(false);

  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Regular_Italic,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    // Démarrage instantané sur tous les appareils (iPhone, Android, Desktop)
    setDbInitialized(true);

    // Timeout de sécurité : ne jamais bloquer plus de 700ms pour les polices web
    const timer = setTimeout(() => {
      setFontTimeout(true);
    }, 700);

    try {
      initAudioUnlock();
    } catch (e) {
      console.warn('initAudioUnlock non bloquant:', e);
    }

    initDB().catch(e => console.log('Init background:', e?.message));

    // Injection des styles Web globaux (anti-zoom iOS/Android, scrollbar, sélection dorée, font par défaut)
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        // Enforce exact mobile viewport: disables unwanted browser auto-zoom
        let metaViewport = document.querySelector('meta[name="viewport"]');
        if (!metaViewport) {
          metaViewport = document.createElement('meta');
          metaViewport.setAttribute('name', 'viewport');
          document.head.appendChild(metaViewport);
        }
        metaViewport.setAttribute(
          'content',
          'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
        );

        // Bloquer le pinch-zoom et double-tap zoom intempestif sur Safari iOS
        document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
      } catch (err) {}

      const styleId = 'capitol-global-styles';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
          html, body, #root {
            margin: 0;
            padding: 0;
            height: 100%;
            overflow-x: hidden;
            font-family: 'Manrope_500Medium', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            transition: background-color 0.25s ease;
            touch-action: manipulation;
            -webkit-text-size-adjust: 100%;
            text-size-adjust: 100%;
            overscroll-behavior-y: none;
          }
          /* RÈGLE D'OR MOBILE : 16px minimum pour tous les champs de saisie pour empêcher Safari iOS & Android de zoomer seul */
          input, textarea, select {
            font-size: 16px !important;
            touch-action: manipulation !important;
            -webkit-text-size-adjust: 100% !important;
          }
          ::selection {
            background: #D4AF37 !important;
            color: #07070A !important;
          }
          ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          ::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.15);
          }
          ::-webkit-scrollbar-thumb {
            background: rgba(212, 175, 55, 0.4);
            border-radius: 999px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: #D4AF37;
          }
          input, textarea, select, button {
            font-family: inherit;
          }
          *:focus {
            outline: none !important;
          }
          * {
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
          }
        `;
        document.head.appendChild(style);
      }
    }

    return () => clearTimeout(timer);
  }, []);

  const isAppReady = dbInitialized && (fontsLoaded || fontTimeout);

  if (!isAppReady) {
    return (
      <View style={styles.splashContainer}>
        <StatusBar style="light" />
        <View style={styles.splashLogoRing}>
          <Text style={styles.splashBrand}>C</Text>
        </View>
        <Text style={styles.splashTitle}>CAPITOL</Text>
        <Text style={styles.splashSubtitle}>L'ORÉAL · LUXURY RETAIL</Text>
        <ActivityIndicator size="small" color="#D4AF37" style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#0A0A10',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  splashLogoRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  splashBrand: {
    color: '#D4AF37',
    fontSize: 28,
    fontWeight: '700',
  },
  splashTitle: {
    fontSize: 24,
    letterSpacing: 6,
    color: '#F4EFE3',
    fontWeight: '800',
  },
  splashSubtitle: {
    fontSize: 10,
    letterSpacing: 2.8,
    color: '#8F8878',
    marginTop: 6,
  },
});

