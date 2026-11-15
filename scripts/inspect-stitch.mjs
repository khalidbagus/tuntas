// Read-only smoke check of the exported prototypes. Never load third-party assets.
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const root='docs/export_stitch_tuntas_personal_document_manager/';
const browser=await chromium.launch();
try {
 const context=await browser.newContext();await context.route(/^https?:/,r=>r.abort());
 const page=await context.newPage();
 await page.setContent(await readFile(root+'home_capture_first_tuntas/code.html','utf8'));
 const nav=page.locator('nav [data-path=library]');
 console.log('Home Library destination:',await nav.getAttribute('href'));
 await nav.click();console.log('After Library click: still on exported Home:',await page.getByText('Good morning ✦',{exact:true}).count()>0);
 await page.setContent(await readFile(root+'create_action_tuntas/code.html','utf8'));
 await page.locator('#confirm-action-btn').click();await page.getByText('Added to Actions',{exact:false}).waitFor();
 console.log('Create Action result:',await page.locator('#action-toast').innerText());
 console.log('Actions list opened:',await page.getByRole('heading',{name:'Actions',exact:true}).count()>0);
} finally {await browser.close();}

