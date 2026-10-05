# MLM Sale — بازار محصولات آریا

نسخه Cloudflare Workers سایت محصولات و غرفه‌های مستقل آریا. صفحات محصول و دسته‌بندی در سرور تولید می‌شوند؛ قیمت و تخفیف در غرفه فروشنده نمایش داده می‌شود. انتخاب چند محصول یک پیام آماده واتساپ می‌سازد؛ ارسال پیام یا باز کردن واتساپ به معنی تأیید سفارش نیست.

## تنظیمات Cloudflare — Setup your application

نام Worker باید دقیقاً `mlmsale` باشد و Root directory ریشه همین ریپو باشد.

| فیلد | مقدار |
|---|---|
| Project / Worker name | `mlmsale` |
| Build command | `npm run build` |
| Deploy command | `npm run deploy` |
| Preview deploy command | `npm run preview` |

`npm run build` اعتبار ورودی‌ها و تصاویر را بررسی می‌کند و بسته Worker را با Wrangler به صورت dry-run می‌سازد. خروجی `dist` فایل عمومی سایت نیست و نباید به جای Worker به عنوان سایت استاتیک منتشر شود.

محیط preview یک Worker مستقل به نام `mlmsale-preview` با ذخیره‌سازی جداست و noindex دارد. فرمان preview عمداً آن Worker را deploy می‌کند تا migration اولیه فضای پایدار هم انجام شود. حساب‌ها و نشست‌های واقعی در پیش‌نمایش کپی نمی‌شوند.

## فعال کردن حساب مدیر — یک بار

در Cloudflare، در Worker اصلی: Settings → Variables and Secrets، یک **Secret** با نام `OWNER_ACCOUNT_JSON` اضافه کنید. مقدار آن از فایل خصوصی محلی `.owner-account.secret.json` تهیه شده است. این فایل در GitHub، assets یا build وجود ندارد و نباید آنجا آپلود شود. مقدار شامل شناسه و اطلاعات ورود با هش scrypt است؛ رمز خام در آن نیست.

پس از افزودن Secret یک deployment جدید انجام دهید. حساب مدیر هنگام راه‌اندازی فضای ذخیره‌سازی وارد می‌شود. دفعات بعد، حساب موجود و ویرایش‌های غرفه بازنویسی نمی‌شوند. تا فعال شدن حساب مدیر، ثبت‌نام و ورود پاسخ راه‌اندازی‌نشده می‌دهند؛ صفحات و غرفه عمومی قابل مشاهده‌اند.

در صورت استفاده از CLI و پس از `npx wrangler login`، این کار را از پوشه پروژه در PowerShell انجام دهید:

```powershell
Get-Content -LiteralPath .owner-account.secret.json -Raw | npx wrangler secret put OWNER_ACCOUNT_JSON --env ""
npm run deploy
```

Secret را به عنوان Build variable اضافه نکنید؛ این یک **runtime secret** است. فایل واقعی فقط در دستگاه صاحب پروژه نگه داشته می‌شود. حساب جدیدی با نام یا شماره مدیر نسازید. حساب‌ها در این نسخه تأیید ایمیل/OTP و بازیابی رمز خودکار ندارند.

## اتصال دامنه

پس از فعال شدن zone دامنه در Cloudflare، در Settings → Domains & Routes → Add → Custom Domain، هر دو دامنه `mlmsale.ir` و `www.mlmsale.ir` را به Worker اصلی متصل کنید. کد www را به HTTPS دامنه اصلی منتقل می‌کند. دامنه اصلی canonical و sitemap است؛ آدرس‌های workers.dev و preview از ایندکس شدن جلوگیری می‌کنند.

## اجرا و آزمون

```sh
npm ci
npm run build
npm test
npm run dev
```

ورود محلی به Secret محلی در `.dev.vars` نیاز دارد؛ فایل‌های `.dev.vars` در Git نادیده گرفته می‌شوند. آزمون‌ها از حساب ساختگی مخصوص تست و فضای ذخیره موقت استفاده می‌کنند، نه حساب واقعی.

آزمون integration در runtime workerd شامل صفحات ۱۶ محصول، canonical/robots/404، ورود و cookie امن، عدم افشای اطلاعات خصوصی، ثبت‌نام و تکراری بودن حساب، مالکیت غرفه، قیمت/تخفیف، خروج و ماندگاری بعد از راه‌اندازی مجدد است. این آزمون جای بررسی deployment واقعی و مرورگر موبایل را نمی‌گیرد.

## ذخیره اطلاعات

`Marketplace` یک SQLite-backed Durable Object است. migration و binding در `wrangler.jsonc` تعریف شده‌اند و در deploy ایجاد می‌شوند؛ نیازی به شناسه D1 یا فایل حساب عمومی نیست. اطلاعات ورود و هش نشست‌ها فقط در این فضای خصوصی ذخیره می‌شوند. غرفه‌های عمومی جدا از اطلاعات حساب پاسخ داده می‌شوند.

نام class، binding و `idFromName('catalog-v1')` را بدون برنامه انتقال داده عوض نکنید. غرفه اولیه فقط یک بار وارد می‌شود؛ تغییر قیمت با deploy مجدد پاک نمی‌شود. برای رشد بزرگ‌تر، تفکیک بار و سازوکار پشتیبان‌گیری باید جداگانه بررسی شود.

## محدودیت داده محصول

توضیحات و قیمت‌های اولیه از سایت سازنده استخراج شده‌اند و موجودی/قیمت روز یا اثر درمانی مستقلاً تأیید نشده‌اند. برخی پس‌زمینه‌های ترکیبات با AI ویرایش شده‌اند و عکس اصیل بسته‌بندی محسوب نمی‌شوند. قبل از تبلیغ و فروش عمومی، این موارد را با فروشنده و بسته‌بندی واقعی تطبیق دهید. مسیر رشد جست‌وجو مطابق `SEARCH-GROWTH.md` است؛ رتبه یا فروش تضمینی ادعا نمی‌شود.

مراجع فنی: [Workers assets](https://developers.cloudflare.com/workers/static-assets/binding/)، [SQLite storage](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/)، [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).
