import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Info, Trash2, X, XCircle, ShieldCheck } from 'lucide-react';

export type DialogType = 'confirm' | 'danger' | 'warning' | 'info' | 'error' | 'success';

export interface ConfirmOptions {
  title: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
}

export interface AlertOptions {
  title?: string;
  message: string;
  type?: 'info' | 'error' | 'success' | 'warning';
  confirmText?: string;
}

interface DialogContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions | string) => Promise<void>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

// Globais para permitir chamada mesmo fora de componentes React ou em callbacks simples
let globalConfirmHandler: ((opts: ConfirmOptions) => Promise<boolean>) | null = null;
let globalAlertHandler: ((opts: AlertOptions | string) => Promise<void>) | null = null;

export function customConfirm(options: ConfirmOptions): Promise<boolean> {
  if (globalConfirmHandler) {
    return globalConfirmHandler(options);
  }
  return Promise.resolve(window.confirm(options.message));
}

export function customAlert(options: AlertOptions | string): Promise<void> {
  if (globalAlertHandler) {
    return globalAlertHandler(options);
  }
  const msg = typeof options === 'string' ? options : options.message;
  window.alert(msg);
  return Promise.resolve();
}

interface DialogState {
  isOpen: boolean;
  isConfirm: boolean;
  title: string;
  message: string;
  type: DialogType;
  confirmText: string;
  cancelText: string;
  resolve: (val: boolean) => void;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialogState, setDialogState] = useState<DialogState>({
    isOpen: false,
    isConfirm: false,
    title: '',
    message: '',
    type: 'info',
    confirmText: 'OK',
    cancelText: 'Cancelar',
    resolve: () => {},
  });

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setDialogState({
        isOpen: true,
        isConfirm: true,
        title: opts.title || 'Confirmação',
        message: opts.message,
        type: opts.type || 'confirm',
        confirmText: opts.confirmText || 'Confirmar',
        cancelText: opts.cancelText || 'Cancelar',
        resolve,
      });
    });
  }, []);

  const alert = useCallback((opts: AlertOptions | string): Promise<void> => {
    return new Promise<void>((resolve) => {
      const isStr = typeof opts === 'string';
      const title = isStr ? 'Informação' : opts.title || (opts.type === 'error' ? 'Atenção' : 'Aviso');
      const message = isStr ? opts : opts.message;
      const type = isStr ? 'info' : opts.type || 'info';
      const confirmText = isStr ? 'Entendido' : opts.confirmText || 'OK';

      setDialogState({
        isOpen: true,
        isConfirm: false,
        title,
        message,
        type,
        confirmText,
        cancelText: '',
        resolve: () => resolve(),
      });
    });
  }, []);

  useEffect(() => {
    globalConfirmHandler = confirm;
    globalAlertHandler = alert;

    const originalAlert = window.alert;
    window.alert = (message?: any) => {
      alert(String(message ?? ''));
    };

    return () => {
      globalConfirmHandler = null;
      globalAlertHandler = null;
      window.alert = originalAlert;
    };
  }, [confirm, alert]);

  const handleClose = (result: boolean) => {
    setDialogState((prev) => ({ ...prev, isOpen: false }));
    dialogState.resolve(result);
  };

  const getIcon = () => {
    switch (dialogState.type) {
      case 'danger':
        return <Trash2 size={24} color="#EF4444" />;
      case 'warning':
        return <AlertTriangle size={24} color="#F59E0B" />;
      case 'error':
        return <XCircle size={24} color="#EF4444" />;
      case 'success':
        return <CheckCircle2 size={24} color="#10B981" />;
      case 'confirm':
        return <ShieldCheck size={24} color="var(--primary)" />;
      default:
        return <Info size={24} color="var(--primary)" />;
    }
  };

  const getBorderColor = () => {
    switch (dialogState.type) {
      case 'danger':
      case 'error':
        return '#EF4444';
      case 'warning':
        return '#F59E0B';
      case 'success':
        return '#10B981';
      default:
        return 'var(--primary)';
    }
  };

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}

      {/* MODAL PERSONALIZADO CORPORATIVO DE CONFIRMAÇÃO / DIÁLOGO */}
      {dialogState.isOpen && (
        <div
          className="flat-modal-backdrop"
          style={{ zIndex: 99999, animation: 'fadeIn 0.15s ease-out' }}
          onClick={() => handleClose(false)}
        >
          <div
            className="flat-modal-box"
            style={{
              maxWidth: 440,
              padding: 0,
              borderRadius: 14,
              overflow: 'hidden',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
              animation: 'scaleUp 0.15s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Faixa Superior com Cor Indicativa */}
            <div style={{ height: 4, backgroundColor: getBorderColor() }} />

            <div style={{ padding: '24px 24px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    backgroundColor: 'var(--bg-card-subtle)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {getIcon()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: 'var(--text-main)',
                      margin: '0 0 6px 0',
                    }}
                  >
                    {dialogState.title}
                  </h3>
                  <p
                    style={{
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: 'var(--text-muted)',
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {dialogState.message}
                  </p>
                </div>
              </div>
            </div>

            {/* Rodapé com Botões Customizados */}
            <div
              style={{
                padding: '14px 20px',
                backgroundColor: 'var(--bg-card-subtle)',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: 10,
              }}
            >
              {dialogState.isConfirm && (
                <button
                  type="button"
                  className="btn-flat-secondary"
                  onClick={() => handleClose(false)}
                  style={{
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  {dialogState.cancelText}
                </button>
              )}

              <button
                type="button"
                className={dialogState.type === 'danger' ? 'btn-flat-danger' : 'btn-flat-primary'}
                onClick={() => handleClose(true)}
                autoFocus
                style={{
                  padding: '8px 18px',
                  fontSize: 13,
                  fontWeight: 700,
                  borderRadius: 8,
                  cursor: 'pointer',
                  backgroundColor: dialogState.type === 'danger' ? '#EF4444' : undefined,
                  color: '#ffffff',
                }}
              >
                {dialogState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}
