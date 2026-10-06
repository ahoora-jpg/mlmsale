import {readFile,access} from 'node:fs/promises';
const catalog=[...JSON.parse(await readFile('src/products.json','utf8')),...JSON.parse(await readFile('src/extra-products.json','utf8'))];
for(const p of catalog){await access('public/'+p.image);if(p.usageImage)await access('public/'+p.usageImage);}
const companies=JSON.parse(await readFile('src/companies.json','utf8'));for(const c of companies)if(c.logo)await access('public'+c.logo);
const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));
if(config.name!=='mlmsale'||config.assets.directory!=='./public')throw Error('Invalid deployment config');
for(const p of ['src/worker.js','src/seo.js','public/app.js','public/style.css'])await access(p);
console.log(`Build inputs verified: ${catalog.length} products and their image assets.`);
