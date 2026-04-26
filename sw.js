const CACHE_NAME = 'Grandmashop-pos-v63'; // เปลี่ยนเลข v เมื่อมีการอัปเดตไฟล์
const ASSETS_TO_CACHE = [
  './',
  './Standalone.html',
  './Standalone.js',
  './Grandmashop.json',
  './dexie.js',           /* ไฟล์ Library ที่เพื่อนโหลดมาเก็บไว้เอง */
  './bgApp.jpg',   /* ชื่อไฟล์รูป BG ของเพื่อน */
  './Standalone.css',
  './icon-192.png',
  './icon-512.png',
  './screenshot-mobile_1',
  './screenshot-mobile_2',
  /* ใส่ชื่อไฟล์ CSS หรือรูปภาพอื่นๆ ที่เพื่อนมีทั้งหมดไว้ที่นี่ */
];

// 1. ขั้นตอนติดตั้ง: เก็บไฟล์ลง Cache ทันที
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('กำลังเก็บเสบียงลงเครื่อง...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. ขั้นตอนเรียกใช้: ถ้าไม่มีเน็ต ให้ดึงจาก Cache มาโชว์
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // ถ้าเจอใน Cache ให้ส่งไฟล์นั้นไปเลย ถ้าไม่เจอค่อยไปโหลดจากเน็ต
      return response || fetch(event.request);
    })
  );
});