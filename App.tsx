import React, { useEffect } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.body.style.backgroundColor = '#000000';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.overflow = 'hidden';
      const root = document.getElementById('root');
      if (root) {
        root.style.backgroundColor = '#000000';
        root.style.height = '100vh';
        root.style.width = '100vw';
      }
    }
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    width: '100%',
    height: '100%',
  },
});
