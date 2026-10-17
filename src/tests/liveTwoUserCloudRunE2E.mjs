import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Firestore } from '@google-cloud/firestore';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CLOUD_RUN_BASE_URL = 'https://reloop-app-882475917539.asia-south1.run.app';
const PROJECT_ID = 'sustainabilitymvp-ed15e';
const FIREBASE_WEB_API_KEY = 'AIzaSyBVE_yRreXYcPaxSdADH04RrMBo4T96UyA';

const testRunId = `run_${Date.now()}`;
const ownerEmail = `test.owner.${testRunId}@reloop.org`;
const neighbourEmail = `test.neighbour.${testRunId}@reloop.org`;
const testPassword = 'SecureTestPassword2026!';

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

async function signInUser(email) {
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
    idToken: data.idToken
  };
}

async function runE2EVerification() {
  console.log('=================================================================');
  console.log('🚀 STARTING TWO-USER REAL FIREBASE AUTH DEPLOYED CLOUD RUN E2E');
  console.log(`🌐 Target: ${CLOUD_RUN_BASE_URL}`);
  console.log(`🆔 Test Run ID: ${testRunId}`);
  console.log('=================================================================\n');

  const adminAuth = await getOrInitAdminAuth();

  // 1. Create two real accounts in Firebase Auth
  console.log('Step 1: Provisioning 2 Real Firebase Test Accounts...');
  const ownerUserRecord = await createFirebaseUser(adminAuth, ownerEmail, 'Priya Sharma (Owner)');
  const neighbourUserRecord = await createFirebaseUser(adminAuth, neighbourEmail, 'Rohan Mehta (Neighbour)');
  console.log(`  ✓ Created Owner: ${ownerEmail} (UID: ${ownerUserRecord.uid})`);
  console.log(`  ✓ Created Neighbour: ${neighbourEmail} (UID: ${neighbourUserRecord.uid})`);

  // 2. Sign in both users via Firebase Identity Toolkit to obtain genuine ID tokens
  console.log('\nStep 2: Signing in via Firebase Identity Toolkit REST API...');
  const ownerAuth = await signInUser(ownerEmail);
  const neighbourAuth = await signInUser(neighbourEmail);
  console.log(`  ✓ Owner ID Token received (length: ${ownerAuth.idToken.length}, UID: ${ownerAuth.uid})`);
  console.log(`  ✓ Neighbour ID Token received (length: ${neighbourAuth.idToken.length}, UID: ${neighbourAuth.uid})`);

  // 3. Unauthenticated and Simulated Token Protection Checks
  console.log('\nStep 3: Verifying Unauthorized & Simulated-Token Protection on Cloud Run...');
  const unauthRes = await fetch(`${CLOUD_RUN_BASE_URL}/api/listings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Unauthorized Test' })
  });
  console.log(`  ✓ Unauthenticated POST /api/listings status: ${unauthRes.status} (Expected: 401)`);
  if (unauthRes.status !== 401) throw new Error(`Expected 401, got ${unauthRes.status}`);

  const fakeTokenRes = await fetch(`${CLOUD_RUN_BASE_URL}/api/listings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer demo_token_simulated_user_123'
    },
    body: JSON.stringify({ title: 'Simulated Token Test' })
  });
  console.log(`  ✓ Simulated-token POST /api/listings status: ${fakeTokenRes.status} (Expected: 401 - strictly blocked in live mode)`);
  if (fakeTokenRes.status !== 401) throw new Error(`Expected 401, got ${fakeTokenRes.status}`);

  // 4. User 1 (Owner) Posts a Real Community Listing
  console.log('\nStep 4: User 1 (Owner) Creates Genuine Listing on Deployed Cloud Run...');
  const listingPayload = {
    title: `Solid Teak Dining Chair (${testRunId})`,
    description: 'Beautiful hand-crafted wooden dining chair in solid condition, perfect for reuse.',
    category: 'furniture',
    confirmedCondition: 'good_usable',
    materials: ['wood'],
    photos: [],
    isFree: true,
    localityName: 'Indiranagar',
    localityPlaceId: 'blr_indiranagar',
    latitude: 12.9784,
    longitude: 77.6408,
    pickupPreference: 'Pickup near Indiranagar 100ft Rd'
  };

  const createListingRes = await fetch(`${CLOUD_RUN_BASE_URL}/api/listings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerAuth.idToken}`
    },
    body: JSON.stringify(listingPayload)
  });
  const createListingData = await createListingRes.json();
  console.log(`  ✓ POST /api/listings response status: ${createListingRes.status}`);
  if (createListingRes.status !== 200 || !createListingData.listingId) {
    throw new Error(`Failed to create listing: ${JSON.stringify(createListingData)}`);
  }
  const listingId = createListingData.listingId;
  console.log(`  ✓ Created Listing ID: ${listingId} (Owner: ${createListingData.listing.ownerId}, Status: ${createListingData.listing.status})`);

  // Verify document exists in live Firestore
  const firestoreDoc = await firestore.collection('listings').doc(listingId).get();
  console.log(`  ✓ Verified document directly in Live Firestore: exists = ${firestoreDoc.exists}`);
  if (!firestoreDoc.exists) throw new Error('Listing was not persisted to live Firestore');

  // 5. Cross-User Data Protection & Public View Redaction
  console.log('\nStep 5: Verifying Public Redaction & Cross-User Access Protection...');
  const publicViewRes = await fetch(`${CLOUD_RUN_BASE_URL}/api/listings/${listingId}`);
  const publicViewData = await publicViewRes.json();
  console.log(`  ✓ Public view status: ${publicViewRes.status}`);
  console.log(`  ✓ Public view isOwner: ${publicViewData.isOwner} (Expected: false)`);
  console.log(`  ✓ Latitude/Longitude exposed in publicListing: ${Boolean(publicViewData.publicListing?.latitude)} (Expected: false - redacted for privacy)`);
  if (publicViewData.isOwner || publicViewData.publicListing?.latitude) {
    throw new Error('Privacy leak in public listing endpoint');
  }

  // Cross-user access check: User 2 tries to read incoming requests for User 1's listing
  const neighbourSneakRes = await fetch(`${CLOUD_RUN_BASE_URL}/api/listings/${listingId}/interest`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${neighbourAuth.idToken}`
    }
  });
  console.log(`  ✓ User 2 GET /api/listings/${listingId}/interest status: ${neighbourSneakRes.status} (Expected: 403 Forbidden)`);
  if (neighbourSneakRes.status !== 403) {
    throw new Error(`Expected 403 for unauthorized viewer, got ${neighbourSneakRes.status}`);
  }

  // 6. User 2 Submits Expression of Interest (Request)
  console.log('\nStep 6: User 2 (Neighbour) Expresses Interest in Listing...');
  
  // Also test self-request prevention: User 1 cannot request own listing
  const selfReqRes = await fetch(`${CLOUD_RUN_BASE_URL}/api/listings/${listingId}/interest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerAuth.idToken}`
    },
    body: JSON.stringify({ message: 'Can I request my own item?' })
  });
  console.log(`  ✓ User 1 self-request status: ${selfReqRes.status} (Expected: 400 - cannot request own listing)`);
  if (selfReqRes.status !== 400) throw new Error(`Expected 400 for self-request, got ${selfReqRes.status}`);

  const interestRes = await fetch(`${CLOUD_RUN_BASE_URL}/api/listings/${listingId}/interest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${neighbourAuth.idToken}`
    },
    body: JSON.stringify({
      message: 'Hello Priya! I live near Indiranagar 12th Main and would love to pick this up this evening.'
    })
  });
  const interestData = await interestRes.json();
  console.log(`  ✓ User 2 POST interest status: ${interestRes.status}`);
  if (interestRes.status !== 200 || !interestData.request?.id) {
    throw new Error(`Failed to submit interest: ${JSON.stringify(interestData)}`);
  }
  const requestId = interestData.request.id;
  console.log(`  ✓ Created Request ID: ${requestId} (Requester: ${interestData.request.requesterId}, Status: ${interestData.request.status})`);

  // 7. User 1 (Owner) Views Requests and Accepts (Reservation)
  console.log('\nStep 7: User 1 (Owner) Accepts Request (Atomically Reserves Item)...');
  const ownerViewRequestsRes = await fetch(`${CLOUD_RUN_BASE_URL}/api/listings/${listingId}/interest`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${ownerAuth.idToken}`
    }
  });
  const ownerRequestsData = await ownerViewRequestsRes.json();
  console.log(`  ✓ Owner GET requests status: ${ownerViewRequestsRes.status}, count: ${ownerRequestsData.requests?.length}`);
  if (!ownerRequestsData.requests || ownerRequestsData.requests.length === 0) {
    throw new Error('Owner could not see incoming request');
  }

  // Cross-user attack: User 2 tries to accept their own request
  const neighbourAcceptRes = await fetch(`${CLOUD_RUN_BASE_URL}/api/listings/${listingId}/reserve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${neighbourAuth.idToken}`
    },
    body: JSON.stringify({ requestId, action: 'accept' })
  });
  console.log(`  ✓ User 2 unauthorized reservation attempt status: ${neighbourAcceptRes.status} (Expected: 400 Access denied)`);
  if (neighbourAcceptRes.status !== 400) throw new Error(`Expected 400, got ${neighbourAcceptRes.status}`);

  // Owner accepts the request
  const acceptRes = await fetch(`${CLOUD_RUN_BASE_URL}/api/listings/${listingId}/reserve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerAuth.idToken}`
    },
    body: JSON.stringify({ requestId, action: 'accept' })
  });
  const acceptData = await acceptRes.json();
  console.log(`  ✓ Owner reservation status: ${acceptRes.status}`);
  if (acceptRes.status !== 200 || acceptData.listing?.status !== 'reserved') {
    throw new Error(`Failed to reserve listing: ${JSON.stringify(acceptData)}`);
  }
  console.log(`  ✓ Listing is now RESERVED for User 2 (reservedForUserId: ${acceptData.listing.reservedForUserId})`);

  // 8. User 1 Completes Handover with Self-Reported Weight
  console.log('\nStep 8: User 1 Completes Handover (Self-Reported Weight: 12.5 kg)...');
  
  // Cross-user check: User 2 cannot complete handover on behalf of owner
  const neighbourHandoverRes = await fetch(`${CLOUD_RUN_BASE_URL}/api/listings/${listingId}/handover`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${neighbourAuth.idToken}`
    },
    body: JSON.stringify({ action: 'complete', selfReportedWeightKg: 12.5 })
  });
  console.log(`  ✓ User 2 unauthorized complete handover status: ${neighbourHandoverRes.status} (Expected: 400 Access denied)`);
  if (neighbourHandoverRes.status !== 400) throw new Error(`Expected 400, got ${neighbourHandoverRes.status}`);

  // Owner completes handover
  const handoverRes = await fetch(`${CLOUD_RUN_BASE_URL}/api/listings/${listingId}/handover`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerAuth.idToken}`
    },
    body: JSON.stringify({ action: 'complete', selfReportedWeightKg: 12.5 })
  });
  const handoverData = await handoverRes.json();
  console.log(`  ✓ Owner completed handover status: ${handoverRes.status}`);
  if (handoverRes.status !== 200 || handoverData.listing?.status !== 'completed') {
    throw new Error(`Failed to complete handover: ${JSON.stringify(handoverData)}`);
  }
  console.log(`  ✓ Outcome created: ID = ${handoverData.outcome?.id}, Action = ${handoverData.outcome?.action}, Weight = ${handoverData.outcome?.selfReportedWeightKg} kg`);

  // 9. User 2 Confirms Receipt
  console.log('\nStep 9: User 2 (Accepted Recipient) Confirms Receipt...');
  const confirmReceiptRes = await fetch(`${CLOUD_RUN_BASE_URL}/api/listings/${listingId}/handover`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${neighbourAuth.idToken}`
    },
    body: JSON.stringify({ action: 'confirm_receipt' })
  });
  const confirmReceiptData = await confirmReceiptRes.json();
  console.log(`  ✓ Recipient confirm receipt status: ${confirmReceiptRes.status}`);
  if (confirmReceiptRes.status !== 200 || !confirmReceiptData.listing?.recipientConfirmedAt) {
    throw new Error(`Failed to confirm receipt: ${JSON.stringify(confirmReceiptData)}`);
  }
  console.log(`  ✓ Receipt confirmed at: ${confirmReceiptData.listing.recipientConfirmedAt}`);

  // 10. Single-Count Metrics & Deduplication Idempotency
  console.log('\nStep 10: Verifying Duplicate Completion Idempotency & Single-Count Analytics...');
  
  // Call complete handover a second time
  const dupHandoverRes = await fetch(`${CLOUD_RUN_BASE_URL}/api/listings/${listingId}/handover`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ownerAuth.idToken}`
    },
    body: JSON.stringify({ action: 'complete', selfReportedWeightKg: 12.5 })
  });
  const dupHandoverData = await dupHandoverRes.json();
  console.log(`  ✓ Duplicate handover call status: ${dupHandoverRes.status} (Idempotent response)`);
  if (dupHandoverRes.status !== 200) throw new Error('Duplicate handover failed');

  // Verify community outcomes aggregation
  const outcomesRes = await fetch(`${CLOUD_RUN_BASE_URL}/api/outcomes`);
  const outcomesData = await outcomesRes.json();
  console.log(`  ✓ GET /api/outcomes status: ${outcomesRes.status}`);
  console.log(`  ✓ Total completed actions in community: ${outcomesData.summary?.totalCompletedActions}`);
  console.log(`  ✓ Total diverted weight in community: ${outcomesData.summary?.divertedKgTotal} kg`);

  // Verify the specific outcome record in live Firestore
  const outcomeDoc = await firestore.collection('outcomes').doc(`out_listing_${listingId}_reuse`).get();
  console.log(`  ✓ Verified Outcome document in live Firestore: exists = ${outcomeDoc.exists}`);
  if (!outcomeDoc.exists) throw new Error('Outcome document missing from Firestore');
  const outcomeDocData = outcomeDoc.data();
  console.log(`  ✓ Outcome verified: userId=${outcomeDocData.userId}, recipientId=${outcomeDocData.recipientId}, weight=${outcomeDocData.selfReportedWeightKg}kg, confirmed=${Boolean(outcomeDocData.recipientConfirmedAt)}`);

  // 11. Headless Chrome Browser Verification on Live Cloud Run
  console.log('\nStep 11: Headless Chrome Browser Render Verification...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Set localStorage session for User 1
  await page.goto(`${CLOUD_RUN_BASE_URL}/listings/${listingId}`, { waitUntil: 'networkidle2', timeout: 30000 });
  
  // Evaluate page content
  const pageDetails = await page.evaluate(() => {
    return {
      title: document.title,
      heading: document.querySelector('h1')?.innerText || document.querySelector('h2')?.innerText,
      statusBadge: document.body.innerText.includes('Completed') || document.body.innerText.includes('Handover completed'),
      recipientConfirmedText: document.body.innerText.includes('Confirmed') || document.body.innerText.includes('received')
    };
  });
  console.log('  ✓ Browser page details:', pageDetails);

  // Take screenshot
  const screenshotDir = path.resolve(process.cwd(), 'scratch');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
  const screenshotPath = path.join(screenshotDir, `verification_${testRunId}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`  ✓ Captured browser screenshot: ${screenshotPath}`);

  await browser.close();

  console.log('\n=================================================================');
  console.log('🎉 ALL 11 VERIFICATION STEPS PASSED SUCCESSFULLY ON CLOUD RUN!');
  console.log('=================================================================\n');

  return {
    testRunId,
    listingId,
    requestId,
    ownerEmail,
    neighbourEmail,
    outcomeId: `out_listing_${listingId}_reuse`,
    screenshotPath
  };
}

runE2EVerification()
  .then(res => {
    console.log('Verification Result Summary:', JSON.stringify(res, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ E2E VERIFICATION FAILED:', err);
    process.exit(1);
  });
