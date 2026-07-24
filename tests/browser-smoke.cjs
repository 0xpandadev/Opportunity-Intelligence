const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
  let browser;
  try {
  browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1}); page.setDefaultTimeout(10000);
  const errors=[]; page.on('pageerror',error=>errors.push(error.message)); page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});
  await page.goto(process.env.DIW_BROWSER_URL||'http://127.0.0.1:4318',{waitUntil:'networkidle'});
  console.log('loaded');
  if (!(await page.getByLabel('分析依頼').isVisible())) await page.getByRole('button',{name:'新しい分析'}).click();
  await page.getByLabel('分析依頼').fill('欧州の材料産業で2030年までに利益プールが移る工程とホワイトスペースを分析して');
  await page.getByRole('button',{name:'分析runを作成'}).click();
  await page.getByText('次の工程：Codexで実データ分析').waitFor();
  assert.match(await page.locator('#run-status').innerText(),/pending_codex/i);
  console.log('request-created');
  await page.getByRole('button',{name:'接続状況'}).click();
  await page.getByText('AIキーとデータ接続は別物です').waitFor();
  console.log('connectors-visible');
  await page.getByRole('button',{name:'方法論'}).click();
  await page.getByText('一つの予測法に賭けず').waitFor();
  console.log('methods-visible');
  await page.screenshot({path:'browser-smoke.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,screenshot:'browser-smoke.png',title:await page.title()},null,2));
  } finally { if(browser) await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
