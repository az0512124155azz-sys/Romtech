import { test, expect } from '@playwright/test';
test.describe.configure({mode:'serial'});
const PASSWORD='test-owner-password-123';
const login=async page=>{
  await page.goto('/admin/');
  await expect(page.locator('#adminCode')).toBeHidden();
  await page.locator('#adminPassword').fill(PASSWORD);await page.locator('#adminSubmit').click();
  await expect(page.locator('#adminApp')).toBeVisible();
};
const oauth=async page=>{
  await page.route('https://api.supabase.com/v1/oauth/authorize**',async route=>{
    const url=new URL(route.request().url());
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    const callback=new URL(url.searchParams.get('redirect_uri'));
    callback.searchParams.set('code','browser-test-code');callback.searchParams.set('state',url.searchParams.get('state'));
    await route.fulfill({status:302,headers:{location:callback.href},body:''});
  });
  await page.locator('#connectSupabase').click();
  await expect(page.locator('#projectChooser')).toBeVisible();
};
test('dev server visual check: loads, meaningful content, navigation and no script errors',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await expect(page.locator('#catalog .card')).toHaveCount(3);
  await page.screenshot({path:'test-results/local-home.png',fullPage:true});
  await login(page);
  for(const module of ['orders','inventory','customers','content','reviews','reports','settings','connection','products']){
    await page.locator(`[data-module="${module}"]`).click();
    await expect(page.locator(`[data-panel="${module}"]`)).toBeVisible();
  }
  await page.locator('#newBtn').click();
  await expect(page.locator('#productForm [name="status"]')).toHaveValue('published');
  await expect(page.locator('#productModal')).toContainText('רק מוצר במצב “מפורסם” מופיע באתר הראשי.');
  expect(errors).toEqual([]);
});
test('buyer connects account, chooses project, provisions, activates and migrates local data/images',async({page,browser})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await login(page);
  await page.evaluate(()=>{
    const products=RomTechData.loadProducts();
    products[0].images=['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6M9kAAAAASUVORK5CYII='];
    localStorage.setItem('romtech_products',JSON.stringify(products));
  });
  await page.locator('[data-module="connection"]').click();await oauth(page);
  await page.locator('#supabaseProject').selectOption('abcdefghijklmnopqrst');
  await page.locator('#setupProject').click();await expect(page.locator('#activateProject')).toBeVisible();
  await expect(page.locator('#connectionStatus')).toContainText('הבדיקות עברו');
  await page.locator('#activateProject').click();await expect(page.locator('#connectionActions')).toBeVisible();
  page.on('dialog',dialog=>dialog.accept());
  await page.locator('#migrateLocal').click();await expect(page.locator('#connectionStatus')).toContainText('ההעברה הושלמה',{timeout:30000});
  await page.locator('#checkConnection').click();await expect(page.locator('#connectionStatus')).toContainText('עברו בהצלחה');
  await page.screenshot({path:'test-results/connected-admin.png',fullPage:true});
  const config=await page.evaluate(()=>RomTechData.config);
  expect(config.mode).toBe('cloud');expect(config.connection.publishableKey).toMatch(/^sb_publishable_/);
  expect(JSON.stringify(config)).not.toMatch(/sb_secret_|management-private|refresh-private/);
  expect(await page.evaluate(()=>localStorage.getItem('romtech_products'))).toContain('data:image/png');
  const publicContext=await browser.newContext();const visitor=await publicContext.newPage();
  await visitor.goto('/');await expect(visitor.locator('#catalog .card')).toHaveCount(3);
  expect(await visitor.evaluate(()=>RomTechData.loadProducts()[0].images[0])).toContain('/storage/v1/object/public/romtech-images/');
  expect(await visitor.evaluate(()=>RomTechData.loadProducts()[0].cost)).toBeUndefined();
  await publicContext.close();expect(errors).toEqual([]);
});
test('second device sees saved updates, submits orders/reviews; admin sees private records',async({page,browser})=>{
  await login(page);
  await page.locator('[data-module="settings"]').click();
  await page.locator('#settingPhone').fill('+972 50 123 4567');await page.locator('#saveSiteSettings').click();
  await expect(page.locator('#siteSettingsSaved')).toBeVisible();
  const context=await browser.newContext();const visitor=await context.newPage();
  await visitor.goto('/product.html?id=rt-001');await expect(visitor.locator('#buyNow')).toBeVisible();
  expect((await visitor.evaluate(()=>RomTechData.loadSiteSettings())).phone).toBe('+972 50 123 4567');
  await visitor.locator('#buyNow').click();
  await visitor.locator('#orderName').fill('לקוח בדיקה');await visitor.locator('#orderPhone').fill('0501234567');
  await visitor.locator('#orderPrivacy').check();
  await visitor.locator('#orderForm button[type="submit"]').click();
  await expect(visitor.locator('#orderMessage')).toContainText('ההזמנה התקבלה');
  await visitor.goto('/reviews.html');
  await visitor.locator('#publicReviewName').fill('מבקר בדיקה');await visitor.locator('#publicReviewText').fill('שירות טוב מאוד');
  await visitor.locator('#publicReviewForm button[type="submit"]').click();
  await expect(visitor.locator('#publicReviewMessage')).toContainText('פורסמה');
  await page.locator('[data-module="orders"]').click();await page.locator('#ordersRefresh').click();
  await expect(page.locator('#ordersRows')).toContainText('לקוח בדיקה');
  await page.locator('[data-module="reviews"]').click();await page.locator('#reviewsRefresh').click();
  await expect(page.locator('#reviewsRows')).toContainText('שירות טוב מאוד');
  expect(await visitor.evaluate(()=>RomTechData.loadOrders())).toEqual([]);
  await context.close();
});
test('failed save keeps form open and no success notice; creation, replacement and disconnect are explicit',async({page})=>{
  await login(page);await page.locator('[data-module="settings"]').click();
  await page.route('**/api/romtech?action=patch',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'provider_unavailable',message:'אין חיבור לשרת. השינוי לא נשמר.'}})}));
  await page.locator('#settingPhone').fill('different');await page.locator('#saveSiteSettings').click();
  await expect(page.locator('#cloudNotice')).toContainText('השינוי לא נשמר');await expect(page.locator('#siteSettingsSaved')).toBeHidden();
  await page.unroute('**/api/romtech?action=patch');
  await page.locator('[data-module="connection"]').click();await oauth(page);
  await page.locator('details summary').click();await page.locator('#projectCostConsent').check();
  await page.locator('#createProject').click();await expect(page.locator('#connectionStatus')).toContainText('נוצר');
  await page.locator('#refreshProjects').click();
  await expect(page.locator('#supabaseProject option')).toHaveCount(3);
  await page.locator('#supabaseProject').selectOption('tsrqponmlkjihgfedcba');
  await page.locator('#setupProject').click();await expect(page.locator('#activateProject')).toBeVisible();
  await page.locator('#activateProject').click();await expect(page.locator('#connectionProject')).toContainText('replacement');
  page.on('dialog',dialog=>dialog.accept());
  await page.locator('#disconnectSupabase').click();await expect(page.locator('#connectionProject')).toContainText('מנותק');
  await page.goto('/');await expect(page.locator('#cloudNotice')).toContainText('מנותק');await expect(page.locator('#catalog .card')).toHaveCount(0);
});
