# Cloudflare Worker — Notion API Proxy

## วิธี Deploy (ทำครั้งเดียว)

1. ไปที่ https://workers.cloudflare.com → สมัครฟรี
2. กด **Create a Worker** → แทนที่ code ด้วยไฟล์ `worker.js` นี้
3. กด **Deploy**
4. ไปที่ **Settings → Variables** → เพิ่ม:
   - `NOTION_TOKEN` = `ntn_c28063144993...` (Notion API token)
   - `ALLOWED_ORIGIN` = URL ของ GitHub Pages เว็บ Dashboard (เช่น `https://oatwittayanan.github.io`)
5. copy URL ของ Worker (เช่น `https://oat-notion-proxy.xxx.workers.dev`)
6. ใส่ URL นั้นในไฟล์ `app.js` บรรทัด `API_BASE`

## ค่าใช้จ่าย
ฟรี 100,000 requests/วัน เกินพอสำหรับ personal use
