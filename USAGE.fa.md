# راهنمای استفاده از Worker دیپلوی‌شده

آدرس Worker:

```
https://edcloudwasm.gavimovado.workers.dev
```

این Worker یک **ورودی پروکسی** است (VLESS / Trojan / Shadowsocks / SOCKS5 / HTTP) با ترنسپورت
**WebSocket** (و xHTTP/gRPC). چون هیچ کلاینت بدون‌تنظیمی ندارد، باید در اپ کلاینت به‌صورت دستی
یا با لینک کانفیگ اضافه شود.

> ⚠️ HTTP 404 روی ریشه‌ی دامنه طبیعی است: این Worker فقط درخواست WebSocket و gRPC را می‌پذیرد.

---

## ۱. پارامترهای اتصال (از `wrangler.toml`)

| مورد | مقدار |
| --- | --- |
| آدرس (Address) | `edcloudwasm.gavimovado.workers.dev` |
| پورت (Port) | `443` |
| TLS / SNI | روشن، `edcloudwasm.gavimovado.workers.dev` |
| مسیر (Path) | `/` |
| Host | `edcloudwasm.gavimovado.workers.dev` |
| UUID (VLESS) | `d342d11e-d424-4583-b36e-524ab1f0afa4` |
| Password (Trojan) | `666` |
| SS 密码 | `666` (روش `aes-128-gcm`) |
| SOCKS5/HTTP user:pass | `admin` : `123456` |

> 🔴 این‌ها مقادیر پیش‌فرضِ عمومی پروژه‌اند. قبل از استفاده‌ی جدی عوضشان کنید (پایین را ببینید).

---

## ۲. لینک‌های آماده

### VLESS + WebSocket + TLS

```
vless://d342d11e-d424-4583-b36e-524ab1f0afa4@edcloudwasm.gavimovado.workers.dev:443?encryption=none&security=tls&sni=edcloudwasm.gavimovado.workers.dev&fp=randomized&type=ws&host=edcloudwasm.gavimovado.workers.dev&path=%2F#edunia-EdgeTunnel
```

### Trojan + WebSocket + TLS

```
trojan://666@edcloudwasm.gavimovado.workers.dev:443?security=tls&sni=edcloudwasm.gavimovado.workers.dev&fp=randomized&type=ws&host=edcloudwasm.gavimovado.workers.dev&path=%2F#edunia-Trojan
```

### Shadowsocks (aes-128-gcm) + WebSocket + TLS

```
ss://YWVzLTEyOC1nY206NjY2@edcloudwasm.gavimovado.workers.dev:443?plugin=v2ray-plugin%3Btls%3Bhost%3Dedcloudwasm.gavimovado.workers.dev%3Bpath%3D%2F#edunia-SS
```

> اگر کلاینت شما v2ray-plugin ندارد، همان کانفیگ VLESS را استفاده کنید (ساده‌ترین و مطمئن‌ترین).

---

## ۳. اپ‌های پیشنهادی

| سیستم | اپ | نحوه‌ی افزودن |
| --- | --- | --- |
| Android | v2rayNG | کپی لینک `vless://` → داخل اپ: «Import config from clipboard» |
| iOS | Streisand / Shadowrocket / V2Box | افزودن از کلیپ‌بورد یا اسکن QR |
| Windows | v2rayN / NekoRay | Import from clipboard |
| macOS | V2Box / Streisand | Import from clipboard |
| کلاینت‌های Clash (Meta) | Clash Verge / FlClash | کانفیگ YAML پایین را در پوشه‌ی profiles بگذارید |

### کانفیگ Clash Meta (YAML)

```yaml
mixed-port: 7890
allow-lan: false
mode: rule
log-level: info

proxies:
  - name: edunia-EdgeTunnel
    type: vless
    server: edcloudwasm.gavimovado.workers.dev
    port: 443
    uuid: d342d11e-d424-4583-b36e-524ab1f0afa4
    network: ws
    tls: true
    udp: true
    servername: edcloudwasm.gavimovado.workers.dev
    client-fingerprint: randomized
    ws-opts:
      path: /
      headers:
        Host: edcloudwasm.gavimovado.workers.dev

proxy-groups:
  - name: PROXY
    type: select
    proxies:
      - edunia-EdgeTunnel
      - DIRECT

rules:
  - GEOIP,IR,DIRECT
  - MATCH,PROXY
```

---

## ۴. قدم اول: امن کردن اعتبارنامه‌ها

فایل `wrangler.toml` را ویرایش کنید (بخش `[vars]`) و مقادیر را عوض کنید؛ سپس دیپلوی کنید:

```bash
# UUID جدید
uuidgen                       # macOS/Linux
python3 -c "import uuid;print(uuid.uuid4())"
```

- `UUID` → UUID تازه
- `PASSWORD` → رمز قوی برای Trojan
- `SSPASS` → رمز قوی برای Shadowsocks
- `S5HTTPUSER` / `S5HTTPPASS` → یوزر/پس قوی

بعد از تغییر، یکی از این دو کار:

1. push به `main` (دیپلوی خودکار)، یا
2. اجرای دستی: Actions → **Deploy to Cloudflare Workers** → Run workflow

اگر می‌خواهید رمزها در گیت ذخیره نشوند، آن‌ها را از `wrangler.toml` حذف کنید و در
Cloudflare Dashboard → Worker → **Settings → Variables and Secrets** ثبت کنید (نوع Secret).
توجه: `keep_vars = true` در `wrangler.toml` باعث می‌شود دیپلوی‌های بعدی متغیرهای داشبورد را پاک نکنند.

---

## ۵. تست سلامت از سمت خودتان

```bash
# ۱) باید 404 بدهد (طبیعی است)
curl -s -o /dev/null -w "%{http_code}\n" https://edcloudwasm.gavimovado.workers.dev

# ۲) دست‌دادن WebSocket: در حالت عادی 101 یا خطای handshake، ولی نه تایم‌اوت
#    (ساده‌ترین راه: همان لینک vless:// را در اپ اضافه کنید و یک سایت باز کنید)
```

اگر در اپ وصل نشد: مسیر را `/` و پورت را `443` با TLS بررسی کنید؛ `Host` باید همان دامنه‌ی
`workers.dev` باشد (نه دامنه‌ی مقصد).

---

## ۶. چند Worker برای چند کاربر

برای جدا کردن اعتبارنامه‌ها، `name` در `wrangler.toml` را عوض کنید (مثلاً `edcloudwasm2`) و
دوباره دیپلوی کنید؛ آدرس جدید `https://<name>.<subdomain>.workers.dev` می‌شود.
