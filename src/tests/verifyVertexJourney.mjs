import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/mylla/.gemini/antigravity/brain/501f0538-c8b5-486f-9972-fbb87db12bd8';
const DEPLOYED_BASE = 'https://reloop-app-882475917539.asia-south1.run.app';

async function runBrowserWalkthrough() {
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
  await page.setViewport({ width: 1280, height: 1000 });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log(`Navigating to ${DEPLOYED_BASE}/assess...`);
  await page.goto(`${DEPLOYED_BASE}/assess`, { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1500));

  // Screenshot initial assess page
  const assessScreenshot = path.join(ARTIFACTS_DIR, 'vertex_migration_assess_page.png');
  await page.screenshot({ path: assessScreenshot, fullPage: true });
  console.log('Saved assess page screenshot:', assessScreenshot);

  // Focus and type into textarea
  console.log('Typing into textarea...');
  await page.click('textarea');
  await page.keyboard.type('Solid Sheesham wood study table with two drawers, clean finish and very sturdy');
  await new Promise(r => setTimeout(r, 500));

  // Click Submit button and wait for /api/assess response
  console.log('Submitting assessment to Vertex AI...');
  const [assessResponse] = await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/assess') && res.status() === 200, { timeout: 35000 }),
    page.click('button[type="submit"]')
  ]);
  console.log('Received /api/assess HTTP 200 from Vertex AI!');
  await new Promise(r => setTimeout(r, 1500));

  // Screenshot clarification questions step
  const clarifyScreenshot = path.join(ARTIFACTS_DIR, 'vertex_migration_clarify_questions.png');
  await page.screenshot({ path: clarifyScreenshot, fullPage: true });
  console.log('Saved clarification questions screenshot:', clarifyScreenshot);

  // Click 'Synthesize Recommended Options' button and wait for /api/recommendations response
  console.log('Requesting recommendation synthesis from Vertex AI...');
  const buttons = await page.$$('button');
  let synthButton = null;
  for (const b of buttons) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && text.includes('Synthesize Recommended Options')) {
      synthButton = b;
      break;
    }
  }

  if (!synthButton) {
    throw new Error('Could not find "Synthesize Recommended Options" button');
  }

  const [recommendResponse] = await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/recommendations') && res.status() === 200, { timeout: 35000 }),
    synthButton.click()
  ]);
  console.log('Received /api/recommendations HTTP 200 from Vertex AI!');

  // Wait for navigation to /results
  console.log('Waiting for results page navigation...');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));

  const resultsScreenshot = path.join(ARTIFACTS_DIR, 'vertex_migration_results_page.png');
  await page.screenshot({ path: resultsScreenshot, fullPage: true });
  console.log('Saved results page screenshot:', resultsScreenshot);

  await browser.close();
  console.log('Vertex AI Browser Walkthrough Complete!');
}

runBrowserWalkthrough().catch(err => {
  console.error('Walkthrough failed:', err);
  process.exit(1);
});
