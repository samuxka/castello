import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type MobileDialogType = 'info' | 'success' | 'warning' | 'danger' | 'confirm';

export interface MobileDialogButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface MobileDialogOptions {
  title: string;
  message: string;
  type?: MobileDialogType;
  buttons?: MobileDialogButton[];
}

interface DialogContextType {
  showAlert: (title: string, message: string, buttons?: MobileDialogButton[], type?: MobileDialogType) => void;
  showConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string,
    type?: MobileDialogType
  ) => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

// Globais para permitir chamada mesmo fora de componentes React ou em helpers
let globalAlertHandler: ((title: string, message: string, buttons?: MobileDialogButton[], type?: MobileDialogType) => void) | null = null;

export function showCustomAlert(
  title: string,
  message: string,
  buttons?: MobileDialogButton[],
  type: MobileDialogType = 'info'
) {
  if (globalAlertHandler) {
    globalAlertHandler(title, message, buttons, type);
  }
}

export function showCustomConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void,
  confirmText: string = 'Confirmar',
  cancelText: string = 'Cancelar',
  type: MobileDialogType = 'confirm'
) {
  showCustomAlert(
    title,
    message,
    [
      { text: cancelText, style: 'cancel', onPress: onCancel },
      { text: confirmText, style: type === 'danger' ? 'destructive' : 'default', onPress: onConfirm },
    ],
    type
  );
}

interface DialogState {
  visible: boolean;
  title: string;
  message: string;
  type: MobileDialogType;
  buttons: MobileDialogButton[];
}

export function DialogProvider({ children, isDark = true }: { children: ReactNode; isDark?: boolean }) {
  const [dialogState, setDialogState] = useState<DialogState>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    buttons: [{ text: 'OK' }],
  });

  const showAlert = useCallback(
    (title: string, message: string, buttons?: MobileDialogButton[], type: MobileDialogType = 'info') => {
      setDialogState({
        visible: true,
        title,
        message,
        type,
        buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
      });
    },
    []
  );

  const showConfirm = useCallback(
    (
      title: string,
      message: string,
      onConfirm: () => void,
      onCancel?: () => void,
      confirmText: string = 'Confirmar',
      cancelText: string = 'Cancelar',
      type: MobileDialogType = 'confirm'
    ) => {
      showAlert(
        title,
        message,
        [
          { text: cancelText, style: 'cancel', onPress: onCancel },
          { text: confirmText, style: type === 'danger' ? 'destructive' : 'default', onPress: onConfirm },
        ],
        type
      );
    },
    [showAlert]
  );

  useEffect(() => {
    globalAlertHandler = showAlert;
    return () => {
      globalAlertHandler = null;
    };
  }, [showAlert]);

  const handleClose = (button?: MobileDialogButton) => {
    setDialogState((prev) => ({ ...prev, visible: false }));
    if (button?.onPress) {
      setTimeout(() => button.onPress!(), 50);
    }
  };

  const getIconData = () => {
    switch (dialogState.type) {
      case 'success':
        return { name: 'checkmark-circle-outline' as const, color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' };
      case 'warning':
        return { name: 'alert-circle-outline' as const, color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)' };
      case 'danger':
        return { name: 'trash-outline' as const, color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)' };
      default:
        return { name: 'information-circle-outline' as const, color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)' };
    }
  };

  const iconData = getIconData();

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm }}>
      {children}

      <Modal visible={dialogState.visible} transparent animationType="fade" onRequestClose={() => handleClose()}>
        <View style={styles.backdrop}>
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                borderColor: isDark ? '#334155' : '#E2E8F0',
              },
            ]}
          >
            {/* Ícone e Título */}
            <View style={styles.headerRow}>
              <View style={[styles.iconCircle, { backgroundColor: iconData.bg }]}>
                <Ionicons name={iconData.name} size={24} color={iconData.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                  {dialogState.title}
                </Text>
              </View>
            </View>

            {/* Mensagem */}
            <Text style={[styles.message, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              {dialogState.message}
            </Text>

            {/* Botões de Ação */}
            <View style={styles.actionsRow}>
              {dialogState.buttons.map((btn, idx) => {
                const isCancel = btn.style === 'cancel';
                const isDestructive = btn.style === 'destructive';

                let btnBg = '#3B82F6';
                let textColor = '#FFFFFF';

                if (isCancel) {
                  btnBg = isDark ? '#334155' : '#F1F5F9';
                  textColor = isDark ? '#CBD5E1' : '#475569';
                } else if (isDestructive) {
                  btnBg = '#EF4444';
                  textColor = '#FFFFFF';
                }

                return (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.8}
                    onPress={() => handleClose(btn)}
                    style={[styles.button, { backgroundColor: btnBg, flex: dialogState.buttons.length > 1 ? 1 : undefined }]}
                  >
                    <Text style={[styles.buttonText, { color: textColor }]}>
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </DialogContext.Provider>
  );
}

export function useCustomDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useCustomDialog must be used within a DialogProvider');
  }
  return context;
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: Math.min(width - 48, 380),
    borderRadius: 16,
    borderWidth: 1,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
