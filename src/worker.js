import { DurableObject } from 'cloudflare:workers';
import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import initialBooths from './initial-booths.json';
import { seoResponse, products } from './seo.js';

const derive = promisify(scrypt);
const normalize = value => String(value ?? '').replace(/[۰-۹]/g, c => '۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).trim();
const hashToken = value => createHash('sha256').update(value).digest('hex');
const productIds = new Set(products.map(p => String(p.id)));
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra }
});
class InputError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
async function readBody(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new InputError('فرمت درخواست معتبر نیست.', 415);
  let length = 0; const chunks = [];
  if (request.body) for await (const chunk of request.body) {
    length += chunk.length;
    if (length > 32768) throw new InputError('درخواست بیش از حد بزرگ است.', 413);
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error();
    return value;
  } catch { throw new InputError('درخواست معتبر نیست.'); }
}

export class Marketplace extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env); this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, phone TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS booths (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);`);
    ctx.storage.transactionSync(() => {
      for (const b of initialBooths) this.sql.exec('INSERT OR IGNORE INTO booths VALUES (?, ?, ?)', b.id, b.name, JSON.stringify(b));
      // The owner identity is injected as a runtime secret, never bundled with assets or source.
      if (env.OWNER_ACCOUNT_JSON) {
        const u = JSON.parse(env.OWNER_ACCOUNT_JSON);
        if (u.id !== 'ahoora-owner' || !/^09\d{9}$/.test(u.phone) || !/^\S+@\S+\.\S+$/.test(u.email) || !/^[a-f0-9]{32}$/.test(u.salt) || !/^[a-f0-9]{128}$/.test(u.hash)) throw new Error('Invalid owner secret');
        this.sql.exec('INSERT OR IGNORE INTO users VALUES (?, ?, ?, ?, ?)', u.id, u.phone, u.email.toLowerCase(), u.salt, u.hash);
      }
    });
  }
  first(query, ...params) { return this.sql.exec(query, ...params).toArray()[0]; }
  booths() { return this.sql.exec('SELECT data FROM booths ORDER BY rowid').toArray().map(r => JSON.parse(r.data)); }
  account(request) {
    const token = request.headers.get('cookie')?.match(/(?:^|;\s*)arya_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    return token ? this.first('SELECT u.id FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?', hashToken(token), Date.now()) : null;
  }
  limit(key, max, interval) {
    const now = Date.now();
    this.sql.exec('DELETE FROM limits WHERE expires<=?', now);
    const row = this.first('SELECT count FROM limits WHERE key=?', key);
    if (row && row.count >= max) throw new InputError('کمی بعد دوباره تلاش کنید.', 429);
    this.sql.exec('INSERT INTO limits VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count=count+1', key, now + interval);
  }
  createSession(request, id) {
    const token = randomBytes(32).toString('hex');
    this.sql.exec('DELETE FROM sessions WHERE expires<=?', Date.now());
    this.sql.exec('INSERT INTO sessions VALUES (?, ?, ?)', hashToken(token), id, Date.now() + 86400000);
    return `arya_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
  }
  async fetch(request) {
    try {
      const url = new URL(request.url), path = url.pathname;
      if (!path.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(request.method)) return json({error:'روش درخواست مجاز نیست.'}, 405);
        const canonical = this.env.PUBLIC_SITE_URL;
        const live = canonical && url.origin === canonical;
        const page = seoResponse(path, this.booths(), live ? canonical : null);
        // Previews keep their own canonical host and remain noindex.
        const body = live ? page.body : page.body.replaceAll('http://127.0.0.1:4317', url.origin);
        return new Response(request.method === 'HEAD' ? null : body, {status:page.status || 200, headers:{'Content-Type':page.type, 'Cache-Control':'no-store'}});
      }
      if (!['GET', 'POST', 'PUT'].includes(request.method)) return json({error:'روش درخواست مجاز نیست.'}, 405);
      if (request.method !== 'GET' && request.headers.get('origin') !== url.origin) return json({error:'درخواست مجاز نیست.'}, 403);
      if (path === '/api/session' && request.method === 'GET') return json({id:this.account(request)?.id ?? null});
      if (path === '/api/booths' && request.method === 'GET') return json(this.booths());
      if (path === '/api/logout' && request.method === 'POST') {
        const token = request.headers.get('cookie')?.match(/arya_session=([a-f0-9]{64})/)?.[1];
        if (token) this.sql.exec('DELETE FROM sessions WHERE token_hash=?', hashToken(token));
        return json({ok:true}, 200, {'Set-Cookie':`arya_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${url.protocol === 'https:' ? '; Secure' : ''}`});
      }
      if (['/api/login','/api/register'].includes(path) && request.method === 'POST') {
        if (!this.first('SELECT id FROM users WHERE id=?', 'ahoora-owner')) return json({error:'حساب مدیر هنوز روی سرور فعال نشده است.'}, 503);
        const ip = request.headers.get('CF-Connecting-IP') || 'local';
        this.limit('ip:' + hashToken(ip), 30, 300000);
        const x = await readBody(request);
        if (path === '/api/login') {
          const login = normalize(x.login).toLowerCase(), key = 'login:' + hashToken(login);
          this.limit(key, 5, 300000);
          const u = this.first('SELECT * FROM users WHERE phone=? OR email=?', login, login);
          const password = String(x.password || '');
          if (password.length > 256) throw new InputError('رمز بیش از حد طولانی است.');
          const computed = await derive(password, u?.salt || 'invalid-salt', 64);
          if (!u || !timingSafeEqual(computed, Buffer.from(u.hash, 'hex'))) return json({error:'شماره، ایمیل یا رمز صحیح نیست.'}, 401);
          this.sql.exec('DELETE FROM limits WHERE key=?', key);
          return json({id:u.id}, 200, {'Set-Cookie':this.createSession(request, u.id)});
        }
        const phone = normalize(x.phone), email = String(x.email || '').trim().toLowerCase(), name = String(x.name || '').trim(), owner = String(x.owner || '').trim(), password = String(x.password || '');
        const whatsapp = String(x.whatsapp || '').replace(/^@/, '');
        if (!/^09\d{9}$/.test(phone) || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254 || password.length < 8 || password.length > 256 || !name || name.length > 60 || !owner || owner.length > 60 || (whatsapp && !/^[a-zA-Z0-9_.]{3,40}$/.test(whatsapp))) throw new InputError('شماره، ایمیل، نام و رمز حداقل ۸ کاراکتری را صحیح وارد کنید.');
        const salt = randomBytes(16).toString('hex'), hash = (await derive(password, salt, 64)).toString('hex'), id = crypto.randomUUID();
        const b = {id,name,owner,city:String(x.city || 'سراسر ایران').slice(0,80),whatsapp,description:String(x.description || '').slice(0,300),offers:{}};
        // The uniqueness check and both inserts are one synchronous transaction, including concurrent registrations.
        this.ctx.storage.transactionSync(() => {
          if (this.first('SELECT id FROM users WHERE phone=? OR email=?', phone, email) || this.first('SELECT id FROM booths WHERE name=?', name)) throw new InputError('شماره، ایمیل یا نام غرفه قبلاً ثبت شده است.', 409);
          this.sql.exec('INSERT INTO users VALUES (?, ?, ?, ?, ?)', id, phone, email, salt, hash);
          this.sql.exec('INSERT INTO booths VALUES (?, ?, ?)', id, name, JSON.stringify(b));
        });
        return json({id}, 201, {'Set-Cookie':this.createSession(request, id)});
      }
      if (path === '/api/booth' && request.method === 'PUT') {
        const user = this.account(request);
        if (!user) return json({error:'ابتدا وارد حساب شوید.'}, 401);
        const x = await readBody(request);
        if (x.id !== user.id) return json({error:'فقط غرفه خودتان قابل ویرایش است.'}, 403);
        const b = JSON.parse(this.first('SELECT data FROM booths WHERE id=?', user.id).data);
        const name = String(x.name || '').trim(), whatsapp = String(x.whatsapp || '').replace(/^@/, '');
        if (!name || name.length > 60 || this.first('SELECT id FROM booths WHERE name=? AND id<>?', name, user.id) || (whatsapp && !/^[a-zA-Z0-9_.]{3,40}$/.test(whatsapp))) throw new InputError('نام غرفه یا واتساپ معتبر نیست.');
        if (!x.offers || Array.isArray(x.offers) || typeof x.offers !== 'object') throw new InputError('محصولات معتبر نیستند.');
        const offers = {};
        for (const [id, o] of Object.entries(x.offers)) {
          if (!productIds.has(id) || !o || !Number.isInteger(o.price) || o.price < 1 || o.price > 1e9 || !Number.isInteger(o.discount) || o.discount < 0 || o.discount > 99) throw new InputError('قیمت یا تخفیف معتبر نیست.');
          offers[id] = {price:o.price,discount:o.discount};
        }
        Object.assign(b, {name,whatsapp,description:String(x.description || '').slice(0,300),offers});
        this.sql.exec('UPDATE booths SET name=?, data=? WHERE id=?', name, JSON.stringify(b), user.id);
        return json({ok:true});
      }
      return json({error:'مسیر پیدا نشد.'}, 404);
    } catch (e) {
      return json({error:e instanceof InputError ? e.message : 'درخواست انجام نشد.'}, e instanceof InputError ? e.status : 500);
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'www.mlmsale.ir' || (url.hostname === 'mlmsale.ir' && url.protocol === 'http:')) {
      url.hostname = 'mlmsale.ir'; url.protocol = 'https:';
      return Response.redirect(url.toString(), 308);
    }
    if (url.pathname === '/index.html' || (url.pathname.length > 1 && url.pathname.endsWith('/'))) {
      url.pathname = url.pathname === '/index.html' ? '/' : url.pathname.replace(/\/+$/, '');
      return Response.redirect(url.toString(), 301);
    }
    let response;
    if (url.pathname === '/products.json' && ['GET','HEAD'].includes(request.method)) response = json(products.map(({id,company,category,name,image,price,url,seo})=>({id,company,category,name,image,price,url,seo})));
    else if (/^\/api\/product\/\d+$/.test(url.pathname) && ['GET','HEAD'].includes(request.method)) {
      const product=products.find(p=>p.id===Number(url.pathname.split('/').pop()));
      response=product?json(product):json({error:'محصول پیدا نشد.'},404);
    }
    else if (url.pathname.startsWith('/api/') || !/\.[^/]+$/.test(url.pathname) || ['/robots.txt','/sitemap.xml'].includes(url.pathname)) response = await env.MARKET.get(env.MARKET.idFromName('catalog-v1')).fetch(request);
    else response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    headers.set('X-Frame-Options', 'DENY');
    if (url.protocol === 'https:') headers.set('Strict-Transport-Security', 'max-age=31536000');
    if (url.origin !== env.PUBLIC_SITE_URL) headers.set('X-Robots-Tag', 'noindex, follow');
    return new Response(request.method === 'HEAD' ? null : response.body, {status:response.status, headers});
  }
};
