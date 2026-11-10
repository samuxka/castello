import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Notifications from 'expo-notifications';
import { Platform, Vibration } from 'react-native';

const LUNCH_TIMER_STORAGE_KEY = '@castelo_ponto:lunch_timer_state';

export interface LunchTimerState {
  isActive: boolean;
  startTimeMs: number;
  endTimeMs: number;
  notificationId: string | null;
}

// Configura comportamento das notificações mesmo com o app em primeiro plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Gera um arquivo WAV (base64) de alarme sonoro (bipes duplos em 880Hz)
 * para tocar independentemente de arquivos externos de áudio.
 */
function createAlarmWavDataUri(): string {
  const sampleRate = 8000;
  const durationSeconds = 2;
  const numSamples = sampleRate * durationSeconds;
  const buffer = new ArrayBuffer(44 + numSamples);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, 1, true);  // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);  // 8-bit samples
  writeString(36, 'data');
  view.setUint32(40, numSamples, true);

  // Sintetiza bipes de alarme de relógio digital (880Hz e 1100Hz alternados)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const cycle = t % 0.5;
    const isBeep = cycle < 0.15 || (cycle > 0.2 && cycle < 0.35);
    if (isBeep) {
      const freq = cycle < 0.15 ? 880 : 1046.5;
      const val = Math.sin(2 * Math.PI * freq * t) >= 0 ? 220 : 35;
      view.setUint8(44 + i, val);
    } else {
      view.setUint8(44 + i, 128); // Silêncio em PCM 8-bit unsigned
    }
  }

  const bytes = new Uint8Array(buffer);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let base64 = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    base64 += chars[b1 >> 2];
    base64 += chars[((b1 & 3) << 4) | (b2 >> 4)];
    base64 += i + 1 < bytes.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    base64 += i + 2 < bytes.length ? chars[b3 & 63] : '=';
  }

  return `data:audio/wav;base64,${base64}`;
}

let activeSound: AudioPlayer | null = null;

/**
 * Inicializa canal de notificação de alta prioridade no Android e permissões
 */
export async function setupAlarmNotifications(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('lunch-alarm', {
        name: 'Alarme de Fim de Almoço',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500, 250, 800],
        lightColor: '#F59E0B',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        sound: 'default',
        enableVibrate: true,
        bypassDnd: true,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (err) {
    console.warn('Aviso ao configurar notificações:', err);
    return false;
  }
}

/**
 * Inicia o Timer de 1h (3600 segundos) de almoço, persiste o horário de término
 * e agenda a notificação de alarme em segundo plano no sistema operacional.
 */
export async function startLunchTimer(durationSeconds: number = 3600): Promise<LunchTimerState> {
  await setupAlarmNotifications();
  await stopRingingAlarm();

  const startTimeMs = Date.now();
  const endTimeMs = startTimeMs + durationSeconds * 1000;
  let notificationId: string | null = null;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '⏰ Fim do Horário de Almoço!',
        body: 'Sua 1 hora de almoço terminou. Hora de retornar às atividades e registrar seu ponto.',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        vibrate: [0, 500, 250, 500, 250, 800],
        data: { type: 'LUNCH_ALARM_FINISHED' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(endTimeMs),
        channelId: Platform.OS === 'android' ? 'lunch-alarm' : undefined,
      },
    });
  } catch (err) {
    console.warn('Não foi possível agendar notificação nativa (ex: ambiente web):', err);
  }

  const state: LunchTimerState = {
    isActive: true,
    startTimeMs,
    endTimeMs,
    notificationId,
  };

  await AsyncStorage.setItem(LUNCH_TIMER_STORAGE_KEY, JSON.stringify(state));
  return state;
}

/**
 * Recupera o estado salvo do timer de almoço (funciona mesmo se o app foi fechado)
 */
export async function getSavedLunchTimer(): Promise<LunchTimerState | null> {
  try {
    const raw = await AsyncStorage.getItem(LUNCH_TIMER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LunchTimerState;
  } catch {
    return null;
  }
}

/**
 * Cancela o timer de almoço e remove notificações pendentes
 */
export async function clearLunchTimer(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LUNCH_TIMER_STORAGE_KEY);
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Ignora erro em plataforma sem suporte nativo
  }
}

/**
 * Toca o alarme sonoro contínuo + vibração quando o timer de 1h termina
 */
export async function playRingingAlarm(): Promise<void> {
  try {
    // Vibração contínua em padrão de alarme
    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 600, 300, 600, 300, 800], true);
    }

    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });

    if (activeSound) {
      activeSound.remove();
      activeSound = null;
    }

    const wavUri = createAlarmWavDataUri();
    const player = createAudioPlayer({ uri: wavUri });
    player.loop = true;
    player.volume = 1.0;
    player.play();
    activeSound = player;
  } catch (err) {
    console.warn('Erro ao reproduzir áudio do alarme:', err);
  }
}

/**
 * Para o som e a vibração do alarme
 */
export async function stopRingingAlarm(): Promise<void> {
  try {
    if (Platform.OS !== 'web') {
      Vibration.cancel();
    }
    if (activeSound) {
      activeSound.pause();
      activeSound.remove();
      activeSound = null;
    }
  } catch {
    // Ignora erro ao parar som
  }
}

