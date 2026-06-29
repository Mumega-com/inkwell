import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    recordVideo: { dir: '/home/jules/verification/videos/' }
  });
  const page = await context.newPage();

  await page.goto('http://localhost:8787/dashboard');
  await page.waitForTimeout(2000); // Give dashboard time to load

  await page.screenshot({ path: '/home/jules/verification/screenshots/dashboard.png', fullPage: true });

  await browser.close();
})();
