import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CLOUD_RUN_BASE_URL = 'https://reloop-app-882475917539.asia-south1.run.app';
const PROJECT_ID = 'sustainabilitymvp-ed15e';
const FIREBASE_WEB_API_KEY = 'AIzaSyBVE_yRreXYcPaxSdADH04RrMBo4T96UyA';
const ARTIFACTS_DIR = 'C:/Users/mylla/.gemini/antigravity/brain/501f0538-c8b5-486f-9972-fbb87db12bd8';

const testRunId = `upload_test_${Date.now()}`;
const userEmail = `test.photouploader.${testRunId}@reloop.org`;
const testPassword = 'PhotoUploadSecret2026!';

// Minimal valid 1x1 JPEG buffer with genuine JFIF magic bytes
function createTestJpegBuffer() {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
    0x00, 0xbf, 0x00, 0xff, 0xd9
  ]);
}

async function getOrInitAdminAuth() {
  const app = getApps().length === 0 ? initializeApp({ projectId: PROJECT_ID }) : getApps()[0];
  return getAuth(app);
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
    displayName: data.displayName || 'Photo Uploader'
  };
}

async function runLiveListingPhotoUploadVerification() {
  console.log('================================================================');
  console.log('LIVE VERIFICATION: LISTING PHOTO UPLOAD & VIEW SAVED IMAGE');
  console.log(`Cloud Run Service: ${CLOUD_RUN_BASE_URL}`);
  console.log(`Run ID: ${testRunId}`);
  console.log('================================================================\n');

  // Step 1: Provision authentic test user
  console.log('--- Step 1: Provisioning Authentic Firebase Test User ---');
  const adminAuth = await getOrInitAdminAuth();
  await adminAuth.createUser({
    email: userEmail,
    password: testPassword,
    displayName: 'Photo Uploader (Shimna)'
  });
  const authUser = await signInUserWithPassword(userEmail);
  console.log(`  ✓ Authenticated user: ${authUser.uid} (${authUser.email})`);

  // Step 2: Prepare temporary test photo on disk
  const tempDir = path.resolve(process.cwd(), 'scratch');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const tempPhotoPath = path.join(tempDir, `test_listing_photo_${testRunId}.jpg`);
  fs.writeFileSync(tempPhotoPath, createTestJpegBuffer());
  console.log(`  ✓ Created genuine test photo at: ${tempPhotoPath}`);

  // Step 3: Launch browser
  console.log('\n--- Step 2: Launching Browser & Verifying /listings/new Upload Availability ---');
  const edgePaths = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe'
  ];
  const executablePath = edgePaths.find(p => fs.existsSync(p));
  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Seed authenticated user session
  await page.goto(`${CLOUD_RUN_BASE_URL}/_not-found`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((u, t) => {
    localStorage.setItem('reloop_user', JSON.stringify({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      isDemo: false
    }));
    localStorage.setItem('reloop_token', t);
  }, authUser, authUser.idToken);

  // Visit /listings/new
  await page.goto(`${CLOUD_RUN_BASE_URL}/listings/new`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));

  const pageContent = await page.content();
  const hasCloudStoragePending = pageContent.includes('Cloud Storage Pending');
  const hasStage2Pending = pageContent.includes('Stage 2');
  const hasAddPhotoText = pageContent.includes('Add a photo');

  console.log(`  ✓ "Cloud Storage Pending" removed: ${!hasCloudStoragePending}`);
  console.log(`  ✓ "Stage 2" mentions removed: ${!hasStage2Pending}`);
  console.log(`  ✓ "Add a photo" upload drop zone visible: ${hasAddPhotoText}`);

  if (hasCloudStoragePending || hasStage2Pending) {
    throw new Error('Listing page still displays stale setup or Stage 2 notices!');
  }

  // Step 4: Upload Photo via File Input
  console.log('\n--- Step 3: Uploading Photo to Form & Verifying Image Preview ---');
  const fileInput = await page.$('input[type="file"]');
  if (!fileInput) throw new Error('File input not found on page');
  await fileInput.uploadFile(tempPhotoPath);
  await new Promise(r => setTimeout(r, 1000));

  const previewExists = await page.evaluate(() => {
    const img = document.querySelector('img[alt="Preview"]');
    return Boolean(img && img.src.startsWith('data:image/'));
  });
  console.log(`  ✓ Photo preview rendered on form: ${previewExists}`);
  if (!previewExists) throw new Error('Photo preview did not render after file selection');

  const uploadScreenshot = path.join(ARTIFACTS_DIR, 'listing_new_upload_enabled.png');
  await page.screenshot({ path: uploadScreenshot, fullPage: true });
  console.log(`  ✓ Saved form upload screenshot: ${uploadScreenshot}`);

  // Step 5: Fill Form Fields & Publish
  console.log('\n--- Step 4: Filling Listing Form & Publishing ---');
  await page.evaluate((titleVal, descVal, prefVal) => {
    const inputs = document.querySelectorAll('input[type="text"]');
    const textarea = document.querySelector('textarea');
    if (inputs[0]) {
      inputs[0].value = titleVal;
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (textarea) {
      textarea.value = descVal;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (inputs[1]) {
      inputs[1].value = prefVal;
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, `Sheesham Wood Table (${testRunId})`, 'Solid wood study table with working storage drawers and clean finish.', 'Pickup near Defence Colony, Indiranagar');

  const submitButton = await page.$('button[type="submit"]');
  if (!submitButton) throw new Error('Submit button not found');
  await submitButton.click();

  // Wait for navigation to /listings/list_...
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
  const publishedUrl = page.url();
  console.log(`  ✓ Navigated to published listing URL: ${publishedUrl}`);

  // Step 6: Verify Saved Image on Detail Page
  console.log('\n--- Step 5: Verifying Saved Image Render on Listing Detail Page ---');
  await new Promise(r => setTimeout(r, 1500));

  const imageDetails = await page.evaluate(() => {
    const images = Array.from(document.querySelectorAll('img')).filter(img => 
      img.src.includes('/api/media/')
    );
    if (images.length === 0) return null;
    const img = images[0];
    return {
      src: img.src,
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight
    };
  });

  console.log('  ✓ Rendered photo details:', imageDetails);
  if (!imageDetails || !imageDetails.src.includes('/api/media/listings/')) {
    throw new Error('Uploaded photo not served via /api/media/ on listing detail page');
  }

  const publishedScreenshot = path.join(ARTIFACTS_DIR, 'listing_published_with_photo.png');
  await page.screenshot({ path: publishedScreenshot, fullPage: true });
  console.log(`  ✓ Saved published listing screenshot: ${publishedScreenshot}`);

  // Step 7: Refresh Page and Verify Saved Image Persists
  console.log('\n--- Step 6: Refreshing Page & Verifying Saved Image Persists ---');
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));

  const refreshedImageDetails = await page.evaluate(() => {
    const images = Array.from(document.querySelectorAll('img')).filter(img => 
      img.src.includes('/api/media/')
    );
    if (images.length === 0) return null;
    const img = images[0];
    return {
      src: img.src,
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight
    };
  });

  console.log('  ✓ Refreshed photo details:', refreshedImageDetails);
  if (!refreshedImageDetails || refreshedImageDetails.naturalWidth <= 0) {
    throw new Error('Saved image failed to load after page refresh');
  }
  console.log(`  ✓ Saved image loaded with dimensions: ${refreshedImageDetails.naturalWidth}x${refreshedImageDetails.naturalHeight}`);

  const refreshedScreenshot = path.join(ARTIFACTS_DIR, 'listing_refreshed_with_photo.png');
  await page.screenshot({ path: refreshedScreenshot, fullPage: true });
  console.log(`  ✓ Saved refreshed listing screenshot: ${refreshedScreenshot}`);

  await browser.close();

  // Cleanup local scratch photo
  try { fs.unlinkSync(tempPhotoPath); } catch {}

  console.log('\n================================================================');
  console.log('ALL LISTING PHOTO UPLOAD VERIFICATION CHECKS PASSED!');
  console.log('================================================================\n');
}

runLiveListingPhotoUploadVerification().catch(err => {
  console.error('Photo upload verification failed:', err);
  process.exit(1);
});
