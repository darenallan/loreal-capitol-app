// Synthesizer de Sonnerie Téléphonique Réaliste via HTML5 Audio (Blob WAV) + Web Audio API
// Ne dépend d'aucun fichier externe -> Fonctionne instantanément sur iPhone, Android et Ordinateur

let globalAudioElement: HTMLAudioElement | null = null;
let audioCtx: any = null;
let isRinging = false;
let ringCount = 0;
let ringIntervalId: any = null;
let cachedWavUrl: string | null = null;
let isAudioUnlocked = false;

/**
 * Génère un son WAV de 3.2 secondes (Dring-dring... pause...) via un Blob binaire
 * Double tonalité téléphonique puissante (440Hz + 480Hz + 880Hz)
 */
function getPhoneRingWavUrl(): string {
  if (cachedWavUrl) return cachedWavUrl;
  if (typeof window === 'undefined') return '';

  try {
    const sampleRate = 22050;
    const duration = 3.2; // 3.2 secondes par cycle de sonnerie
    const numSamples = Math.floor(sampleRate * duration);
    const headerByteLength = 44;
    const dataByteLength = numSamples * 2; // 16-bit PCM

    const buffer = new ArrayBuffer(headerByteLength + dataByteLength);
    const view = new DataView(buffer);

    // RIFF identifier
    view.setUint8(0, 'R'.charCodeAt(0));
    view.setUint8(1, 'I'.charCodeAt(0));
    view.setUint8(2, 'F'.charCodeAt(0));
    view.setUint8(3, 'F'.charCodeAt(0));
    view.setUint32(4, 36 + dataByteLength, true);
    view.setUint8(8, 'W'.charCodeAt(0));
    view.setUint8(9, 'A'.charCodeAt(0));
    view.setUint8(10, 'V'.charCodeAt(0));
    view.setUint8(11, 'E'.charCodeAt(0));
    view.setUint8(12, 'f'.charCodeAt(0));
    view.setUint8(13, 'm'.charCodeAt(0));
    view.setUint8(14, 't'.charCodeAt(0));
    view.setUint8(15, ' '.charCodeAt(0));
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true); // PCM = 1
    view.setUint16(22, 1, true); // Mono = 1
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // ByteRate
    view.setUint16(32, 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample
    view.setUint8(36, 'd'.charCodeAt(0));
    view.setUint8(37, 'a'.charCodeAt(0));
    view.setUint8(38, 't'.charCodeAt(0));
    view.setUint8(39, 'a'.charCodeAt(0));
    view.setUint32(40, dataByteLength, true);

    // Double coup de sonnerie puissante :
    // Bip 1 : 0.05s à 0.65s (Dring 1 avec battement rapide de cloche mécanique)
    // Silence court : 0.65s à 0.85s
    // Bip 2 : 0.85s à 1.45s (Dring 2)
    // Silence d'attente : 1.45s à 3.20s
    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let sample = 0;
      const inRing1 = t >= 0.05 && t < 0.65;
      const inRing2 = t >= 0.85 && t < 1.45;
      if (inRing1 || inRing2) {
        // Fréquences percutantes à haut rendement acoustique pour petits haut-parleurs (853Hz, 960Hz, 1477Hz, 2200Hz, 2750Hz)
        // Tremolo 25Hz simulant la percussion rapide du marteau mécanique sur la cloche
        const tremolo = 0.65 + 0.35 * Math.sin(2 * Math.PI * 25 * t);
        const tone1 = Math.sin(2 * Math.PI * 853 * t) * 0.5;
        const tone2 = Math.sin(2 * Math.PI * 960 * t) * 0.5;
        const tone3 = Math.sin(2 * Math.PI * 1477 * t) * 0.4;
        const tone4 = Math.sin(2 * Math.PI * 2200 * t) * 0.35;
        const tone5 = Math.sin(2 * Math.PI * 2750 * t) * 0.25; // Clarté aiguë audible de loin

        // Onde brute combinée
        const raw = (tone1 + tone2 + tone3 + tone4 + tone5) * tremolo;

        // Saturation douce analogique (tanh) pour booster la puissance RMS perçue au maximum physique
        sample = Math.tanh(raw * 1.5) * 0.98;

        // Adoucissement anti-clic
        const ringStart = inRing1 ? 0.05 : 0.85;
        const ringEnd = inRing1 ? 0.65 : 1.45;
        const localT = t - ringStart;
        const remainingT = ringEnd - t;
        if (localT < 0.015) sample *= (localT / 0.015);
        if (remainingT < 0.015) sample *= (remainingT / 0.015);
      }
      const intVal = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
      view.setInt16(offset, intVal, true);
      offset += 2;
    }

    const blob = new Blob([buffer], { type: 'audio/wav' });
    cachedWavUrl = URL.createObjectURL(blob);
    return cachedWavUrl;
  } catch (e) {
    console.error('Erreur génération Blob WAV:', e);
    return '';
  }
}

let keepAliveSource: any = null;
let titleIntervalId: any = null;
let originalPageTitle: string = typeof document !== 'undefined' ? document.title : "L'Oréal Capitol";

/**
 * Maintient le flux audio Web Audio actif en continu via un buffer silencieux en boucle.
 * Grâce à cette boucle silencieuse, le navigateur NE SUSPENDE JAMAIS l'AudioContext.
 * La sonnerie sonnera donc 100% AUTOMATIQUEMENT sans qu'il soit nécessaire de recliquer sur un bouton !
 */
export function startAudioKeepAlive() {
  if (typeof window === 'undefined') return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) audioCtx = new AudioContextClass();

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(() => {
        isAudioUnlocked = true;
      }).catch(() => {});
    }

    if (!keepAliveSource && audioCtx.state === 'running') {
      try {
        const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
        keepAliveSource = audioCtx.createBufferSource();
        keepAliveSource.buffer = buffer;
        keepAliveSource.loop = true;

        const silenceGain = audioCtx.createGain();
        silenceGain.gain.setValueAtTime(0.00001, audioCtx.currentTime); // Inaudible

        keepAliveSource.connect(silenceGain);
        silenceGain.connect(audioCtx.destination);
        keepAliveSource.start(0);
        isAudioUnlocked = true;
      } catch (e) {}
    }
  } catch (e) {}
}

/**
 * Demande l'autorisation pour les notifications de bureau en arrière-plan
 * (Permet de recevoir l'alerte même quand l'application est réduite ou en arrière-plan)
 */
export async function requestDesktopNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;

  try {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const result = await Notification.requestPermission();
      return result === 'granted';
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Envoie une notification système sur l'ordinateur / téléphone
 * Fonctionne même si la fenêtre est en arrière-plan ou réduite !
 */
export function sendDesktopNotification(title: string, options: { body: string; tag?: string }) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    try {
      const notif = new Notification(title, {
        body: options.body,
        icon: 'https://loreal-capitol-app.vercel.app/favicon.ico',
        badge: 'https://loreal-capitol-app.vercel.app/favicon.ico',
        tag: options.tag || 'capitol-alert',
        requireInteraction: true, // Reste affiché à l'écran jusqu'à ce que l'utilisateur clique !
      });

      notif.onclick = () => {
        try {
          window.focus();
          notif.close();
        } catch (e) {}
      };
    } catch (e) {}
  }
}

/**
 * Fait clignoter le titre de l'onglet dans la barre des tâches de Windows/ordinateur
 * pour attirer l'attention si l'utilisateur est sur un autre logiciel (Word, Excel, etc.)
 */
export function startFlashingTabTitle(alertText: string = '🚨 DEMANDE DE TRANSFERT REÇUE !') {
  if (typeof document === 'undefined') return;
  stopFlashingTabTitle();

  originalPageTitle = document.title || "L'Oréal Capitol";
  let toggle = false;

  titleIntervalId = setInterval(() => {
    try {
      document.title = toggle ? alertText : "🔔 L'ORÉAL CAPITOL";
      toggle = !toggle;
    } catch (e) {}
  }, 750);
}

export function stopFlashingTabTitle() {
  if (titleIntervalId) {
    clearInterval(titleIntervalId);
    titleIntervalId = null;
  }
  if (typeof document !== 'undefined') {
    try {
      document.title = "L'Oréal Capitol";
    } catch (e) {}
  }
}

/**
 * Débloque l'audio et démarre la boucle keep-alive dès la toute première interaction utilisateur
 */
export function initAudioUnlock() {
  if (typeof window === 'undefined') return;

  const unlock = () => {
    try {
      startAudioKeepAlive();

      // Initialiser et débloquer également l'élément Audio HTML5
      if (!globalAudioElement) {
        const url = getPhoneRingWavUrl();
        if (url) {
          globalAudioElement = new Audio(url);
          globalAudioElement.volume = 0.01;
          const p = globalAudioElement.play();
          if (p !== undefined) {
            p.then(() => {
              if (globalAudioElement) {
                globalAudioElement.pause();
                globalAudioElement.currentTime = 0;
                globalAudioElement.volume = 1.0;
                isAudioUnlocked = true;
              }
            }).catch(() => {});
          }
        }
      }
    } catch (e) {}
  };

  window.addEventListener('click', unlock, { passive: true, once: false });
  window.addEventListener('touchstart', unlock, { passive: true, once: false });
  window.addEventListener('touchend', unlock, { passive: true, once: false });
  window.addEventListener('pointerdown', unlock, { passive: true, once: false });
  window.addEventListener('keydown', unlock, { passive: true, once: false });
  window.addEventListener('mousemove', unlock, { passive: true, once: true });
}

/**
 * Joue immédiatement une sonnerie percutante (Synchrone lors d'un tap / clic utilisateur)
 * Ce mode ne peut JAMAIS être bloqué par le navigateur car il s'exécute dans la pile d'événement utilisateur.
 */
export function playRingToneNow(maxRings: number = 30) {
  stopRingtone();
  
  // Réveil forcé synchrone
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass && !audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  } catch (e) {}

  startRingtone({ maxRings });
}

/**
 * Déclenche la sonnerie téléphonique puissante (30 cycles par défaut pour être entendu de loin)
 */
export function startRingtone({
  maxRings = 30,
  onEnd
}: {
  maxRings?: number;
  onEnd?: () => void;
} = {}) {
  if (isRinging) return;
  isRinging = true;
  ringCount = 0;

  const playCycle = () => {
    if (!isRinging) return;

    if (ringCount >= maxRings) {
      stopRingtone();
      if (onEnd) onEnd();
      return;
    }

    ringCount++;

    // 1. Vibration Smartphone vigoureuse et continue
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([800, 200, 800, 200, 800]);
      } catch (e) {}
    }

    // 2. Jouer à la fois via HTML5 Audio ET via WebAudio synthétisé pour garantir 100% d'audibilité
    let html5Played = false;
    try {
      if (!globalAudioElement) {
        const url = getPhoneRingWavUrl();
        if (url) {
          globalAudioElement = new Audio(url);
        }
      }
      if (globalAudioElement) {
        globalAudioElement.volume = 1.0;
        globalAudioElement.currentTime = 0;
        const playPromise = globalAudioElement.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            html5Played = true;
          }).catch((err) => {
            console.log('HTML5 play prevented by browser, using WebAudio fallback:', err);
            playToneWebAudioFallback();
          });
        }
      } else {
        playToneWebAudioFallback();
      }
    } catch (e) {
      playToneWebAudioFallback();
    }

    // Déclencher le compresseur Web Audio en renfort acoustique immédiat
    setTimeout(() => {
      playToneWebAudioFallback();
    }, 40);
  };

  playCycle();

  // Répéter chaque 3.2 secondes
  ringIntervalId = setInterval(() => {
    playCycle();
  }, 3200);
}

/**
 * Synthétiseur de cloche téléphonique de magasin ultra-percutante via Web Audio API
 * Utilise un compresseur de dynamique et un booster de sortie pour pousser le volume acoustique au maximum des haut-parleurs
 */
function playToneWebAudioFallback() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    // Compresseur de dynamique pour maximiser la puissance RMS perçue
    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-14, audioCtx.currentTime);
    compressor.knee.setValueAtTime(6, audioCtx.currentTime);
    compressor.ratio.setValueAtTime(18, audioCtx.currentTime);
    compressor.attack.setValueAtTime(0.001, audioCtx.currentTime);
    compressor.release.setValueAtTime(0.18, audioCtx.currentTime);

    // Booster de sortie (+25% de gain en sortie de compresseur)
    const booster = audioCtx.createGain();
    booster.gain.setValueAtTime(1.35, audioCtx.currentTime);

    compressor.connect(booster);
    booster.connect(audioCtx.destination);

    const playBellBurst = (startTime: number, duration: number) => {
      const masterGain = audioCtx.createGain();
      masterGain.connect(compressor);
      masterGain.gain.setValueAtTime(0.001, startTime);
      masterGain.gain.linearRampToValueAtTime(1.0, startTime + 0.02);
      masterGain.gain.setValueAtTime(1.0, startTime + duration - 0.03);
      masterGain.gain.linearRampToValueAtTime(0.001, startTime + duration);

      // Fréquences claires de sonnerie de boutique (853Hz, 960Hz, 1477Hz, 2200Hz, 2750Hz)
      const freqs = [853, 960, 1477, 2200, 2750];
      freqs.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);
        osc.connect(masterGain);
        osc.start(startTime);
        osc.stop(startTime + duration);
      });
    };

    const now = audioCtx.currentTime;
    // Dring 1 (0.55s)
    playBellBurst(now + 0.05, 0.55);
    // Dring 2 (0.55s)
    playBellBurst(now + 0.80, 0.55);

  } catch (e) {
    console.warn('WebAudio playTone error:', e);
  }
}


/**
 * Stoppe immédiatement la sonnerie et les vibrations
 */
export function stopRingtone() {
  isRinging = false;
  ringCount = 0;
  if (ringIntervalId) {
    clearInterval(ringIntervalId);
    ringIntervalId = null;
  }
  if (globalAudioElement) {
    try {
      globalAudioElement.pause();
      globalAudioElement.currentTime = 0;
    } catch (e) {}
  }
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(0); } catch (e) {}
  }
}

export function isRingtonePlaying(): boolean {
  return isRinging;
}

export function testRingtone() {
  playRingToneNow(1);
}

