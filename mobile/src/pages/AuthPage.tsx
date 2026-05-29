import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAccount, useAppKit, useProvider } from '@reown/appkit-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { accountStatusMessage, errorMessage, routeForEntry } from '../lib/account';
import { isWalletConnectConfigured } from '../lib/appkit';
import { clearWalletSessionStorage } from '../lib/appkitStorage';
import { backendApi } from '../lib/backend';

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type WalletStep = 'idle' | 'connecting' | 'signing' | 'signed';

const NATIVE_WALLET_HELP =
  'WalletConnect 지갑을 연결한 뒤 서명을 승인하면 인증이 완료됩니다.';

const PENDING_WALLET_LOGIN_KEY = '@trustticket:pendingWalletLogin';

// Pending flag expires after this many milliseconds. A cold-start that finds
// a flag older than this treats it as stale and ignores it, preventing
// auto-login from firing when the user simply reopens the app normally.
const PENDING_LOGIN_TTL_MS = 5 * 60 * 1000; // 5 minutes

// personal_sign can hang indefinitely if the relay drops the response while
// the app is backgrounded. Reject after 5 minutes so the UI unblocks.
const SIGN_TIMEOUT_MS = 5 * 60 * 1000;

type PendingLoginRecord = { pending: true; timestamp: number };

function getEthereumProvider() {
  if (Platform.OS !== 'web') return null;
  const g = globalThis as typeof globalThis & {
    ethereum?: EthereumProvider;
    window?: { ethereum?: EthereumProvider };
  };
  return g.ethereum ?? g.window?.ethereum ?? null;
}

function walletClientMessage(error: any, fallback: string) {
  if (error?.code === 4001) {
    return '지갑 요청을 거절했습니다. 지갑에서 연결 또는 서명을 승인해야 계속할 수 있습니다.';
  }
  if (error?.code === -32002) {
    return '지갑에서 이미 처리 중인 요청이 있습니다. 지갑 앱을 열어 요청을 완료해 주세요.';
  }
  const raw = typeof error?.message === 'string' ? error.message : '';
  const lower = raw.toLowerCase();
  if (lower.includes('locked') || lower.includes('unlock')) {
    return '지갑이 잠겨 있습니다. 지갑 잠금을 해제하고 다시 시도해 주세요.';
  }
  if (lower.includes('rejected') || lower.includes('denied')) {
    return '지갑 요청을 거절했습니다. 연결 또는 서명을 승인해야 계속할 수 있습니다.';
  }
  if (lower.includes('timeout') || lower.includes('expired')) {
    return '지갑 승인 시간이 만료되었습니다. 다시 시도해 주세요.';
  }
  return raw.trim() ? raw : fallback;
}

function stringifyWalletError(error: any) {
  try {
    return [
      error?.message,
      error?.reason,
      typeof error?.toString === 'function' ? error.toString() : '',
      JSON.stringify(error),
    ].filter(Boolean).join(' ');
  } catch {
    return String(error?.message ?? error ?? '');
  }
}

function isStaleWalletSessionError(error: any) {
  const msg = stringifyWalletError(error);
  return msg.includes('No matching key') || msg.includes('session:');
}

// Writes or removes the pending login flag together with a creation timestamp.
// The timestamp lets the mount effect ignore flags that are older than TTL.
function syncPendingWalletLogin(pending: boolean): void {
  if (pending) {
    const record: PendingLoginRecord = { pending: true, timestamp: Date.now() };
    AsyncStorage.setItem(PENDING_WALLET_LOGIN_KEY, JSON.stringify(record)).catch(() => {});
  } else {
    AsyncStorage.removeItem(PENDING_WALLET_LOGIN_KEY).catch(() => {});
  }
}

// Opens the previously chosen wallet app (stored by WalletConnect) so the
// user can see and approve a pending personal_sign request.
async function openWalletApp(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem('WALLETCONNECT_DEEPLINK_CHOICE');
    if (raw) {
      const choice = JSON.parse(raw) as { href?: string; universal?: string };
      const url = choice.href || choice.universal;
      if (url && (await Linking.canOpenURL(url))) {
        await Linking.openURL(url);
        return;
      }
    }
  } catch {}
  try {
    if (await Linking.canOpenURL('metamask://')) {
      await Linking.openURL('metamask://');
      return;
    }
  } catch {}
  Alert.alert('지갑을 열 수 없습니다', '지갑 앱이 설치되어 있는지 확인해 주세요.');
}

async function requestPersonalSign(
  provider: EthereumProvider,
  message: string,
  address: string,
): Promise<string> {
  const signPromise = provider.request({ method: 'personal_sign', params: [message, address] });
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error('서명 요청 시간이 초과되었습니다 (5분). MetaMask 앱을 열어 대기 중인 서명 요청을 확인해 주세요.')),
      SIGN_TIMEOUT_MS,
    ),
  );
  return Promise.race([signPromise, timeout]) as Promise<string>;
}

export default function AuthPage({ navigation, route }: any) {
  const initialRole = route?.params?.initialRole ?? 'USER';
  const startsInWalletMode = Boolean(route?.params?.walletMode || route?.params?.autoWalletLogin);

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [walletMessage, setWalletMessage] = useState('');
  const [walletStep, setWalletStep] = useState<WalletStep>('idle');
  const [walletMode, setWalletMode] = useState(startsInWalletMode);
  const [loading, setLoading] = useState(false);
  const [pendingWalletLogin, setPendingWalletLogin] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const autoStartWalletRef = useRef(false);
  const autoWalletLoginRef = useRef(false);

  const { open, disconnect } = useAppKit();
  const { address: appKitAddress, isConnected } = useAccount();
  const { provider, providerType } = useProvider();

  const targetLabel = useMemo(() => (initialRole === 'ORGANIZER' ? '주최자' : '사용자'), [initialRole]);

  // Restore a recent pending-login flag that survived an app kill.
  // Flags older than PENDING_LOGIN_TTL_MS are discarded to avoid firing
  // auto-login when the user simply opens the app fresh at a later time.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;
    AsyncStorage.getItem(PENDING_WALLET_LOGIN_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        try {
          const record: PendingLoginRecord = JSON.parse(raw);
          const age = Date.now() - record.timestamp;
          if (record.pending && age < PENDING_LOGIN_TTL_MS) {
            console.log('[WalletLogin] Restored recent pendingWalletLogin (age:', Math.round(age / 1000), 's)');
            setPendingWalletLogin(true);
            setWalletMode(true);
          } else {
            console.log('[WalletLogin] Stale pendingWalletLogin in storage (age:', Math.round(age / 1000), 's), discarding');
            AsyncStorage.removeItem(PENDING_WALLET_LOGIN_KEY).catch(() => {});
          }
        } catch {
          AsyncStorage.removeItem(PENDING_WALLET_LOGIN_KEY).catch(() => {});
        }
      })
      .catch((err) => console.warn('[WalletLogin] Failed to read pending login flag:', err));
    return () => { cancelled = true; };
  }, []);

  // Clear the persisted flag when AuthPage is removed from the navigation stack.
  useEffect(() => {
    return () => { syncPendingWalletLogin(false); };
  }, []);

  // Log foreground transitions for debugging.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        console.log(
          '[WalletLogin] App foregrounded | pending:', pendingWalletLogin,
          '| connected:', isConnected, '| loading:', loading,
          '| step:', walletStep, '| autoRunning:', autoWalletLoginRef.current,
        );
      }
    });
    return () => sub.remove();
  });

  useEffect(() => {
    if (Platform.OS !== 'web' && isConnected && appKitAddress) {
      setWalletAddress(appKitAddress);
    }
  }, [appKitAddress, isConnected]);

  // ─── Email auth ────────────────────────────────────────────────────────────

  const handleEmailAuth = async () => {
    setFeedback(null);
    if (!email.trim() || !password) {
      const message = '이메일과 비밀번호를 입력해 주세요.';
      setFeedback({ type: 'error', message });
      Alert.alert('입력 필요', message);
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        const result = await backendApi.loginEmail({ email: email.trim(), password });
        const profile = result.user ?? await backendApi.getMe();
        const statusMessage = accountStatusMessage(profile.status);
        if (statusMessage) {
          setFeedback({ type: 'error', message: statusMessage });
          Alert.alert('로그인 실패', statusMessage);
          return;
        }
        navigation.replace(routeForEntry(profile, initialRole));
      } else {
        if (!displayName.trim()) {
          const message = '이름을 입력해 주세요.';
          setFeedback({ type: 'error', message });
          Alert.alert('입력 필요', message);
          return;
        }
        const result = await backendApi.registerEmail({ email: email.trim(), password, displayName: displayName.trim() });
        const profile = result.user ?? await backendApi.getMe();
        const message = initialRole === 'ORGANIZER' ? '가입되었습니다. 주최자 신청을 이어서 진행해 주세요.' : '가입되었습니다.';
        setFeedback({ type: 'success', message });
        Alert.alert('회원가입 완료', message);
        navigation.replace(routeForEntry(profile, initialRole));
      }
    } catch (error: any) {
      const message = errorMessage(error, '요청을 처리하지 못했습니다.');
      setFeedback({ type: 'error', message });
      Alert.alert(isLogin ? '로그인 실패' : '회원가입 실패', message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Wallet auth ───────────────────────────────────────────────────────────

  const connectInjectedWallet = async () => {
    const injectedProvider = getEthereumProvider();
    if (!injectedProvider) {
      throw new Error('브라우저 지갑을 찾을 수 없습니다. MetaMask 같은 Web3 지갑을 설치하거나 지갑 브라우저에서 접속해 주세요.');
    }
    setWalletStep('connecting');
    const accounts = await injectedProvider.request({ method: 'eth_requestAccounts' });
    const [address] = Array.isArray(accounts) ? accounts.filter((a): a is string => typeof a === 'string') : [];
    if (!address) throw new Error('연결된 지갑 주소를 가져오지 못했습니다.');
    setWalletAddress(address);
    return { provider: injectedProvider, address };
  };

  // isAutoTrigger = true  → returning from MetaMask; existing session is fresh, proceed directly.
  // isAutoTrigger = false → user manually pressed the button; disconnect any existing session
  //   and show the Connect modal so MetaMask opens fresh (biometric unlock happens during
  //   connection, ensuring the wallet is ready before personal_sign fires).
  const connectReownWallet = async (isAutoTrigger: boolean) => {
    if (!isWalletConnectConfigured) {
      throw new Error('WalletConnect Project ID가 설정되지 않았습니다. EXPO_PUBLIC_REOWN_PROJECT_ID를 .env에 추가해 주세요.');
    }

    setWalletStep('connecting');
    console.log('[WalletLogin] connectReownWallet | isAutoTrigger:', isAutoTrigger, '| isConnected:', isConnected, '| address:', appKitAddress);

    if (!isConnected || !appKitAddress || !provider) {
      console.log('[WalletLogin] No active session — opening Connect modal');
      setPendingWalletLogin(true);
      syncPendingWalletLogin(true);
      open({ view: 'Connect' });
      setFeedback({ type: 'success', message: '지갑 연결 화면을 열었습니다. 연결 승인 후 자동으로 서명 요청을 이어갑니다.' });
      setWalletStep('idle');
      return null;
    }

    if (!isAutoTrigger) {
      // Manual button press with an existing session: disconnect so MetaMask goes
      // through the full connection flow (including biometric unlock) before we
      // send personal_sign. This prevents the race where personal_sign arrives
      // while MetaMask is still showing the lock screen.
      console.log('[WalletLogin] Manual login with existing session — disconnecting for fresh connection');
      try { disconnect('eip155'); } catch {}
      await clearWalletSessionStorage();
      setPendingWalletLogin(true);
      syncPendingWalletLogin(true);
      open({ view: 'Connect' });
      setFeedback({ type: 'success', message: '지갑을 다시 연결합니다. MetaMask에서 연결을 승인해 주세요.' });
      setWalletStep('idle');
      return null;
    }

    if (providerType !== 'eip155') {
      throw new Error('EVM 지갑만 지원합니다. Ethereum 계열 지갑으로 연결해 주세요.');
    }

    setWalletAddress(appKitAddress);
    console.log('[WalletLogin] Active session confirmed — address:', appKitAddress);
    return { provider: provider as EthereumProvider, address: appKitAddress };
  };

  const connectWallet = (isAutoTrigger: boolean) => {
    if (Platform.OS === 'web') return connectInjectedWallet();
    return connectReownWallet(isAutoTrigger);
  };

  const handleWalletLogin = async (isAutoTrigger = false) => {
    if (!isLogin && !displayName.trim()) {
      setPendingWalletLogin(false);
      syncPendingWalletLogin(false);
      const message = '이름을 입력해 주세요.';
      setFeedback({ type: 'error', message });
      Alert.alert('입력 필요', message);
      return;
    }

    setLoading(true);
    setFeedback(null);
    console.log('[WalletLogin] handleWalletLogin | isAutoTrigger:', isAutoTrigger, '| isLogin:', isLogin);
    try {
      const connection = await connectWallet(isAutoTrigger);
      if (!connection) {
        console.log('[WalletLogin] Waiting for wallet connection.');
        return;
      }

      setPendingWalletLogin(false);
      syncPendingWalletLogin(false);
      console.log('[WalletLogin] Connected — address:', connection.address);

      const nonce = await backendApi.issueWalletNonce({ walletAddress: connection.address });
      setWalletAddress(nonce.walletAddress);
      setWalletMessage(nonce.message);
      setWalletStep('signing');
      console.log('[WalletLogin] Nonce issued (expires:', nonce.expiresAt, ') — requesting personal_sign');

      const signature = await requestPersonalSign(connection.provider, nonce.message, nonce.walletAddress);

      if (typeof signature !== 'string' || !signature.trim()) {
        throw new Error('지갑 서명이 완료되지 않았습니다.');
      }

      console.log('[WalletLogin] Signature received — calling /auth/wallet/login');
      setWalletStep('signed');
      const result = await backendApi.loginWallet({
        walletAddress: nonce.walletAddress,
        nonce: nonce.nonce,
        signature,
      });
      console.log('[WalletLogin] loginWallet success | accessToken present:', Boolean(result.accessToken));

      const profile = !isLogin && displayName.trim()
        ? await backendApi.updateMe({ displayName: displayName.trim() })
        : result.user ?? await backendApi.getMe();
      const statusMessage = accountStatusMessage(profile.status);
      if (statusMessage) {
        setFeedback({ type: 'error', message: statusMessage });
        Alert.alert('로그인 실패', statusMessage);
        return;
      }
      const targetRoute = routeForEntry(profile, initialRole);
      console.log('[WalletLogin] Login complete — navigating to', targetRoute);
      navigation.replace(targetRoute);
    } catch (error: any) {
      console.error('[WalletLogin] Error:', stringifyWalletError(error));

      if (isStaleWalletSessionError(error)) {
        setPendingWalletLogin(false);
        syncPendingWalletLogin(false);
        const message = '이전 WalletConnect 세션이 만료되어 초기화했습니다. 다시 지갑을 연결해 주세요.';
        try { disconnect('eip155'); } catch {}
        await clearWalletSessionStorage();
        setWalletAddress('');
        setWalletMessage('');
        setWalletStep('idle');
        setFeedback({ type: 'error', message });
        Alert.alert('지갑 세션 초기화', message);
        return;
      }

      const message = error?.response
        ? errorMessage(error, '지갑 로그인에 실패했습니다.')
        : walletClientMessage(error, '지갑 인증에 실패했습니다.');
      setPendingWalletLogin(false);
      syncPendingWalletLogin(false);
      setWalletStep('idle');
      setFeedback({ type: 'error', message });
      Alert.alert(isLogin ? '지갑 로그인 실패' : '지갑 회원가입 실패', message);
    } finally {
      setLoading(false);
    }
  };

  // Explicit reconnect: disconnects the current session and reopens the
  // Connect modal. Used when signing is stuck or the user wants to switch wallet.
  const handleReconnect = async () => {
    if (loading) return;
    console.log('[WalletLogin] Reconnect requested — resetting session');
    autoWalletLoginRef.current = false;
    setPendingWalletLogin(false);
    syncPendingWalletLogin(false);
    setWalletStep('idle');
    setWalletMessage('');
    setFeedback(null);
    try { disconnect('eip155'); } catch {}
    await clearWalletSessionStorage();
    // Small delay to let AppKit process the disconnect before reopening.
    await new Promise((r) => setTimeout(r, 300));
    setPendingWalletLogin(true);
    syncPendingWalletLogin(true);
    open({ view: 'Connect' });
    setFeedback({ type: 'success', message: '지갑을 재연결합니다. MetaMask에서 연결을 승인해 주세요.' });
  };

  // Auto-login trigger: fires when the wallet session becomes ready after the
  // user approved the connection in MetaMask (returning from MetaMask).
  // Always passes isAutoTrigger=true so connectReownWallet does NOT disconnect.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!pendingWalletLogin || autoWalletLoginRef.current || loading) return;
    if (!isConnected || !appKitAddress || !provider || providerType !== 'eip155') return;

    console.log('[WalletLogin] Auto-login trigger — WC session ready');
    autoWalletLoginRef.current = true;
    setFeedback({ type: 'success', message: '지갑 연결이 완료되었습니다. 서명 요청을 이어갑니다.' });

    void handleWalletLogin(/* isAutoTrigger */ true).finally(() => {
      autoWalletLoginRef.current = false;
    });
  }, [appKitAddress, isConnected, loading, pendingWalletLogin, provider, providerType]);

  // Route-param auto-start (e.g. navigated here with autoWalletLogin:true).
  useEffect(() => {
    if (!route?.params?.autoWalletLogin || autoStartWalletRef.current || loading) return;
    autoStartWalletRef.current = true;
    setWalletMode(true);
    void handleWalletLogin(/* isAutoTrigger */ true);
  }, [loading, route?.params?.autoWalletLogin]);

  // ─── Render ────────────────────────────────────────────────────────────────

  const isSigning = walletStep === 'signing';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.eyebrow}>{targetLabel} 시작</Text>
        <Text style={styles.title}>{isLogin ? '로그인' : '회원가입'}</Text>

        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tab, isLogin && styles.activeTab]} onPress={() => setIsLogin(true)}>
            <Text style={[styles.tabText, isLogin && styles.activeTabText]}>로그인</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, !isLogin && styles.activeTab]} onPress={() => setIsLogin(false)}>
            <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>회원가입</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          {feedback ? (
            <View style={[styles.messageBox, feedback.type === 'success' ? styles.successBox : styles.errorBox]}>
              <Text style={[styles.messageText, feedback.type === 'success' ? styles.successText : styles.errorText]}>
                {feedback.message}
              </Text>
            </View>
          ) : null}

          {walletMode ? (
            <>
              {!isLogin ? (
                <>
                  <Text style={styles.walletSignupHelp}>지갑으로 새 계정을 만들려면 이름과 지갑 서명이 필요합니다.</Text>
                  <TextInput style={styles.input} placeholder="이름" value={displayName} onChangeText={setDisplayName} />
                </>
              ) : null}

              <View style={styles.connectedWalletBox}>
                <Text style={styles.connectedWalletLabel}>연결된 지갑 주소</Text>
                <Text style={[styles.connectedWalletAddress, !walletAddress && styles.emptyWalletAddress]} numberOfLines={1}>
                  {walletAddress || '아직 연결된 지갑이 없습니다.'}
                </Text>
              </View>

              {Platform.OS !== 'web' && !isSigning ? (
                <Text style={styles.nativeWalletHelp}>{NATIVE_WALLET_HELP}</Text>
              ) : null}

              {isSigning ? (
                <View style={styles.signingHelpBox}>
                  <Text style={styles.signingHelpText}>
                    MetaMask 앱에서 서명 요청을 확인하고 승인해 주세요.
                  </Text>
                  <View style={styles.signingActions}>
                    <TouchableOpacity style={styles.openWalletButton} onPress={openWalletApp}>
                      <Text style={styles.openWalletButtonText}>MetaMask 열기</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.reconnectButton} onPress={handleReconnect}>
                      <Text style={styles.reconnectButtonText}>재연결</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}

              {walletMessage ? (
                <View style={styles.walletMessageBox}>
                  <Text style={styles.walletMessageLabel}>서명 요청 메시지</Text>
                  <Text style={styles.walletMessageText}>{walletMessage}</Text>
                </View>
              ) : null}

              {walletStep !== 'idle' ? (
                <View style={styles.walletStatusBox}>
                  <Text style={styles.walletStatusText}>
                    {walletStep === 'connecting'
                      ? '지갑 연결 요청 중'
                      : walletStep === 'signing'
                      ? '지갑 서명 승인 대기 중'
                      : '인증 완료'}
                  </Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.disabledButton]}
                disabled={loading}
                onPress={() => handleWalletLogin(false)}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? '처리 중...' : isLogin ? '지갑으로 로그인' : '지갑으로 회원가입'}
                </Text>
              </TouchableOpacity>

              {/* Reconnect shown only when idle — signing state has its own buttons above */}
              {!loading && !isSigning && isConnected ? (
                <TouchableOpacity style={styles.secondaryAction} onPress={handleReconnect}>
                  <Text style={styles.secondaryActionText}>지갑 재연결</Text>
                </TouchableOpacity>
              ) : null}
            </>
          ) : (
            <>
              {!isLogin ? (
                <TextInput style={styles.input} placeholder="이름" value={displayName} onChangeText={setDisplayName} />
              ) : null}
              <TextInput
                style={styles.input}
                placeholder="이메일"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                style={styles.input}
                placeholder="비밀번호"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.disabledButton]}
                disabled={loading}
                onPress={handleEmailAuth}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? '처리 중...' : isLogin ? '이메일로 로그인' : '이메일로 시작하기'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>또는</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity style={styles.walletButton} onPress={() => { setWalletMode((v) => !v); setFeedback(null); }}>
          <Text style={styles.walletButtonText}>{walletMode ? '이메일 인증으로 전환' : '지갑 인증으로 전환'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.switchButton} onPress={() => setIsLogin((v) => !v)}>
          <Text style={styles.switchButtonText}>
            {isLogin ? '계정이 없나요? 회원가입' : '이미 계정이 있나요? 로그인'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 30, paddingTop: 60 },
  eyebrow: { color: '#2563EB', fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 30, fontWeight: '900', marginBottom: 28, textAlign: 'center', color: '#0F172A' },
  tabContainer: { flexDirection: 'row', marginBottom: 26, backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 9 },
  activeTab: { backgroundColor: '#FFFFFF' },
  tabText: { fontSize: 16, color: '#64748B', fontWeight: '800' },
  activeTabText: { color: '#2563EB' },
  form: { gap: 12 },
  messageBox: { borderRadius: 12, padding: 12, borderWidth: 1 },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  successBox: { backgroundColor: '#ECFDF5', borderColor: '#BBF7D0' },
  messageText: { fontSize: 13, fontWeight: '800', lineHeight: 19 },
  errorText: { color: '#DC2626' },
  successText: { color: '#047857' },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', padding: 15, borderRadius: 12, fontSize: 16 },
  walletSignupHelp: { color: '#64748B', fontSize: 13, fontWeight: '700', lineHeight: 19 },
  nativeWalletHelp: { color: '#64748B', fontSize: 12, fontWeight: '700', lineHeight: 18 },
  connectedWalletBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12 },
  connectedWalletLabel: { color: '#2563EB', fontSize: 12, fontWeight: '900', marginBottom: 6 },
  connectedWalletAddress: { color: '#0F172A', fontSize: 14, fontWeight: '800' },
  emptyWalletAddress: { color: '#94A3B8' },
  signingHelpBox: { backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#BFDBFE', gap: 10 },
  signingHelpText: { color: '#1E40AF', fontSize: 13, fontWeight: '700', lineHeight: 19 },
  signingActions: { flexDirection: 'row', gap: 8 },
  openWalletButton: { flex: 1, backgroundColor: '#2563EB', padding: 11, borderRadius: 10, alignItems: 'center' },
  openWalletButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  reconnectButton: { flex: 1, backgroundColor: '#FFFFFF', padding: 11, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#CBD5E1' },
  reconnectButtonText: { color: '#64748B', fontSize: 13, fontWeight: '900' },
  walletMessageBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, padding: 12 },
  walletMessageLabel: { color: '#2563EB', fontSize: 12, fontWeight: '900', marginBottom: 6 },
  walletMessageText: { color: '#334155', fontSize: 12, lineHeight: 18 },
  walletStatusBox: { backgroundColor: '#EFF6FF', borderRadius: 12, padding: 11, borderWidth: 1, borderColor: '#BFDBFE' },
  walletStatusText: { color: '#1D4ED8', fontSize: 13, fontWeight: '900' },
  primaryButton: { backgroundColor: '#2563EB', padding: 17, borderRadius: 14, alignItems: 'center', marginTop: 6 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  secondaryAction: { borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', padding: 15, borderRadius: 14, alignItems: 'center' },
  secondaryActionText: { color: '#0F172A', fontSize: 16, fontWeight: '900' },
  disabledButton: { opacity: 0.55 },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 28 },
  divider: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { paddingHorizontal: 15, color: '#94A3B8', fontWeight: '700' },
  walletButton: { borderWidth: 1, borderColor: '#2563EB', padding: 17, borderRadius: 14, alignItems: 'center' },
  walletButtonText: { color: '#2563EB', fontSize: 16, fontWeight: '900' },
  switchButton: { marginTop: 28, alignItems: 'center' },
  switchButtonText: { color: '#64748B', fontSize: 14, fontWeight: '700' },
});
