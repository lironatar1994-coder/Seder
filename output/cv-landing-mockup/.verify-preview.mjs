import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const folder=path.dirname(fileURLToPath(import.meta.url));
const evidence=path.join(folder,'checks');
await fs.mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true});
const report=[];
for(const [name,options] of [['desktop',{viewport:{width:1440,height:1000}}],['mobile',{viewport:{width:390,height:844},isMobile:true,hasTouch:true}],['narrow',{viewport:{width:320,height:780},isMobile:true,hasTouch:true}]]){
 const context=await browser.newContext(options);
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const responses=[];
 page.on('response',response=>{if(response.status()>=400)responses.push({url:response.url(),status:response.status()});});
 await page.goto('http://127.0.0.1:5197/',{waitUntil:'networkidle'});
 await page.evaluate(()=>document.fonts.ready);
 const layout=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,images:Array.from(document.querySelectorAll('.shot')).map(image=>({loaded:image.complete&&image.naturalWidth>0,width:image.naturalWidth,height:image.naturalHeight})),doc:document.querySelector('.comparison').getBoundingClientRect().toJSON(),font:document.fonts.check('800 24px PreviewHebrew')}));
 if(layout.scrollWidth>layout.width)throw new Error(name+' horizontal overflow');
 if(layout.images.some(image=>!image.loaded))throw new Error(name+' missing mockup');
 const range=page.locator('#comparison-range');
 const rect=await range.boundingBox();
 if(name==='desktop'){
   await page.mouse.move(rect.x+rect.width*.5,rect.y+rect.height*.5);
   await page.mouse.down();
   await page.mouse.move(rect.x+rect.width*.2,rect.y+rect.height*.5,{steps:8});
   await page.mouse.up();
   const value=Number(await range.inputValue());
   if(Math.abs(value-20)>2)throw new Error('Mouse drag failed: '+value);
   await range.focus();
   await page.keyboard.press('Home');
   if(await range.inputValue()!=='0')throw new Error('Keyboard Home failed');
   await page.keyboard.press('End');
   if(await range.inputValue()!=='100')throw new Error('Keyboard End failed');
   await page.keyboard.press('ArrowLeft');
   if(await range.inputValue()!=='99')throw new Error('Keyboard arrow failed');
 }else{
   await page.touchscreen.tap(rect.x+rect.width*.75,rect.y+rect.height*.5);
   const value=Number(await range.inputValue());
   if(Math.abs(value-75)>2)throw new Error('Touch interaction failed: '+value);
 }
 await page.getByRole('button',{name:'הצגת לפני',exact:true}).click();
 if(await range.inputValue()!=='100')throw new Error('Before button failed');
 await page.getByRole('button',{name:'הצגת אחרי',exact:true}).click();
 if(await range.inputValue()!=='0')throw new Error('After button failed');
 await page.getByRole('button',{name:'השוואה',exact:true}).click();
 if(await range.inputValue()!=='50')throw new Error('Reset button failed');
 await page.locator('.variant').nth(0).click();
 if(!await page.locator('#variant-dialog').evaluate(dialog=>dialog.open))throw new Error('Gallery modal failed');
 await page.getByRole('button',{name:'סגירה',exact:true}).click();
 if(await page.locator('#variant-dialog').evaluate(dialog=>dialog.open))throw new Error('Gallery close failed');
 await page.evaluate(()=>scrollTo(0,0));
 await page.screenshot({path:path.join(evidence,name+'.png'),fullPage:true,animations:'disabled'});
 if(errors.length||responses.length)throw new Error(name+' browser errors '+JSON.stringify({errors,responses}));
 report.push({name,...layout,interactions:'passed',errors:0});
 await context.close();
}
function luminance(hex){const c=hex.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];}
const contrasts=[['#10264d','#ffffff'],['#496077','#ffffff'],['#496077','#f2f6fc'],['#0649d9','#ffffff'],['#5d636b','#ffffff'],['#ffffff','#102a43'],['#0046b8','#eaf3fb']].map(([foreground,background])=>{const a=luminance(foreground),b=luminance(background);return {foreground,background,ratio:Number(((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toFixed(2))};});
if(contrasts.some(pair=>pair.ratio<4.5))throw new Error('Contrast below body-text threshold');
const result={viewports:report,contrasts};
await fs.writeFile(path.join(evidence,'verification.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
await browser.close();

