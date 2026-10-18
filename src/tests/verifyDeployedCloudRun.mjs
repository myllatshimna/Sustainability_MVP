import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/mylla/.gemini/antigravity/brain/501f0538-c8b5-486f-9972-fbb87db12bd8';
const DEPLOYED_URL = 'https://reloop-app-882475917539.asia-south1.run.app/community';

async function verifyDeployedCommunityGrove() {
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
  await page.setViewport({ width: 1280, height: 1100 });

  console.log(`Navigating to ${DEPLOYED_URL}...`);
  await page.goto(DEPLOYED_URL, { waitUntil: 'networkidle2' });

  console.log('Waiting for community grove section to render...');
  await page.waitForSelector('section[aria-labelledby="community-grove-heading"]', { timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  const screenshotPath = path.join(ARTIFACTS_DIR, 'deployed_cloud_run_community_grove.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Saved deployed Cloud Run screenshot:', screenshotPath);

  // Click Live Cloud Stream button
  console.log('Clicking Live Cloud Stream tab on deployed service...');
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && text.includes('Live Cloud Stream')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 2000));
  const liveScreenshotPath = path.join(ARTIFACTS_DIR, 'deployed_cloud_run_live_stream.png');
  await page.screenshot({ path: liveScreenshotPath, fullPage: true });
  console.log('Saved deployed Cloud Run live stream screenshot:', liveScreenshotPath);

  await browser.close();
  console.log('Verification complete!');
}

verifyDeployedCommunityGrove().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
