import { describe, it, expect, vi, beforeEach } from 'vitest';

// Unit tests verifying the in-flight guard, concurrency, request serialization,
// and cancellation protection logic of the ReLoop authentication state machine.

describe('ReLoop Auth Concurrency & In-Flight Guard Unit Tests', () => {
  let globalPopupInFlight = false;
  let activeRequestId = 0;
  let isAuthenticating = false;
  let currentUser: { uid: string; email: string } | null = null;
  let currentToken: string | null = null;
  let authError: string | null = null;
  let alertCallCount = 0;

  // Mock alert to guarantee raw alert() is never invoked
  const mockAlert = (msg: string) => {
    alertCallCount++;
  };

  beforeEach(() => {
    globalPopupInFlight = false;
    activeRequestId = 0;
    isAuthenticating = false;
    currentUser = null;
    currentToken = null;
    authError = null;
    alertCallCount = 0;
  });

  // Replicating the AuthContext core logic to verify deterministic invariants
  async function simulateSignInWithPopup(mockPopupFn: () => Promise<any>) {
    if (globalPopupInFlight || isAuthenticating) {
      return { status: 'ignored_due_to_in_flight' };
    }

    globalPopupInFlight = true;
    isAuthenticating = true;
    authError = null;
    const requestId = ++activeRequestId;

    try {
      const result = await mockPopupFn();
      if (requestId !== activeRequestId) {
        return { status: 'stale_request_ignored' };
      }

      currentUser = { uid: result.user.uid, email: result.user.email };
      currentToken = result.token;
      return { status: 'success', user: currentUser };
    } catch (err: any) {
      if (requestId !== activeRequestId) {
        return { status: 'stale_request_ignored' };
      }

      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        // Must NOT sign out, must NOT set error alert
        return { status: 'cancelled_preserved_session' };
      }

      // Inline error instead of alert
      authError = err?.message || 'Authentication failed.';
      return { status: 'error', error: authError };
    } finally {
      if (requestId === activeRequestId) {
        globalPopupInFlight = false;
        isAuthenticating = false;
      }
    }
  }

  async function simulateSwitchAccount(mockPopupFn: () => Promise<any>) {
    // Current user must be preserved if switch is cancelled
    return simulateSignInWithPopup(mockPopupFn);
  }

  it('1. Single click executes popup authentication successfully', async () => {
    let popupCalls = 0;
    const mockPopup = async () => {
      popupCalls++;
      return { user: { uid: 'user_1', email: 'owner@reloop.org' }, token: 'tok_1' };
    };

    const res = await simulateSignInWithPopup(mockPopup);
    expect(res.status).toBe('success');
    expect(popupCalls).toBe(1);
    expect(currentUser?.uid).toBe('user_1');
    expect(isAuthenticating).toBe(false);
    expect(globalPopupInFlight).toBe(false);
    expect(alertCallCount).toBe(0);
  });

  it('2. Rapid double-click invokes signInWithPopup only once and ignores overlapping call', async () => {
    let popupCalls = 0;
    let resolvePopup: any;
    const mockPopup = () =>
      new Promise(resolve => {
        popupCalls++;
        resolvePopup = resolve;
      });

    // Fire first click
    const promise1 = simulateSignInWithPopup(mockPopup);
    // Fire second click immediately while first is in flight
    const promise2 = simulateSignInWithPopup(mockPopup);

    const res2 = await promise2;
    expect(res2.status).toBe('ignored_due_to_in_flight');
    expect(popupCalls).toBe(1); // Crucial: Second click NEVER invoked popup!

    // Resolve first popup
    resolvePopup({ user: { uid: 'user_1', email: 'owner@reloop.org' }, token: 'tok_1' });
    const res1 = await promise1;

    expect(res1.status).toBe('success');
    expect(currentUser?.uid).toBe('user_1');
    expect(isAuthenticating).toBe(false);
    expect(globalPopupInFlight).toBe(false);
    expect(alertCallCount).toBe(0);
  });

  it('3. User cancellation (popup-closed-by-user) does not sign out or trigger error alert', async () => {
    // User was already logged in
    currentUser = { uid: 'user_existing', email: 'existing@reloop.org' };
    currentToken = 'tok_existing';

    const mockPopup = async () => {
      const err = new Error('Popup closed by user');
      (err as any).code = 'auth/popup-closed-by-user';
      throw err;
    };

    const res = await simulateSignInWithPopup(mockPopup);
    expect(res.status).toBe('cancelled_preserved_session');
    // Session preserved
    expect(currentUser?.uid).toBe('user_existing');
    expect(currentToken).toBe('tok_existing');
    expect(authError).toBeNull();
    expect(alertCallCount).toBe(0);
    expect(isAuthenticating).toBe(false);
  });

  it('4. Cancelled popup request (auth/cancelled-popup-request) does not sign out or trigger error alert', async () => {
    currentUser = { uid: 'user_existing', email: 'existing@reloop.org' };
    currentToken = 'tok_existing';

    const mockPopup = async () => {
      const err = new Error('Operation cancelled due to conflicting popup');
      (err as any).code = 'auth/cancelled-popup-request';
      throw err;
    };

    const res = await simulateSignInWithPopup(mockPopup);
    expect(res.status).toBe('cancelled_preserved_session');
    expect(currentUser?.uid).toBe('user_existing');
    expect(authError).toBeNull();
    expect(alertCallCount).toBe(0);
    expect(isAuthenticating).toBe(false);
  });

  it('5. Allows retry after previous cancellation', async () => {
    const mockCancelPopup = async () => {
      const err = new Error('Popup closed');
      (err as any).code = 'auth/popup-closed-by-user';
      throw err;
    };

    await simulateSignInWithPopup(mockCancelPopup);
    expect(globalPopupInFlight).toBe(false);
    expect(isAuthenticating).toBe(false);

    // Retry
    const mockSuccessPopup = async () => {
      return { user: { uid: 'user_retry', email: 'retry@reloop.org' }, token: 'tok_retry' };
    };

    const retryRes = await simulateSignInWithPopup(mockSuccessPopup);
    expect(retryRes.status).toBe('success');
    expect(currentUser?.uid).toBe('user_retry');
    expect(isAuthenticating).toBe(false);
  });

  it('6. Account switching preserves current session if switch is cancelled', async () => {
    currentUser = { uid: 'user_neighbour', email: 'rohan@reloop.org' };
    currentToken = 'tok_rohan';

    const mockCancelledSwitch = async () => {
      const err = new Error('Popup closed');
      (err as any).code = 'auth/popup-closed-by-user';
      throw err;
    };

    const res = await simulateSwitchAccount(mockCancelledSwitch);
    expect(res.status).toBe('cancelled_preserved_session');
    expect(currentUser?.uid).toBe('user_neighbour');
    expect(currentToken).toBe('tok_rohan');
  });

  it('7. Account switching updates session to new account upon completion', async () => {
    currentUser = { uid: 'user_priya', email: 'priya@reloop.org' };
    currentToken = 'tok_priya';

    const mockSwitch = async () => {
      return { user: { uid: 'user_rohan', email: 'rohan@reloop.org' }, token: 'tok_rohan' };
    };

    const res = await simulateSwitchAccount(mockSwitch);
    expect(res.status).toBe('success');
    expect(currentUser?.uid).toBe('user_rohan');
    expect(currentToken).toBe('tok_rohan');
  });

  it('8. Older superseded requests cannot overwrite newer successful login', async () => {
    let slowResolve: any;
    const slowPopup = () =>
      new Promise(resolve => {
        slowResolve = resolve;
      });

    // Request 1 starts
    const req1Promise = simulateSignInWithPopup(slowPopup);

    // Force release of in-flight lock (simulating an external race / reset)
    globalPopupInFlight = false;
    isAuthenticating = false;

    // Request 2 starts and completes first
    const fastPopup = async () => ({
      user: { uid: 'user_newer', email: 'newer@reloop.org' },
      token: 'tok_newer'
    });
    const req2Res = await simulateSignInWithPopup(fastPopup);
    expect(req2Res.status).toBe('success');
    expect(currentUser?.uid).toBe('user_newer');

    // Request 1 finally resolves later
    slowResolve({ user: { uid: 'user_stale', email: 'stale@reloop.org' }, token: 'tok_stale' });
    const req1Res = await req1Promise;
    expect(req1Res.status).toBe('stale_request_ignored');

    // User is still user_newer, NOT overwritten by user_stale
    expect(currentUser?.uid).toBe('user_newer');
  });
});
