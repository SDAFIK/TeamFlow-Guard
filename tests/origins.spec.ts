import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const fixture=JSON.parse(readFileSync('.local/hosted-demo.json','utf8'));
test('hosted alias supports login and logout while rejecting foreign origins',async({page})=>{
  test.setTimeout(120_000);
  if(process.env.TEAMFLOW_VERCEL_SHARE_FILE){
    const share=JSON.parse(readFileSync(process.env.TEAMFLOW_VERCEL_SHARE_FILE,'utf8'));
    await page.goto(share.url);
  }
  await page.goto('/overview');
  await page.getByLabel('Email address').fill('asha@teamflow.demo');
  await page.getByLabel('Password',{exact:true}).fill(fixture.password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Delivery overview'})).toBeVisible({timeout:60000});
  const denied=await page.request.post('/api/auth/logout',{headers:{Origin:'https://unrelated.vercel.app'}});
  expect(denied.status()).toBe(403);
  expect((await page.request.get('/api/me')).status()).toBe(200);
  const origin=new URL(page.url()).origin;
  expect((await page.request.post('/api/auth/logout',{headers:{Origin:origin}})).status()).toBe(200);
  expect((await page.request.get('/api/me')).status()).toBe(401);
});
