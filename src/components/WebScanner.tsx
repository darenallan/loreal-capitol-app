import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';

export default function WebScanner({ onScan, onClose }: { onScan: (data: string) => void, onClose: () => void }) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Only run on web
    if (typeof window !== 'undefined') {
      scannerRef.current = new Html5QrcodeScanner(
        "reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
        },
        /* verbose= */ false
      );
      
      scannerRef.current.render(
        (decodedText) => {
          if (scannerRef.current) {
            scannerRef.current.clear();
          }
          onScan(decodedText);
        },
        (error) => {
          // ignore background errors
        }
      );
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => console.error("Failed to clear scanner", e));
      }
    };
  }, []);

  if (typeof window === 'undefined') {
    return (
      <View style={styles.container}>
        <Text style={{ color: 'white' }}>Le scanner n'est disponible que sur la version Web.</Text>
        <TouchableOpacity onPress={onClose} style={styles.btn}><Text style={{color: 'black'}}>Fermer</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* @ts-ignore */}
      <div id="reader" style={{ width: '100%', maxWidth: 400, backgroundColor: 'white', borderRadius: 10, overflow: 'hidden' }}></div>
      <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
        <Text style={styles.closeText}>Annuler le Scan</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#000',
  },
  btn: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#d4af37',
    borderRadius: 10
  },
  closeBtn: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center'
  },
  closeText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16
  }
});
