const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Set up network interception
  await page.setRequestInterception(true);
  
  page.on('request', request => {
    if (request.url().includes('graphql') || request.url().includes('login')) {
      console.log('->', request.method(), request.url());
      const postData = request.postData();
      if (postData) {
        console.log('Request Payload:', postData.substring(0, 150));
      }
    }
    request.continue();
  });
  
  page.on('response', async response => {
    if (response.url().includes('graphql') || response.url().includes('login')) {
      console.log('<-', response.status(), response.url());
      try {
        const text = await response.text();
        console.log('Response:', text.substring(0, 300));
      } catch(e) {
        console.log('Response: Could not read text', e.message);
      }
    }
  });

  console.log("Navigating to login page...");
  await page.goto('https://ai-agent-workflow-builder-a9ot.vercel.app/');
  
  console.log("Logging in...");
  await page.type('input[type="email"]', 'orga-owner@test.com');
  await page.click('button[type="submit"]');
  
  console.log("Waiting for navigation to dashboard...");
  await page.waitForNavigation({ waitUntil: 'networkidle0' });
  
  console.log("Dashboard loaded!");
  const html = await page.content();
  if (html.includes("You don't belong to any organization")) {
    console.log("Error message is visible!");
  } else {
    console.log("Error message is NOT visible!");
  }

  await browser.close();
})();
