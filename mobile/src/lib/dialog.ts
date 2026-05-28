import { Alert, Platform } from 'react-native';

type DialogAction = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

function webMessage(title: string, message?: string) {
  return message ? `${title}\n\n${message}` : title;
}

function browserDialog() {
  return globalThis as typeof globalThis & {
    alert?: (message?: string) => void;
    confirm?: (message?: string) => boolean;
  };
}

export function showDialog(title: string, message?: string, actions?: DialogAction[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, actions);
    return;
  }

  const dialog = browserDialog();
  const hasChoice = actions && actions.length > 1;
  if (!hasChoice) {
    dialog.alert?.(webMessage(title, message));
    actions?.[0]?.onPress?.();
    return;
  }

  const cancelAction = actions.find((action) => action.style === 'cancel');
  const confirmAction = [...actions].reverse().find((action) => action.style !== 'cancel');
  const confirmed = dialog.confirm?.(webMessage(title, message)) ?? false;
  if (confirmed) {
    confirmAction?.onPress?.();
  } else {
    cancelAction?.onPress?.();
  }
}
