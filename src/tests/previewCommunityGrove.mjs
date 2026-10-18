import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/mylla/.gemini/antigravity/brain/501f0538-c8b5-486f-9972-fbb87db12bd8';

async function captureCommunityGrovePreview() {
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

  // Navigate to local dev community page
  console.log('Navigating to http://localhost:3000/community...');
  await page.goto('http://localhost:3000/community', { waitUntil: 'networkidle2' });
  
  // Wait for the community grove section to appear
  console.log('Waiting for community grove section to render...');
  await page.waitForSelector('section[aria-labelledby="community-grove-heading"]', { timeout: 30000 });
  await new Promise(r => setTimeout(r, 1500));

  // Capture full preview (Gentle motion mode)
  const previewPath = path.join(ARTIFACTS_DIR, 'community_grove_preview.png');
  await page.screenshot({ path: previewPath, fullPage: true });
  console.log('Saved community grove preview:', previewPath);

  // Toggle Motion button to Static
  const motionButton = await page.$('button[aria-label*="Disable grove animation"]');
  if (motionButton) {
    console.log('Clicking motion toggle button...');
    await motionButton.click();
    await new Promise(r => setTimeout(r, 1000));
    const staticMotionPath = path.join(ARTIFACTS_DIR, 'community_grove_static_motion.png');
    await page.screenshot({ path: staticMotionPath, fullPage: true });
    console.log('Saved static motion preview:', staticMotionPath);
  } else {
    console.warn('Could not find motion toggle button');
  }

  // Click Live Cloud Stream button to capture live mode
  console.log('Clicking Live Cloud Stream tab...');
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && text.includes('Live Cloud Stream')) {
      await b.click();
      break;
    }
  }
  await new Promise(r => setTimeout(r, 2000));
  const liveStreamPath = path.join(ARTIFACTS_DIR, 'community_grove_live_stream.png');
  await page.screenshot({ path: liveStreamPath, fullPage: true });
  console.log('Saved live cloud stream preview:', liveStreamPath);

  // Capture Welcoming Empty State using Request Interception
  console.log('Capturing empty state preview...');
  const emptyPage = await browser.newPage();
  await emptyPage.setViewport({ width: 1280, height: 1100 });
  await emptyPage.setRequestInterception(true);
  emptyPage.on('request', req => {
    if (req.url().includes('/api/analytics')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          metrics: {
            totalCompletedActions: 0,
            actionsByCategory: {},
            actionsByType: {},
            divertedKgTotal: 0,
            itemsWithWeightCount: 0,
            grove: {
              totalTrees: 0,
              milestonesUnlocked: 0,
              currentMilestone: 0,
              progressInCurrentMilestone: 0,
              targetForNextMilestone: 10,
              remainingToNextMilestone: 10,
              verifiedReceiptCount: 0,
              qualifyingAction: 'reuse',
              dataSource: 'firestore_deduplicated_canonical',
              isSymbolic: true
            },
            lastAnalyticsUpdateTime: new Date().toISOString(),
            isDemo: false
          }
        })
      });
    } else {
      req.continue();
    }
  });

  await emptyPage.goto('http://localhost:3000/community', { waitUntil: 'networkidle2' });
  await emptyPage.waitForSelector('section[aria-labelledby="community-grove-heading"]', { timeout: 30000 });
  await new Promise(r => setTimeout(r, 1000));
  const emptyStatePath = path.join(ARTIFACTS_DIR, 'community_grove_empty_state.png');
  await emptyPage.screenshot({ path: emptyStatePath, fullPage: true });
  console.log('Saved empty state preview:', emptyStatePath);
  await emptyPage.close();

  await browser.close();
  console.log('Grove preview capture complete!');
}

captureCommunityGrovePreview().catch(err => {
  console.error('Preview error:', err);
  process.exit(1);
});
