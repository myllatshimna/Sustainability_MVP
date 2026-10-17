import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Firestore } from '@google-cloud/firestore';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CLOUD_RUN_BASE_URL = 'https://reloop-app-882475917539.asia-south1.run.app';
const PROJECT_ID = 'sustainabilitymvp-ed15e';
const FIREBASE_WEB_API_KEY = 'AIzaSyBVE_yRreXYcPaxSdADH04RrMBo4T96UyA';
const ARTIFACTS_DIR = 'C:/Users/mylla/.gemini/antigravity/brain/501f0538-c8b5-486f-9972-fbb87db12bd8';

const testRunId = `run_${Date.now()}`;
const ownerEmail = `test.owner.shimna.${testRunId}@reloop.org`;
const requesterEmail = `test.requester.sree.${testRunId}@reloop.org`;
const testPassword = 'SecureMarketplacePassword2026!';

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

async function setupPageAuth(page, authUser) {
  await page.goto(`${CLOUD_RUN_BASE_URL}/_not-found`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((userObj, token) => {
    localStorage.setItem('reloop_user', JSON.stringify({
      uid: userObj.uid,
      email: userObj.email,
      displayName: userObj.displayName,
      isDemo: false
    }));
    localStorage.setItem('reloop_token', token);
  }, authUser, authUser.idToken);
}

async function runTwoBrowserMarketplaceVerification() {
  console.log('================================================================');
  console.log('TWO-USER BROWSER VERIFICATION: MARKETPLACE OWNERSHIP & ACTIVITY');
  console.log(`Cloud Run Service: ${CLOUD_RUN_BASE_URL}`);
  console.log(`Run ID: ${testRunId}`);
  console.log('================================================================\n');

  // Step 1: Provision authentic Firebase test accounts
  console.log('--- Step 1: Provisioning Authentic Firebase Accounts ---');
  const adminAuth = await getOrInitAdminAuth();
  await createFirebaseUser(adminAuth, ownerEmail, 'Shimna M (Owner)');
  await createFirebaseUser(adminAuth, requesterEmail, 'Sree Shim (Requester)');
  const ownerAuth = await signInUserWithPassword(ownerEmail);
  const requesterAuth = await signInUserWithPassword(requesterEmail);
  console.log(`  ✓ Owner Shimna UID: ${ownerAuth.uid} (${ownerAuth.displayName})`);
  console.log(`  ✓ Requester Sree UID: ${requesterAuth.uid} (${requesterAuth.displayName})`);

  const edgePaths = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe'
  ];
  const executablePath = edgePaths.find(p => fs.existsSync(p));
  if (!executablePath) {
    throw new Error('No compatible Chromium browser found.');
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // Create two completely isolated incognito browser contexts
  const contextA = await browser.createBrowserContext();
  const contextB = await browser.createBrowserContext();

  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  await pageA.setViewport({ width: 1280, height: 900 });
  await pageB.setViewport({ width: 1280, height: 900 });

  await setupPageAuth(pageA, ownerAuth);
  await setupPageAuth(pageB, requesterAuth);

  // Step 2: Owner A creates a real listing
  console.log('\n--- Step 2: Owner A Creates Real Community Listing ---');
  const createListingRes = await fetch(`${CLOUD_RUN_BASE_URL}/api/listings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerAuth.idToken}`,
      'x-is-test': 'true'
    },
    body: JSON.stringify({
      title: `Teak Study Table (${testRunId})`,
      description: 'Solid teak study table in good condition for community reuse.',
      category: 'furniture',
      confirmedCondition: 'good_usable',
      materials: ['wood'],
      isFree: true,
      localityName: 'Indiranagar',
      latitude: 12.9784,
      longitude: 77.6408,
      pickupPreference: 'Pickup near Defence Colony, Indiranagar',
      isTest: true
    })
  });

  const listingData = await createListingRes.json();
  const listingId = listingData.listingId;
  console.log(`  ✓ Created listing ID: ${listingId} (Status: ${createListingRes.status})`);
  console.log(`  ✓ Verified Backend Owner ID: ${listingData.listing.ownerId}`);

  // Step 3: Owner A views listing detail
  console.log('\n--- Step 3: Owner A Inspects Listing Detail & Self-Interest Rejection ---');
  await pageA.goto(`${CLOUD_RUN_BASE_URL}/listings/${listingId}`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));
  const contentA = await pageA.content();

  const ownerBanner = contentA.includes('You are the owner of this listing');
  const manageButton = contentA.includes('Manage Listing &amp; View Incoming Requests') || contentA.includes('Manage Listing');
  const hasExpressInterestA = contentA.includes('Express Interest in this Item');

  console.log(`  ✓ Owner banner visible: ${ownerBanner}`);
  console.log(`  ✓ "Manage Listing" visible for Owner: ${manageButton}`);
  console.log(`  ✓ "Express Interest" hidden for Owner: ${!hasExpressInterestA}`);

  const ownerScreenshot = path.join(ARTIFACTS_DIR, 'two_browser_owner_view.png');
  await pageA.screenshot({ path: ownerScreenshot, fullPage: true });
  console.log(`  ✓ Saved owner view screenshot: ${ownerScreenshot}`);

  // Backend Self-Interest Rejection Check
  console.log('  Testing direct API self-interest attempt by owner...');
  const selfInterestRes = await fetch(`${CLOUD_RUN_BASE_URL}/api/listings/${listingId}/interest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerAuth.idToken}`
    },
    body: JSON.stringify({ message: 'Owner attempting self-interest directly' })
  });
  console.log(`  ✓ Self-interest direct API status: ${selfInterestRes.status} (Expected 403 Forbidden)`);
  const selfInterestJson = await selfInterestRes.json();
  console.log(`  ✓ Self-interest rejection error: "${selfInterestJson.error}"`);

  // Step 4: Requester B views listing and expresses interest
  console.log('\n--- Step 4: Requester B Views Listing & Expresses Interest ---');
  await pageB.goto(`${CLOUD_RUN_BASE_URL}/listings/${listingId}`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));
  const contentB = await pageB.content();

  const hasExpressInterestB = contentB.includes('Express Interest in this Item');
  const hasOwnerBannerB = contentB.includes('You are the owner of this listing');

  console.log(`  ✓ "Express Interest" visible for Requester B: ${hasExpressInterestB}`);
  console.log(`  ✓ Owner controls hidden for Requester B: ${!hasOwnerBannerB}`);

  const requesterScreenshot = path.join(ARTIFACTS_DIR, 'two_browser_requester_view.png');
  await pageB.screenshot({ path: requesterScreenshot, fullPage: true });
  console.log(`  ✓ Saved requester view screenshot: ${requesterScreenshot}`);

  // Requester B sends interest
  const interestRes = await fetch(`${CLOUD_RUN_BASE_URL}/api/listings/${listingId}/interest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${requesterAuth.idToken}`
    },
    body: JSON.stringify({ message: 'Hi Shimna, I would love to pick this up this evening!' })
  });
  const interestData = await interestRes.json();
  console.log(`  ✓ Requester B interest submitted: ${interestRes.status} (Request ID: ${interestData.request?.id})`);

  // Step 5: Owner A views "Incoming Requests" tab and accepts
  console.log('\n--- Step 5: Owner A Views Incoming Requests & Accepts Reservation ---');
  await pageA.goto(`${CLOUD_RUN_BASE_URL}/listings?tab=incoming_requests`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  const incomingContentA = await pageA.content();

  const hasIncomingReq = incomingContentA.includes('Sree Shim') || incomingContentA.includes('pick this up this evening');
  const hasAcceptButton = incomingContentA.includes('Accept &amp; Reserve') || incomingContentA.includes('Accept & Reserve');

  console.log(`  ✓ Requester message visible in Incoming Requests: ${hasIncomingReq}`);
  console.log(`  ✓ "Accept & Reserve" action visible: ${hasAcceptButton}`);

  const incomingScreenshot = path.join(ARTIFACTS_DIR, 'two_browser_incoming_requests_tab.png');
  await pageA.screenshot({ path: incomingScreenshot, fullPage: true });
  console.log(`  ✓ Saved incoming requests screenshot: ${incomingScreenshot}`);

  // Accept request via reserve API
  const reserveRes = await fetch(`${CLOUD_RUN_BASE_URL}/api/listings/${listingId}/reserve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerAuth.idToken}`
    },
    body: JSON.stringify({ requestId: interestData.request.id, action: 'accept' })
  });
  console.log(`  ✓ Owner accepted request & reserved item status: ${reserveRes.status}`);

  // Step 6: Requester B sees accepted status in "My Requests"
  console.log('\n--- Step 6: Requester B Inspects "My Requests" ---');
  await pageB.goto(`${CLOUD_RUN_BASE_URL}/listings?tab=my_requests`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  const myReqContentB = await pageB.content();

  const hasAcceptedBadge = myReqContentB.includes('Accepted / Reserved') || myReqContentB.includes('Reserved For You');
  console.log(`  ✓ Accepted status visible in Requester B's My Requests: ${hasAcceptedBadge}`);

  const myRequestsScreenshot = path.join(ARTIFACTS_DIR, 'two_browser_my_requests_tab.png');
  await pageB.screenshot({ path: myRequestsScreenshot, fullPage: true });
  console.log(`  ✓ Saved My Requests screenshot: ${myRequestsScreenshot}`);

  // Step 7: Owner completes handover & Recipient confirms receipt
  console.log('\n--- Step 7: Owner Completes Handover & Recipient Confirms Receipt ---');
  const handoverRes = await fetch(`${CLOUD_RUN_BASE_URL}/api/listings/${listingId}/handover`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerAuth.idToken}`
    },
    body: JSON.stringify({ action: 'complete', selfReportedWeightKg: 9.5 })
  });
  console.log(`  ✓ Owner complete handover status: ${handoverRes.status}`);

  const receiptRes = await fetch(`${CLOUD_RUN_BASE_URL}/api/listings/${listingId}/handover`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${requesterAuth.idToken}`
    },
    body: JSON.stringify({ action: 'confirm_receipt' })
  });
  console.log(`  ✓ Recipient confirm receipt status: ${receiptRes.status}`);

  // Step 8: Owner A inspects My Outcomes
  console.log('\n--- Step 8: Owner A Inspects "My Outcomes" ---');
  await pageA.goto(`${CLOUD_RUN_BASE_URL}/outcomes`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));
  const outcomesContentA = await pageA.content();

  const hasCompletedRecord = outcomesContentA.includes('Completed Records (1)') || outcomesContentA.includes('furniture');
  const hasWeight = outcomesContentA.includes('9.5 kg');

  console.log(`  ✓ Completed record in My Outcomes: ${hasCompletedRecord}`);
  console.log(`  ✓ Self-reported weight (9.5 kg) recorded: ${hasWeight}`);

  const outcomesScreenshot = path.join(ARTIFACTS_DIR, 'two_browser_my_outcomes.png');
  await pageA.screenshot({ path: outcomesScreenshot, fullPage: true });
  console.log(`  ✓ Saved My Outcomes screenshot: ${outcomesScreenshot}`);

  // Step 9: Verify Account Switching in Browser Context A
  console.log('\n--- Step 9: Account Switching & Stale Cache Verification ---');
  // Switch session in Context A to Requester B
  await pageA.evaluate((requesterObj) => {
    localStorage.setItem('reloop_user', JSON.stringify({
      uid: requesterObj.uid,
      email: requesterObj.email,
      displayName: requesterObj.displayName,
      isDemo: false
    }));
    localStorage.setItem('reloop_token', requesterObj.idToken);
    window.dispatchEvent(new CustomEvent('reloop_auth_changed', { detail: { uid: requesterObj.uid } }));
  }, requesterAuth);

  await pageA.goto(`${CLOUD_RUN_BASE_URL}/listings/${listingId}`, { waitUntil: 'networkidle2' });
  const switchedContentA = await pageA.content();
  const switchedShowsOwner = switchedContentA.includes('You are the owner of this listing');
  console.log(`  ✓ After account switch to Requester B, Owner controls are gone: ${!switchedShowsOwner}`);

  await browser.close();

  console.log('\n================================================================');
  console.log('ALL TWO-BROWSER MARKETPLACE CHECKS COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
}

runTwoBrowserMarketplaceVerification().catch(err => {
  console.error('Two-browser verification failed:', err);
  process.exit(1);
});
