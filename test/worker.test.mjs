import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {scryptSync,randomBytes} from 'node:crypto';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

let mf,dir,ownerCookie,registeredCookie,registeredId;
const origin='https://mlmsale.ir', password=randomBytes(16).toString('hex');
const salt=randomBytes(16).toString('hex');
const owner={id:'ahoora-owner',phone:'09120000000',email:'owner@example.test',salt,hash:scryptSync(password,salt,64).toString('hex')};
const options=()=>({name:'mlmsale-test',scriptPath:'dist/worker.js',modules:true,compatibilityDate:'2026-10-05',compatibilityFlags:['nodejs_compat'],
  durableObjects:{MARKET:{className:'Marketplace',useSQLite:true}},resourcePersistencePath:dir,
  bindings:{PUBLIC_SITE_URL:origin,OWNER_ACCOUNT_JSON:JSON.stringify(owner)},
  serviceBindings:{ASSETS:async request=>{
    const root=path.resolve('public'),target=path.resolve(root,'.'+new URL(request.url).pathname);
    if(!target.startsWith(root+path.sep))return new Response(null,{status:404});
    try{return new Response(await readFile(target));}catch{return new Response(null,{status:404});}
  }}
});
const request=(url,method='GET',data,cookie)=>mf.dispatchFetch(origin+url,{method,headers:{Origin:origin,...(data?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:data?JSON.stringify(data):undefined});
const cookieOf=response=>response.headers.get('set-cookie').split(';')[0];
before(async()=>{dir=await mkdtemp(path.join(tmpdir(),'mlmsale-test-'));mf=new Miniflare(convertV4MiniflareOptions(options()));await mf.ready;});
after(async()=>{if(mf)await mf.dispose();if(dir)await rm(dir,{recursive:true,force:true});});

test('catalog SSR, canonical domain, robots and real 404s',async()=>{
  const products=await(await request('/products.json')).json(),titles=new Set();
  assert.ok(products.length>=16);assert.equal(products.filter(p=>p.company==='arya').length,16);
  const details=await request('/api/product/'+products[0].id);assert.equal(details.status,200);const full=await details.json();assert.equal(full.id,products[0].id);assert.ok(full.sections.description);assert.equal((await request('/api/product/999999999')).status,404);
  for(const p of products){const r=await request(p.url);assert.equal(r.status,200);const h=await r.text();assert.ok(h.includes('application/ld+json'));assert.ok(h.includes('index,follow'));assert.ok(h.includes(origin+p.url));titles.add(h.match(/<title>(.*?)<\/title>/)[1]);}
  assert.equal(titles.size,products.length);
  const home=await(await request('/')).text();assert.ok(home.includes('MLM Sale'));assert.ok(!home.includes('بازار محصولات آریا'));
  for(const id of ['arya','newsha','pmlm','lia','biz']){const r=await request('/companies/'+id);assert.equal(r.status,200);const html=await r.text();assert.ok(html.includes('data-company="'+id+'"'));assert.ok(!html.includes('تومان'));if(id!=='arya')assert.ok(!html.includes('/products/arya-'));}
  assert.equal((await request('/companies/unknown')).status,404);assert.equal((await request('/not-a-page')).status,404);
  assert.equal((await request('/missing.png')).status,404);
  assert.equal((await request('/.owner-account.secret.json')).status,404);
  assert.equal((await request('/assets/font-400.woff2')).status,200);
  assert.ok((await(await request('/robots.txt')).text()).includes(origin+'/sitemap.xml'));
  assert.ok((await(await request('/dashboard')).text()).includes('noindex,follow'));
  const www=await mf.dispatchFetch('https://www.mlmsale.ir/products/x?a=1',{redirect:'manual'});assert.equal(www.status,308);assert.equal(www.headers.get('location'),origin+'/products/x?a=1');
  const preview=await mf.dispatchFetch('https://preview.workers.dev/products/arya-apricot-scrub');assert.equal(preview.headers.get('x-robots-tag'),'noindex, follow');assert.ok((await preview.text()).includes('noindex,follow'));
});
test('owner login uses private seed, secure cookie and public booth redaction',async()=>{
  const r=await request('/api/login','POST',{login:owner.email,password});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/HttpOnly.*Secure/);ownerCookie=cookieOf(r);
  assert.equal((await(await request('/api/session','GET',null,ownerCookie)).json()).id,owner.id);
  const publicData=await(await request('/api/booths')).text();for(const s of [owner.phone,owner.email,owner.hash,owner.salt])assert.ok(!publicData.includes(s));
  assert.equal((await(await request('/api/session')).json()).id,null);
  assert.equal((await request('/api/booth','PUT',{id:owner.id,offers:{}})).status,401);
});
test('registration, duplicate rejection and booth ownership',async()=>{
  const form={phone:'09120000001',email:'seller@example.test',password,name:'غرفه آزمایشی',owner:'فروشنده آزمایشی',whatsapp:'test_handle'};
  const r=await request('/api/register','POST',form);assert.equal(r.status,201);registeredCookie=cookieOf(r);registeredId=(await r.json()).id;
  assert.equal((await request('/api/register','POST',form)).status,409);
  assert.equal((await request('/api/booth','PUT',{id:owner.id,name:'تغییر غیرمجاز',offers:{}},registeredCookie)).status,403);
  assert.equal((await request('/api/booth','PUT',{id:registeredId,name:form.name,whatsapp:'test_handle',description:'توضیح آزمون',offers:{89:{price:100000,discount:15}}},registeredCookie)).status,200);
  const catalog=await(await request('/products.json')).json(),lia=catalog.find(p=>p.company==='lia');assert.ok(lia);assert.equal((await request('/api/booth','PUT',{id:registeredId,name:form.name,offers:{89:{price:100000,discount:15},[lia.id]:{price:200000,discount:10}}},registeredCookie)).status,200);
  assert.equal((await request('/api/booth','PUT',{id:registeredId,name:form.name,offers:{9999:{price:100,discount:0}}},registeredCookie)).status,400);
  assert.equal((await request('/api/booth','PUT',{id:registeredId,name:form.name,offers:{89:{price:100000,discount:110}}},registeredCookie)).status,400);
  const badOrigin=await mf.dispatchFetch(origin+'/api/register',{method:'POST',headers:{Origin:'https://other.test','Content-Type':'application/json'},body:JSON.stringify(form)});assert.equal(badOrigin.status,403);
});
test('persistent storage survives Worker restart without resetting offers or sessions',async()=>{
  await mf.dispose();mf=new Miniflare(convertV4MiniflareOptions(options()));await mf.ready;
  assert.equal((await(await request('/api/session','GET',null,registeredCookie)).json()).id,registeredId);
  const booths=await(await request('/api/booths')).json(),b=booths.find(b=>b.id===registeredId);assert.equal(b.offers['89'].discount,15);
  assert.equal((await request('/booths/'+registeredId)).status,200);
  const logout=await request('/api/logout','POST',{},registeredCookie);assert.equal(logout.status,200);
  assert.equal((await(await request('/api/session','GET',null,registeredCookie)).json()).id,null);
});
test('failed login throttle persists and excludes credentials from responses',async()=>{
  for(let i=0;i<5;i++){const r=await request('/api/login','POST',{login:owner.phone,password:'wrong'});assert.equal(r.status,401);assert.ok(!(await r.text()).includes(owner.phone));}
  assert.equal((await request('/api/login','POST',{login:owner.phone,password})).status,429);
});
