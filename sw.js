const CACHE_NAME = 'Grandmashop-pos-v75'; // เปลี่ยนเลข v เมื่อมีการอัปเดตไฟล์
const ASSETS_TO_CACHE = [
  './',
  './Standalone.html',
  './Standalone.js',
  './Grandmashop.json',
  'qrcode.min.js',
  './Standalone.css',
  './icon-192.png',
  './icon-512.png',
  './screenshot-mobile_1.png',
  './screenshot-mobile_2.png',
  /* ใส่ชื่อไฟล์ CSS หรือรูปภาพอื่นๆ ที่เพื่อนมีทั้งหมดไว้ที่นี่ */
];

// 1. ขั้นตอนติดตั้ง: เก็บไฟล์ลง Cache ทันที
self.addEventListener('install', (event) => {
  self.skipWaiting(); // 🔥 บังคับให้ Service Worker ตัวใหม่ทำงานทันที ไม่ต้องรอปิดแอปก่อน
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('กำลังเก็บเสบียงเวอร์ชั่นใหม่ลงเครื่อง...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. ขั้นตอนทำลายอดีต: ล้าง Cache เก่าทิ้งเมื่อมีการอัปเดต (สำคัญมาก!)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // ถ้าชื่อ Cache ในเครื่อง ไม่ตรงกับ CACHE_NAME ปัจจุบัน... ลบทิ้งทันที!
          if (cacheName !== CACHE_NAME) {
            console.log('ล้าง Cache เก่าออกแล้ว:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // 🔥 บังคับให้ทุกหน้าเว็บเปลี่ยนมาใช้ SW ตัวใหม่ทันที
  );
});

// 3. ขั้นตอนเรียกใช้: ถ้าไม่มีเน็ต ให้ดึงจาก Cache มาโชว์
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});