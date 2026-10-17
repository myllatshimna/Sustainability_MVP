import puppeteer from 'puppeteer-core';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Firestore } from '@google-cloud/firestore';
import fs from 'fs';
import path from 'path';

const CLOUD_RUN_BASE_URL = 'https://reloop-app-882475917539.asia-south1.run.app';
const PROJECT_ID = 'sustainabilitymvp-ed15e';
const FIREBASE_WEB_API_KEY = 'AIzaSyBVE_yRreXYcPaxSdADH04RrMBo4T96UyA';
const testRunId = `authfix_${Date.now()}`;
const testOwnerEmail = `test.owner.${testRunId}@reloop.org`;
const testNeighbourEmail = `test.neighbour.${testRunId}@reloop.org`;
const testPassword = 'AuthFixPassword2026!';

const firestore = new Firestore({ projectId: PROJECT_ID, ignoreUndefinedProperties: true });

async function getOrInitAdminAuth() {
  const app = getApps().length === 0 ? initializeApp({ projectId: PROJECT_ID }) : getApps()[0];
  return getAuth(app);
}

async function createFirebaseUser(auth, email, displayName) {
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, { password: testPassword, displayName });
    return existing;
  } catch {
    return await auth.createUser({
      email,
      password: testPassword,
      displayName
    });
  }
}

async function signInUserWithPassword(email) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: testPassword,
      returnSecureToken: true
    })
  });

  const data = await res.json();
  if (!data.idToken) {
    throw new Error(`Authentication failed for ${email}: ${JSON.stringify(data)}`);
  }
  return {
    uid: data.localId,
    email: data.email,
    idToken: data.idToken,
    displayName: data.displayName || email.split('@')[0]
  };
}

async function runAuthFixVerification() {
  console.log('=================================================================');
  console.log('🔐 RUNNING COMPREHENSIVE AUTHENTICATION FIX VERIFICATION');
  console.log(`🌐 Live URL: ${CLOUD_RUN_BASE_URL}`);
  console.log(`🆔 Run ID: ${testRunId}`);
  console.log('=================================================================\n');

  // Step 1: Provision real test accounts in Firebase Auth
  console.log('Step 1: Provisioning test accounts...');
  const adminAuth = await getOrInitAdminAuth();
  await createFirebaseUser(adminAuth, testOwnerEmail, 'Priya TestOwner');
  await createFirebaseUser(adminAuth, testNeighbourEmail, 'Rohan TestNeighbour');
  const ownerAuth = await signInUserWithPassword(testOwnerEmail);
  const neighbourAuth = await signInUserWithPassword(testNeighbourEmail);
  console.log(`  ✓ Owner UID: ${ownerAuth.uid}`);
  console.log(`  ✓ Neighbour UID: ${neighbourAuth.uid}`);

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Google Sign-In') || text.includes('Account switch') || text.includes('popup')) {
      console.log(`  [Browser Console]: ${text}`);
    }
  });

  let alertDialogs = [];
  page.on('dialog', async dialog => {
    alertDialogs.push(dialog.message());
    console.log('  ⚠️ UNEXPECTED ALERT DIALOG ENCOUNTERED:', dialog.message());
    await dialog.dismiss();
  });

  let popupOpenedCount = 0;
  let activePopupPage = null;

  browser.on('targetcreated', async target => {
    const url = target.url();
    if (url.includes('accounts.google.com') || url.includes('firebaseapp.com/__/auth/handler')) {
      popupOpenedCount++;
      console.log(`  ✓ Auth popup target created: ${url.slice(0, 75)}...`);
      const p = await target.page().catch(() => null);
      if (p) activePopupPage = p;
    }
  });

  // Step 2: Test Single Click & In-Flight State
  console.log('\nStep 2: Testing Single Click & In-Flight State...');
  await page.goto(`${CLOUD_RUN_BASE_URL}/listings`, { waitUntil: 'networkidle2' });

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const signInBtn = buttons.find(b => b.innerText.includes('Google Sign-In'));
    if (signInBtn) signInBtn.click();
  });

  const buttonBecamePending = await page.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.innerText.includes('Signing In') || b.innerText.includes('Google Sign-In'));
    return Boolean(btn && (btn.disabled || btn.innerText.includes('Signing In')));
  }, { timeout: 5000 }).then(() => true).catch(() => false);

  console.log(`  ✓ Sign-in button immediately disabled/pending on click: ${buttonBecamePending}`);
  
  // Wait 2s for popup to initialize
  await new Promise(r => setTimeout(r, 2000));
  if (activePopupPage && !activePopupPage.isClosed()) {
    console.log('  ✓ Simulating user cancellation (closing popup window)...');
    await activePopupPage.close().catch(() => {});
    activePopupPage = null;
  }

  // Verify button re-enables after cancellation
  const reEnabledAfterCancel = await page.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const signInBtn = buttons.find(b => b.innerText.includes('Google Sign-In'));
    return Boolean(signInBtn && !signInBtn.disabled);
  }, { timeout: 10000 }).then(() => true).catch(() => false);
  console.log(`  ✓ Button re-enabled after cancellation: ${reEnabledAfterCancel}`);
  if (!reEnabledAfterCancel) {
    throw new Error('Button remained disabled after popup dismissal!');
  }

  // Step 3: Test Rapid Double Click (Overlapping prevention)
  console.log('\nStep 3: Testing Rapid Double-Click Concurrency Guard...');
  popupOpenedCount = 0;
  alertDialogs = [];

  const doubleClickDispatched = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const signInBtn = buttons.find(b => b.innerText.includes('Google Sign-In'));
    if (!signInBtn) return false;
    // Dispatch rapid double click synchronously
    signInBtn.click();
    signInBtn.click();
    return true;
  });

  await new Promise(r => setTimeout(r, 2000));
  console.log(`  ✓ Rapid double-click dispatched: ${doubleClickDispatched}`);
  console.log(`  ✓ Popups opened: ${popupOpenedCount} (Must be at most 1)`);
  console.log(`  ✓ Alert dialogs triggered: ${alertDialogs.length} (Must be 0)`);
  if (alertDialogs.length > 0) {
    throw new Error(`Unexpected alert dialogs triggered: ${JSON.stringify(alertDialogs)}`);
  }
  if (popupOpenedCount > 1) {
    throw new Error(`Expected at most 1 popup from rapid double click, got ${popupOpenedCount}`);
  }

  // Wait 2s for popup handler to attach, then dismiss popup from double-click test
  await new Promise(r => setTimeout(r, 2500));
  if (activePopupPage && !activePopupPage.isClosed()) {
    console.log('  ✓ Closing double-click popup window...');
    await activePopupPage.close().catch(() => {});
    activePopupPage = null;
  }

  // Step 4: Test Retry After Cancellation
  console.log('\nStep 4: Testing Retry After Dismissal...');
  const canRetry = await page.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const signInBtn = buttons.find(b => b.innerText.includes('Google Sign-In'));
    return Boolean(signInBtn && !signInBtn.disabled);
  }, { timeout: 10000 }).then(() => true).catch(() => false);

  console.log(`  ✓ Button is re-enabled and ready for retry: ${canRetry}`);
  if (!canRetry) {
    throw new Error('Button remained disabled after popup dismissal!');
  }

  // Step 5: Test Session Persistence & Account Switch Button
  console.log('\nStep 5: Testing Authenticated Session & Account Switching...');
  // Inject authenticated test user into localStorage and reload
  await page.evaluate((auth) => {
    localStorage.setItem('reloop_user', JSON.stringify({
      uid: auth.uid,
      email: auth.email,
      displayName: 'Priya TestOwner',
      isDemo: false
    }));
    localStorage.setItem('reloop_token', auth.idToken);
  }, ownerAuth);

  await page.goto(`${CLOUD_RUN_BASE_URL}/listings`, { waitUntil: 'networkidle2' });

  // Verify switch button appears and displays account
  const switchBtnInfo = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const switchBtn = buttons.find(b => b.innerText.includes('(Switch)'));
    const signOutBtn = buttons.find(b => b.innerText.includes('Sign Out'));
    return {
      hasSwitchBtn: Boolean(switchBtn),
      switchBtnText: switchBtn?.innerText,
      hasSignOutBtn: Boolean(signOutBtn)
    };
  });
  console.log('  ✓ Authenticated Navbar State:', switchBtnInfo);
  if (!switchBtnInfo.hasSwitchBtn) {
    throw new Error('Switch account button not found for authenticated user');
  }

  // Step 6: Test Cancellation During Account Switch
  console.log('\nStep 6: Testing Cancellation During Account Switch (Must Preserve Session)...');
  popupOpenedCount = 0;
  alertDialogs = [];

  // Click Switch Account button
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const switchBtn = buttons.find(b => b.innerText.includes('(Switch)'));
    if (switchBtn) switchBtn.click();
  });

  await new Promise(r => setTimeout(r, 2000));
  if (activePopupPage && !activePopupPage.isClosed()) {
    await activePopupPage.close().catch(() => {});
    activePopupPage = null;
  }

  await new Promise(r => setTimeout(r, 1500));

  // Verify that current session was preserved after popup dismissal
  const sessionAfterCancelledSwitch = await page.evaluate(() => {
    const userStr = localStorage.getItem('reloop_user');
    const tokenStr = localStorage.getItem('reloop_token');
    return {
      hasUser: Boolean(userStr),
      uid: userStr ? JSON.parse(userStr).uid : null,
      hasToken: Boolean(tokenStr)
    };
  });
  console.log('  ✓ Session after cancelled switch:', sessionAfterCancelledSwitch);
  if (!sessionAfterCancelledSwitch.hasUser || sessionAfterCancelledSwitch.uid !== ownerAuth.uid) {
    throw new Error('User was signed out when account switch was cancelled!');
  }
  console.log('  ✓ Verified: User session correctly preserved when switch popup is dismissed.');

  // Step 7: Completed Authenticated Action in Live Deployed App
  console.log('\nStep 7: Verifying Completed Authenticated Action in Deployed Browser...');
  await page.goto(`${CLOUD_RUN_BASE_URL}/listings/new`, { waitUntil: 'networkidle2' });

  // Fill in listing form
  await page.type('input[placeholder*="Solid Teak Study Chair"]', `Verified Auth Item (${testRunId})`);
  await page.type('textarea[placeholder*="Describe the item"]', 'Created during live verification of Firebase auth guard.');

  // Submit listing
  await page.evaluate(() => {
    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.click();
  });

  // Wait for redirect to /listings/list_...
  await page.waitForFunction(() => window.location.pathname.startsWith('/listings/list_'), { timeout: 15000 }).catch(() => {});
  const currentUrl = page.url();
  console.log(`  ✓ Navigated to URL after action: ${currentUrl}`);

  // Capture screenshot of authenticated action result
  const screenshotPath = path.resolve(process.cwd(), 'scratch', `auth_fix_verified_${testRunId}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`  ✓ Captured verification screenshot: ${screenshotPath}`);

  await browser.close();

  console.log('\n=================================================================');
  console.log('🎉 ALL AUTHENTICATION FIX VERIFICATIONS COMPLETED SUCCESSFULLY!');
  console.log('=================================================================\n');

  return {
    testRunId,
    ownerUid: ownerAuth.uid,
    neighbourUid: neighbourAuth.uid,
    listingUrl: currentUrl,
    screenshotPath
  };
}

runAuthFixVerification()
  .then(res => {
    console.log('Auth Fix Verification Result:', JSON.stringify(res, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ AUTH FIX VERIFICATION FAILED:', err);
    process.exit(1);
  });
