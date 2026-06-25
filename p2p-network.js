/* 
========================================================================
   ระบบ P2P Network - ร้านยายขายทุกอย่าง
   อัปเดตล่าสุด: 12-05-2026 
========================================================================
*/

window.peer = window.peer || null;
window.currentConn = window.currentConn || null; // ปักหมุดท่อวาร์ปไว้ที่กระดานกลางของเบราว์เซอร์
window.connections = window.connections || [];   // รายชื่อเครื่องที่มาต่อกับแม่

// --- 2. [ส่วนที่เพิ่มใหม่]: ฟังก์ชันเชื่อมต่อพร้อมระบบกันท่อหลุด 15-05-2026 ---

/**
 * 🚀 ฟังก์ชันเชื่อมต่อสถานีแม่ พร้อมระบบวาร์ปหน้าจอตามบทบาท
 * อัปเดต: เพิ่มการเช็คคลาสที่ Body เพื่อเปิดหน้าครัวอัตโนมัติ 24-06-2026
 */
function connectToHub(targetId) {
    // 🛡️ ป้องกันการเชื่อมต่อแบบไร้จุดหมาย
    if (!targetId) {
        console.error("❌ [P2P] ไม่สามารถเชื่อมต่อได้: ไม่พบไอดีเป้าหมาย");
        return;
    }

    // 🧠 [จดสมุดถาวร]: บันทึกไอดีแม่ลง localStorage ทุกครั้งที่พยายามเชื่อมต่อ
    // เพื่อให้ตอนเครื่องตื่นจาก Sleep หรือเปิดเบราว์เซอร์ใหม่ ระบบจะรู้วันนี้ต้องไปหาใคร
    localStorage.setItem('last_hub_peer_id', targetId);

    console.log(`🚀 [P2P] กำลังพยายามวาร์ปไปที่ไอดี: ${targetId}`);
    
    // 🛡️ [Security Check]: ทำลายการเชื่อมต่อเก่าทิ้งก่อนเริ่มใหม่ เพื่อป้องกัน "ท่อซ้อนท่อ"
    if (window.currentConn && !window.currentConn.open) {
        try { window.currentConn.close(); } catch(e) {}
    }

    // 1. สร้างการเชื่อมต่อ
    window.currentConn = window.peer.connect(targetId, { reliable: true });

    // --- [A]: เมื่อท่อวาร์ปเปิดใช้งานสำเร็จ ---
    window.currentConn.on('open', () => {
        console.log("✅ [P2P] เชื่อมต่อเครื่องแม่สำเร็จ!");

        // 🚩 [Kitchen Mode]: ปรับแต่งหน้าจอตามบทบาท
        if (document.body.classList.contains('kitchen-mode')) {
            console.log("👨‍🍳 [Warp] ตรวจพบโหมดครัว กำลังเตรียมหน้าจอ...");
            
            if (typeof showKitchen === 'function') showKitchen();
            if (typeof applyKitchenLogic === 'function') applyKitchenLogic();
            if (typeof renderKitchenOrders === 'function') renderKitchenOrders();
        }

        // อัปเดต UI จุดสถานะ
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');
        if (statusDot) statusDot.style.backgroundColor = '#2ecc71'; 
        if (statusText) statusText.innerText = 'เชื่อมต่อแม่สำเร็จ';

        // 🌟 [Sync Trigger]: สั่งตื่นมาทวงออเดอร์ค้างส่งทันที
        if (typeof triggerBackgroundSync === 'function') {
            triggerBackgroundSync();
        }
    });

    // --- [B]: เมื่อได้รับข้อมูลวาร์ปมาจากเครื่องแม่ ---
    window.currentConn.on('data', (data) => {
        if (typeof handleIncomingData === 'function') {
            handleIncomingData(data);
        } else {
            console.warn("⚠️ [P2P] ได้รับข้อมูล แต่ไม่พบฟังก์ชัน handleIncomingData");
        }
    });

    // --- [C]: เมื่อท่อหลุด (ระบบ Auto Reconnect) ---
    window.currentConn.on('close', () => {
        console.warn("⚠️ [P2P] ท่อวาร์ปขาดช่วง! กำลังพยายามวาร์ปใหม่ใน 3 วินาที...");
        
        const statusDot = document.getElementById('status-dot');
        if (statusDot) statusDot.style.backgroundColor = '#e74c3c'; 

        setTimeout(() => {
            // เช็กสถานะ Peer ว่ายังอยู่ดีไหมก่อนต่อใหม่
            if (window.peer && !window.peer.destroyed) {
                connectToHub(targetId);
            }
        }, 3000);
    });

    // --- [D]: กรณีเกิด Error ---
    window.currentConn.on('error', (err) => {
        console.error("❌ [P2P] ท่อมีปัญหา:", err);
    });
}


/**
 * 👁️ [Centralized Identity Detector] ตัวตรวจจับและรายงานบทบาทปัจจุบันของเครื่อง
 * ปรับปรุงล่าสุด: 2026-05-28 | ออกแบบมาสำหรับระบบ Single Codebase เพื่อแก้ปัญหาลูปเวลาของโหมดครัว
 */
function getCurrentIdentity() {
    // 🍳 1. เช็กสิทธิ์ความชัวร์ทางกายภาพจากหน้าจอครัว หรือคลาสบน Body
    const kitchenScreen = document.getElementById('kitchen-screen');
    const isKitchenViewActive = kitchenScreen && kitchenScreen.offsetParent !== null;
    
    if (isKitchenViewActive || document.body.classList.contains('kitchen-mode')) {
        console.log("🟢 [Identity Detector] รายงานสถานะ: 'kitchen' (ตรวจเจอจากหน้าจอ/คลาสจริง)");
        return 'kitchen';
    }

    // 👑 2. เช็กสิทธิ์เครื่องแม่จากคลาสประจำการบน Body
    if (document.body.classList.contains('boss-mode')) {
        console.log("🔴 [Identity Detector] รายงานสถานะ: 'hub' (เครื่องแม่ศููนย์กลาง)");
        return 'hub'; 
    }

    // 📱 3. เช็กสิทธิ์เครื่องลูกจากคลาสประจำการบน Body
    if (document.body.classList.contains('baby-mode')) {
        console.log("🔵 [Identity Detector] รายงานสถานะ: 'client' (เครื่องลูกหน้าร้าน)");
        return 'client';
    }

    // 🎯 4. [จุดแก้ไขทางการ - ป้องกันสวิตช์เครือข่ายดีดกลับ]: 
    // ดักจับจังหวะ "รอยต่อของเวลา" ขณะพนักงานกดปุ่มสีเหลืองส้มโหมดครัวแต่หน้าจอยังวาร์ปขึ้นมาไม่ทัน
    // จะเกิดอะไรขึ้น: ระบบจะส่องเข้าไปตรวจสอบค่าในกล่องพิมพ์ ID (Input) ของครัวทันที
    const shopIdInput = document.getElementById('shop-id-input');
    if (shopIdInput && shopIdInput.value.trim() !== "") {
        console.log("%c🎯 [Identity Detector Fix] รายงานสถานะพิเศษ: 'kitchen' (ตรวจพบข้อมูลพร้อมวาร์ปใน Input)", "color: #f39c12; font-weight: bold;");
        return 'kitchen';
    }

    // 🏠 5. หากไม่ตรงเงื่อนไขด้านบนเลย แสดงว่าเป็นเครื่องโหมดปกติทั่วไป
    console.log("⚪ [Identity Detector] รายงานสถานะ: 'single' (โหมดเครื่องเดี่ยว Standalone)");
    return 'single';
}

// --- ฟังก์ชันหลักของระบบ Peer ---

/**
 * ฟังก์ชันสำหรับ "ดักฟัง" ข้อมูลที่วาร์ปผ่านการเชื่อมต่อ (Connection) 12-05-2026
 * [หน้าที่]: แยกแยะประเภทข้อมูล (ออเดอร์/การตอบกลับ) และสั่งงานให้ตรงตามบทบาทของเครื่องนั้นๆ
 */
/**
 * 📡 ฟังก์ชันจัดการ Event การเชื่อมต่อ P2P
 * ปรับปรุง: ลด Logic ซ้อนทับ เพื่อให้ข้อมูลไหลไปหา handleIncomingData ได้ 100%
 */
function setupConnListeners(conn) {
    // =========================================================================
    // 🛡️ [จุดปรับปรุงวิกฤต - ป้องกันท่อซ้อน]: ล้างสัญญาณฝังใจเก่าทิ้งก่อน (Anti-Duplicate Guard)
    // อธิบาย: เนื่องจากใช้ Single Codebase บางครั้งวัตถุ conn ตัวเดิมอาจถูกส่งเข้ามาผูกซ้ำ 
    // หากไม่สั่งล้าง .off() ออกก่อน ฟังก์ชันด้านล่างจะรันเบิ้ลตามจำนวนครั้งที่เรียก
    // =========================================================================
    if (conn && typeof conn.off === 'function') {
        conn.off('data');  // ล้างตัวดักรับข้อมูลเก่าทั้งหมดบนท่อเส้นนี้
        conn.off('close'); // ล้างตัวดักตรวจสายหลุดเก่าทั้งหมดบนท่อเส้นนี้
        conn.off('error'); // ล้างตัวดักจัดการ Error เก่าทั้งหมดบนท่อเส้นนี้
    }

    // 🚩 [ปักหมุดสืบสวน]: แสดงข้อความสีม่วงหนา เพื่อส่องดูว่าฟังก์ชันนี้ทำงานตอนไหนบ้าง
    console.log(`%c🔗 [Setup Listeners] เปิดระบบดักรับสัญญาณเรียบร้อยสำหรับคู่สาย: ${conn.peer}`, "color: #9b59b6; font-weight: bold; font-size: 1.05rem;");
    console.trace("🔍 [Trace Path] เส้นทางที่สั่งให้ฟังก์ชันนี้ทำงานมาจากตรงนี้:"); 
    // =========================================================================

    // 1. [Event]: เมื่อมีข้อมูล (Data) วาร์ปเข้ามา
    conn.on('data', function(data) {
        console.log("%c📩 [P2P Incoming]", "color: #00ff00; font-weight: bold;", "จาก:", conn.peer, data);

        // ตรวจสอบความถูกต้องพื้นฐานของก้อนข้อมูล
        if (!data || !data.type) return;

        /**
         * 🚩 [จุดตัดสินใจ]: เช็คตัวตนด้วย Identity Detector
         * ใช้ getCurrentIdentity() แทน localStorage เพื่อความแม่นยำตาม Class ของ Body
         */
        const identity = typeof getCurrentIdentity === 'function' ? getCurrentIdentity() : 'none';

        /**
         * 🔥 [การปรับปรุงสำคัญ]:
         * เราจะไม่ดัก 'isPayment' เพื่อลบออเดอร์ในชั้นนี้แล้ว
         * เพราะออเดอร์ที่วาร์ปมามักมี isPayment: true ติดมาเสมอ
         * การ return ทิ้งตรงนี้จะทำให้เครื่องครัวไม่ยอมวาดตั๋วอาหาร
         */

        // ส่งต่อไปยังจุดตัดสินใจกลาง (Centralized Logic)
        if (typeof handleIncomingData === 'function') {
            handleIncomingData(data);
        } else {
            console.error("❌ ระบบขัดข้อง: หาฟังก์ชัน handleIncomingData ไม่เจอ");
        }
    });

    // 2. [Event]: เมื่อการเชื่อมต่อสิ้นสุดลง (Disconnected)
    conn.on('close', function() {
        console.warn(`🔴 [P2P] การเชื่อมต่อกับ [${conn.peer}] ถูกตัดขาด`);
        
        const identity = typeof getCurrentIdentity === 'function' ? getCurrentIdentity() : 'none';
        
        // แจ้งเตือนสายหลุด (ยกเว้นโหมด Hub ที่มักจะมีลูกทีมเข้าๆ ออกๆ ตลอดเวลา)
        if (identity !== 'hub' && identity !== 'none') {
            const statusText = document.getElementById('status-text');
            if (statusText) {
                statusText.innerText = "❌ ขาดการเชื่อมต่อ";
                statusText.style.color = "#e74c3c";
                statusText.style.fontWeight = "bold";
            }
        }
    });

    // 3. [Event]: เมื่อเกิดข้อผิดพลาดเชิงเทคนิค
    conn.on('error', function(err) {
        console.error(`⚠️ [P2P Error] ท่อเชื่อมต่อ [${conn.peer}] ขัดข้อง:`, err);
    });
}



function setupPeerListeners() {
    if (!peer) return;

    peer.on('open', (id) => {
        console.log('✅ ระบบ P2P พร้อมใช้งาน ID: ' + id);
    });

    peer.on('error', (err) => {
        console.error('❌ เกิดข้อผิดพลาด: ' + err.type);
        alert('ระบบเชื่อมต่อมีปัญหา: ' + err.type);
    });

    peer.on('connection', (conn) => {
        currentConn = conn;
        console.log("🔗 มีเครื่องอื่นมาเชื่อมต่อกับเราแล้ว!");
        
        currentConn.on('data', (data) => {
            handleIncomingData(data);
        });
    });
}



/**
 * 🚀 ฟังก์ชันหลักจัดการข้อมูล P2P (Single Codebase สำหรับทุกเครื่อง)
 * 28-05-2026
 */
window.currentlyProcessing = window.currentlyProcessing || new Set();
window.processedOrderIds = window.processedOrderIds || new Set();

// 🧠 ✨ [ฟังก์ชันสร้างกล่อง Pop-up แจ้งเตือนอาหารเสร็จบนหน้าจอ พร้อมเสียงใสๆ] ✨
// สิ่งที่จะเกิดขึ้น: สร้างกล่องสีเขียวขอบทองสว่าง แอนิเมชันสไลด์นุ่มนวลจากด้านขวาของหน้าจอ นาน 6 วินาทีแล้วทำลายตัวเองทิ้งอัตโนมัติ
function renderKitchenToastAlert(data) {
    // =========================================================================
    // จุดที่ 1 & 2: ค้นหาหรือสร้าง Container หลักมุมจอ โดยมอบสไตล์ให้ CSS ดูแลสากล
    // =========================================================================
    let container = document.getElementById('kitchen-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'kitchen-toast-container'; // 🟢 ดึงโครงสร้างและความงามผ่าน CSS ID Selector ทันที
        document.body.appendChild(container);
    }

    // =========================================================================
    // จุดที่ 3: ลอจิกการแกะข้อมูลชื่อเมนูและชื่อโต๊ะ 3 ชั้น (Layered Fallback คงเดิมเป๊ะ)
    // =========================================================================
    const tableName = data.table || "ไม่ระบุโต๊ะ";
    let detectedFoodName = data.menuName || data.itemName || data.name || null;

    if (!detectedFoodName && data.orderId && data.itemId) {
        const rowId = `item-row-${data.orderId}-${data.itemId}`;
        const targetRow = document.getElementById(rowId);
        
        if (targetRow) {
            const menuNameElement = targetRow.querySelector('.menu-name') || targetRow.querySelector('.item-name') || targetRow;
            if (menuNameElement) {
                detectedFoodName = menuNameElement.textContent.replace(/ทำเสร็จ|เสร็จแล้ว|✔|❌/g, '').trim();
                console.log(`🔍 [Toast Finder] สืบพบชื่อเมนูจริงจากหน้าจอสำเร็จ: "${detectedFoodName}"`);
            }
        }
    }

    const foodName = detectedFoodName ? `🔥 ${detectedFoodName}` : "🍳 อาหารจานอร่อย";

    // =========================================================================
    // จุดที่ 4: ประกอบร่างหน้าตาการ์ดแจ้งเตือน (UI Card ขาวสะอาด ปลอดอินไลน์สไตล์)
    // =========================================================================
    const toast = document.createElement('div');
    toast.className = "kitchen-toast-card"; // 🟢 สวมคลาสหลักเพื่อโหลดดีไซน์และแอนิเมชันขาเข้าสากล

    toast.innerHTML = `
        <div class="toast-header">🔔 อาหารทำเสร็จแล้วจ้า!</div>
        <div class="toast-body-food">${foodName}</div>
        <div class="toast-footer-meta">
            <span>📍 พิกัด: <strong class="meta-table-lbl">[${tableName}]</strong></span>
            <span class="meta-time-lbl">⏰ ${new Date().toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}</span>
        </div>
    `;

    // =========================================================================
    // จุดที่ 5: 🔊 ระบบสั่นกระดิ่งไฟฟ้าอิเล็กทรอนิกส์ประสานเสียง (คงความเที่ยงตรงเพียวลอจิก)
    // =========================================================================
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        let osc1 = audioCtx.createOscillator();
        let gain1 = audioCtx.createGain();
        osc1.connect(gain1); gain1.connect(audioCtx.destination);
        osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // โน้ต C5
        gain1.gain.setValueAtTime(0.08, audioCtx.currentTime);
        osc1.start(); osc1.stop(audioCtx.currentTime + 0.1);

        setTimeout(() => {
            let osc2 = audioCtx.createOscillator();
            let gain2 = audioCtx.createGain();
            osc2.connect(gain2); gain2.connect(audioCtx.destination);
            osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime); // โน้ต E5
            gain2.gain.setValueAtTime(0.08, audioCtx.currentTime);
            osc2.start(); osc2.stop(audioCtx.currentTime + 0.15);
        }, 100);
    } catch (e) { 
        console.log("ℹ️ [Audio Engine] บราวเซอร์บล็อกการเล่นเสียงแจ้งเตือนอัตโนมัติจนกว่าจะมีการคลิกหน้าจอ"); 
    }

    container.appendChild(toast);

    // =========================================================================
    // จุดที่ 6: ⏳ ระบบเคลียร์ทรัพยากรหน้าจอด้านแอนิเมชันขาออก (สลับคลาสผ่าน CSS)
    // =========================================================================
    setTimeout(() => {
        // 🟢 สั่งสลับสวมคลาสขาออก นุ่มนวล สมูท ปลอดการฝังโค้ดดีไซน์ใน JS
        toast.classList.add('is-leaving');
        
        setTimeout(() => { 
            toast.remove(); 
            // ล้างกลุ่ม Container หลักทิ้งเมื่อหน้าจอว่างเปล่า เพื่อรักษา RAM ของแอปพลิเคชัน
            if (container.children.length === 0) {
                container.remove();
            }
        }, 500); // สอดคล้องตามเวลาแอนิเมชัน 0.5 วินาทีของ CSS
    }, 5500); // ตั้งตระหง่านเด่นชัด 5.5 วินาทีเท่าเดิมตามความตั้งใจพี่
}

/**
 * 🚀 ฟังก์ชันหลักจัดการรับข้อมูล P2P ขาเข้า (ด่านคัดกรองสัญญาณกลางในไฟล์เดี่ยว Single Codebase) 30-05-2026
 */
// =================================================================================
// 🔒 [คลังจำรหัสจานอาหารชั่วคราว]: วางไว้ด้านนอกฟังก์ชัน handleIncomingData (Global Scope)
// อธิบาย: ใช้สำหรับเก็บความจำข้ามมิติเวลา หากท่อส่งแฝด 2 ท่อยิงสัญญาณเข้ามาพร้อมกันในเสี้ยววินาที
// ตัวแปร Set ตัวนี้จะทำหน้าที่เปรียบเทียบรหัสจานอาหารเพื่อสกัดกั้นสัญญาณตัวที่สองทันที
// =================================================================================
const processedItemsCache = new Set();

// =========================================================================
// 🎛️ ฟังก์ชันศูนย์รวมจัดการข้อมูล P2P ขาเข้า (Single Codebase สำหรับทุกเครื่อง)
// =========================================================================
async function handleIncomingData(data) {
    // 🛡️ ป้องกันกรณีข้อมูลว่าง หรือไม่มีการส่งสถานะประเภทสัญญาณเข้ามาในระบบ
    if (!data || !data.type) return;

    const source = data.orderData || data;
    const orderId = source.orderId || data.orderId || Date.now();

    try {
        console.log("%c📡 ข้อมูลเข้า!", "color: yellow; background: black; font-size: 16px;", data);

        // =========================================================================
        // 🛡️ [ด่านสกัดกั้นสัญญาณผีเบิ้ล 2 รอบ]: สำหรับเหตุการณ์ห้องครัวทำเสร็จ (ITEM_DONE)
        // อธิบาย: หากรหัสจานอาหาร (data.itemId) ตัวนี้ เพิ่งวิ่งผ่านประตูเข้ามาเมื่อไม่กี่วินาทีก่อน 
        // ระบบจะสั่งถีบข้อมูลซ้ำนี้กลับทันที ไม่ให้รันโค้ดวาดแจ้งเตือนหรืออัปเดตสถานะซ้ำซ้อนซ้ำสอง
        // =========================================================================
        if (data.type === 'ITEM_DONE' && data.itemId) {
            if (processedItemsCache.has(data.itemId)) {
                console.warn(`🛑 [Anti-Double Trigger Blocked] สกัดสัญญาณเบิ้ลของจาน: ${data.itemId} (เมนู: ${data.menuName || 'ไม่ระบุชื่อ'})`);
                return; // ⛔ ตัดจบกระบวนการทำงานตรงนี้ทันที แจ้งเตือนจะไม่เด้งซ้ำตัวที่สองแน่นอน!
            }

            // หากเป็นจานใหม่ที่เพิ่งมาถึงครั้งแรกของวินาทีนี้ ให้บันทึกรหัสลงคลังจำ
            processedItemsCache.add(data.itemId);

            // ตั้งเวลา 3 วินาที ให้ลบรหัสจานนี้ทิ้ง (เพื่อคืนแรม และเผื่ออนาคตครัวมีการกดเสร็จใหม่อีกรอบจริงๆ)
            setTimeout(() => {
                processedItemsCache.delete(data.itemId);
            }, 3000);
        }

        // 🚩 [Identity Check]: ตรวจสอบร่างปัจจุบัน (Hub/Kitchen/Client) ของอุปกรณ์เครื่องนี้
        const identity = typeof getCurrentIdentity === 'function' ? getCurrentIdentity() : 'single';
        const isHub = (identity === 'hub'); 
        const isKitchen = (identity === 'kitchen');
        const isClient = (identity === 'client');

        // ตรวจสอบสถานะว่าเครื่องนี้เปิดโหมดหน้าจอครัวทิ้งไว้ค้างอยู่บนหน้าจอหลักหรือไม่
        const kitchenScreen = document.getElementById('kitchen-screen');
        const isKitchenViewActive = kitchenScreen && kitchenScreen.offsetParent !== null;

        // =========================================================================
        // 🍳 🚩 [เหตุการณ์ที่ 1: ITEM_DONE] ดักจับสัญญาณขากลับ "ห้องครัวทำเสร็จรายจาน"
        // อธิบาย: ฝั่งครัวกด "ทำเสร็จ" -> วิ่งเข้าเครื่องแม่เพื่ออัปเดต DB และกระจายข่าว (Relay) 
        // ให้เครื่องหน้าร้าน (Client) ส่งเสียงเตือนพนักงานให้เดินไปเสิร์ฟอาหารตามโต๊ะ
        // =========================================================================
        if (data.type === 'ITEM_DONE') {
            console.log(`👨‍🍳 %c[Gate ITEM_DONE] ตรวจพบเมนูทำเสร็จของโต๊ะ: ${data.table} (จานรหัส: ${data.itemId})`, "color: #3498db; font-weight: bold;");

            if (!data.menuName && data.orderId && data.itemId) {
                try {
                    if (typeof window.allOrders !== 'undefined' && window.allOrders[data.orderId]) {
                        const targetOrder = window.allOrders[data.orderId];
                        const foundItem = targetOrder.items.find(i => i.itemId === data.itemId);
                        if (foundItem) data.menuName = foundItem.name || foundItem.menuName;
                    }
                    
                    if (!data.menuName && isHub && typeof db !== 'undefined' && db.orders) {
                        const dbOrder = await db.orders.get(data.orderId);
                        if (dbOrder && dbOrder.items) {
                            const foundItem = dbOrder.items.find(i => i.itemId === data.itemId);
                            if (foundItem) data.menuName = foundItem.name || foundItem.menuName;
                        }
                    }
                } catch (catchErr) {
                    console.log("ℹ️ [Toast Fix Engine] พยายามดึงชื่ออาหารสำรองแต่ไม่พบในคลัง", catchErr);
                }
            }

            if (isHub) {
                if (typeof updateItemStatusInDB === 'function') {
                    await updateItemStatusInDB(data.orderId, data.itemId, 'done');
                }
                if (typeof sendP2PData === 'function') {
                    console.log("🚀 [Relay ขากลับ] เครื่องแม่บันทึก DB และสับรางกระจายข่าว ITEM_DONE ให้ลูกทีมทุกคน...");
                    sendP2PData(data); 
                }
            }

            if (isClient || isHub) {
                console.log(`📱 [UI Update] หน้าร้านรับทราบ -> เมนูพร้อมเสิร์ฟ`);
                
                if (typeof updatePOSItemStatusUI === 'function') {
                    updatePOSItemStatusUI(data.orderId, data.itemId, 'done');
                }

                if (typeof renderKitchenToastAlert === 'function') {
                    renderKitchenToastAlert(data);
                } else if (typeof showOrderNotify === 'function') {
                    showOrderNotify(`🍳 เมนูของ [โต๊ะ ${data.table}] เสร็จแล้วจ้า!`);
                }
            }
            return; 
        }

        // =========================================================================
        // 👨‍🍳 🚩 [เหตุการณ์ที่ 2: KITCHEN_SYNC_REQUEST] ครัวต่อเน็ตใหม่ยิงมาดึงคิวงานล่าสุด
        // อธิบาย: ใช้กรณีเครื่องครัวหลุด/เปิดแท็บใหม่ จะทักมาขอชุดตั๋วที่ยังค้างคาอยู่จากเครื่องแม่
        // =========================================================================
        if (data.type === 'KITCHEN_SYNC_REQUEST') {
            if (isHub) {
                console.log("📥 [Sync Flow] เครื่องแม่ตรวจพบเครื่องครัวเพิ่งออนไลน์/Reconnect เข้ามาขอคิวงานล่าสุุด...");
                if (typeof responseKitchenSync === 'function') {
                    await responseKitchenSync();
                }
            }
            return;
        }

        // =========================================================================
        // 📥 🚩 [เหตุการณ์ที่ 3: KITCHEN_SYNC_RESPONSE] ครัวได้รับกล่องคิวงานที่แม่ส่งมาให้
        // อธิบาย: เมื่อฝั่งครัวได้คิวงานค้างจากแม่ จะทำการล้างจอเก่า และเรนเดอร์ตั๋วอาหารที่ยังทำไม่เสร็จขึ้นจอใหม่
        // =========================================================================
        if (data.type === 'KITCHEN_SYNC_RESPONSE') {
            if (isKitchen) {
                console.log("📥 [Sync Flow] เครื่องครัวได้รับคิวงานอัปเดตล่าสุดจากเครื่องแม่แล้ว! กำลังจัดระเบียบตั๋วใหม่...");
                if (data.activeTickets && Array.isArray(data.activeTickets)) {
                    const container = document.getElementById('kitchen-ticket-container');
                    if (container) container.innerHTML = '';

                    data.activeTickets.forEach(ticket => {
                        if (typeof addKitchenTicket === 'function') {
                            addKitchenTicket(ticket);
                            ticket.items.forEach(item => {
                                if (item.status === 'done') {
                                    const rowId = `item-row-${ticket.orderId}-${item.itemId}`;
                                    const row = document.getElementById(rowId);
                                    if (row) {
                                        row.style.opacity = "0.2";
                                        row.style.pointerEvents = "none";
                                        row.setAttribute('data-status', 'done');
                                    }
                                }
                            });
                        }
                    });
                    console.log("✨ [Sync Flow] ล้างตั๋วผีราบคาบ พร้อมจัดหน้าจอครัวให้แม่นยำตามข้อมูลจริงบนเครื่องแม่สำเร็จ!");
                }
            }
            return;
        }

        // =========================================================================
        // 📱 🚩 [เหตุการณ์ที่ 4: TABLE_SYNC_REQUEST] เครื่องลูกขอสถานะผังโต๊ะล่าสุดจากแม่
        // อธิบาย: เครื่องลูก (Client หน้าร้าน) ขอข้อมูลปุ่มสีสถานะโต๊ะจากแม่เพื่อให้ระบบคุยกันตรงกัน
        // =========================================================================
        if (data.type === 'TABLE_SYNC_REQUEST') {
            if (isHub) {
                console.log("📥 [Table Sync] เครื่องแม่ (Hub) ตรวจพบเครื่องลูกร้องขออัปเดตสถานะผังโต๊ะหลัง Reconnect...");
                if (typeof responseTableSync === 'function') {
                    await responseTableSync();
                }
            }
            return;
        }

        // =========================================================================
        // 📥 🚩 [เหตุการณ์ที่ 5: TABLE_SYNC_RESPONSE] เครื่องลูกได้รับแพ็กเกจผังโต๊ะจากแม่
        // อธิบาย: เครื่องลูกเคลียร์โต๊ะเก่าใน Dexie ของตัวเอง และเขียนทับข้อมูลผังโต๊ะที่แม่ส่งมาเพื่อระบายสีปุ่ม
        // =========================================================================
        if (data.type === 'TABLE_SYNC_RESPONSE') {
            if (isClient) {
                console.log("📥 [Table Sync] เครื่องลูกได้รับข้อมูลผังโต๊ะอัปเดตตรงจากแม่แล้ว! กำลังเขียนทับฐานข้อมูลจำลอง...");
                if (data.activeTables && Array.isArray(data.activeTables)) {
                    try {
                        if (typeof db !== 'undefined' && db.active_tables) {
                            await db.active_tables.clear();
                            for (const table of data.activeTables) {
                                await db.active_tables.add(table);
                            }
                            if (typeof renderTableSelection === 'function') {
                                await renderTableSelection();
                                console.log("✨ [Table Sync] อัปเดตสีปุ่มผังโต๊ะหน้าร้านตามข้อมูลจริงเครื่องแม่สำเร็จ!");
                            }
                        }
                    } catch (err) {
                        console.error("❌ เกิดข้อผิดพลาดขณะเครื่องลูกกำลังบันทึกข้อมูลผังโต๊ะที่ซิงค์มา:", err);
                    }
                }
            }
            return;
        }

        // =================================================================================
        // 🛡️ 🔗 [เหตุการณ์ที่ 6: REQUEST_PENDING_ORDERS] มีเครื่องอื่นมาสะกิดขอดูบิลค้างซิงค์
        // อธิบาย: เมื่อมีเครื่องมาขอดูบิลตกค้าง ระบบจะสแกนหาคำสั่งซื้อที่ติดสถานะ 'pending' ใน Dexie DB เพื่อส่งออกไปซิงค์ย้อนหลัง
        // =================================================================================
        if (data.type === 'REQUEST_PENDING_ORDERS') {
            console.log('📦 [P2P Sync Block] ตรวจพบการขอเช็กบิลค้างส่งย้อนหลังเข้ามา! กำลังค้นหาในคลัง Dexie DB...');
            
            if (typeof db !== 'undefined' && db.orders) {
                const pendingOrders = await db.orders.where('sync_status').equals('pending').toArray();
                
                if (pendingOrders.length > 0) {
                    console.log(`🚀 พบออเดอร์ตกค้างในเครื่องเรา ${pendingOrders.length} รายการ! กำลังแพ็กกล่องส่งย้อนหลังข้ามท่อ...`);
                    if (typeof sendP2PData === 'function') {
                        sendP2PData({
                            type: 'SYNC_BULK_ORDERS',
                            ordersList: pendingOrders
                        });
                    }
                } else {
                    console.log('✨ บัญชีเครื่องเราใสสะอาด ไม่มีบิลค้างส่งค้างคาเลยเพื่อน!');
                }
            }
            return; 
        }

        // =================================================================================
        // 🛡️ 📥 [เหตุการณ์ที่ 7: SYNC_BULK_ORDERS] ฝั่งรับได้รับมัดรวมออเดอร์ตกค้างย้อนหลัง
        // อธิบาย: รับข้อมูลบิลตกค้างย้อนหลังมาบันทึกลงคลัง และสั่ง Refresh อัปเดตหน้าจอแดชบอร์ด-สรุปยอดขายทันที
        // =================================================================================
        if (data.type === 'SYNC_BULK_ORDERS') {
            const incomingOrders = data.ordersList || [];
            console.log(`📥 [P2P Sync Block] ได้รับมัดรวมออเดอร์ตกค้างเข้ามา ${incomingOrders.length} รายการ! กำลังทยอยลงคลัง...`);
            
            let newSavedCount = 0;
            if (typeof db !== 'undefined' && db.orders) {
                for (const order of incomingOrders) {
                    const isExist = await db.orders.get(order.id);
                    if (!isExist) {
                        await db.orders.add(order);
                        newSavedCount++;
                    }
                }
            }
            
            console.log(`🎉 ลงบัญชีบิลตกค้างใหม่เรียบร้อย ${newSavedCount} รายการ!`);
            
            if (newSavedCount > 0) {
                console.log('🎨 [UI Refresh] ตรวจพบข้อมูลใหม่ไหลเข้าคลัง! สั่งวาด UI แดชบอร์ดและตารางขายเพื่ออัปเดตยอดล่าสุด');
                if (typeof loadRecentOrders === 'function') await loadRecentOrders();
                if (typeof fetchTodaySales === 'function') fetchTodaySales();
                if (typeof renderRecentOrdersUI === 'function') renderRecentOrdersUI();
                if (typeof renderTodayOrdersTableUI === 'function') renderTodayOrdersTableUI();
            } else {
                console.log('🧘 [UI Safe] สัญญาณซิงค์ซ้ำ ข้อมูลเดิมอยู่ครบแล้ว ข้ามการเรนเดอร์เพื่อเซฟ DOM หน้าจอครัวนิ่ง ๆ ครับ');
            }

            if (typeof sendP2PData === 'function' && incomingOrders.length > 0) {
                sendP2PData({
                    type: 'ACK_SYNC_SUCCESS',
                    orderDatabaseIds: incomingOrders.map(o => o.id) 
                });
            }
            return; 
        }

        // =================================================================================
        // 🛡️ 🧼 [เหตุการณ์ที่ 8: ACK_SYNC_SUCCESS] ฝั่งส่งได้รับการยืนยันว่าของถึงมือแล้ว -> สั่งล้างป้าย
        // อธิบาย: เมื่อปลายทางตอบกลับว่าได้รับบิลแล้ว เครื่องต้นทางจะเปลี่ยนป้ายสถานะใน DB จาก 'pending' เป็น 'completed'
        // =================================================================================
        if (data.type === 'ACK_SYNC_SUCCESS') {
            console.log('✅ [P2P Sync Block] เครื่องปลายทางลงบัญชีเรียบร้อย! เริ่มปฏิบัติการล้างสถานะป้ายค้างส่ง...');
            
            const targetIds = data.orderDatabaseIds || [];
            if (typeof db !== 'undefined' && db.orders) {
                for (const id of targetIds) {
                    await db.orders.update(id, { sync_status: 'completed' });
                }
            }
            console.log(`🧼 เคลียร์ล้างป้ายสถานะเป็น 'completed' สำเร็จรวม ${targetIds.length} รายการ บิลไม่ส่งซ้ำแน่นอน!`);
            return; 
        }

        // =========================================================================
        // 🚩 [โหมดที่ 6]: ดักจับกลุ่มสัญญาณคำสั่งซื้อ (รับออเดอร์ใหม่ หรือ สัญญาณจัดการออเดอร์)
        // อธิบาย: จุดยุทธศาสตร์หลักในการคัดกรองระหว่าง "ออเดอร์สั่งกินใหม่" กับ "บิลจ่ายเงินปิดโต๊ะ"
        // =========================================================================
        if (data.type === 'ORDER_INCOMING' || data.type === 'ORDER') {
            
            if (typeof normalizeTableName === 'function') {
                source.table = normalizeTableName(source.table);
            }
            const tableLabel = source.table;
            const incomingItems = source.items || [];
            const hasIncomingItems = incomingItems.length > 0;

             // 💳 🛡️ [จุดปรับปรุงวิกฤต - ตรวจสอบความบริสุทธิ์ของบิลจ่ายเงินในทุกระดับชั้นของออบเจกต์]:
            // สแกนหาคำว่า "isPayment" และสถานะ "paid" ทั้งชั้นนอก (data) และชั้นใน (source / orderData) 
            // เพื่อแก้ไขปัญหาเครื่องแม่ (Hub) ได้รับสัญญาณดีดสะท้อนของตัวเองวนกลับมาเข้าลูป (Loopback Signal)
            const isPaymentBill = (
                data.isPayment === true ||
                source.isPayment === true || 
                source.status === 'paid' || 
                data.status === 'paid' ||
                (data.orderData && data.orderData.isPayment === true)
            );
            
            const isPureTableClear = isPaymentBill && !hasIncomingItems;

            // 🧼 กรณีคลิกปิดโต๊ะชำระเงินแบบไม่มีของกินพ่วง (Clear โต๊ะเปล่า)
            if (isPureTableClear) {
                console.log(`💰 %c[Barrier VIP] พฤติกรรม: ปิดโต๊ะชำระเงินเพียว ๆ ของ: ${tableLabel} -> เริ่มระบบล้างสถานะโต๊ะ`, "color: #2ecc71; font-weight: bold;");
                
                if (tableLabel && tableLabel !== "กลับบ้าน") {
                    try {
                        if (typeof db !== 'undefined' && db.active_tables) {
                            await db.active_tables.delete(tableLabel); 
                            console.log(`🧹 [Sync DB] ล้างตารางฝากโต๊ะ "${tableLabel}" ออกจากคลังฐานข้อมูลสำเร็จ`);
                        }
                        if (typeof renderTableSelection === 'function') {
                            await renderTableSelection();
                            console.log(`🎨 [UI Render] สั่งอัปเดตแผงผังโต๊ะเรียบร้อย -> ปุ่มสีส้มเปลี่ยนกลับเป็นสีขาว`);
                        }
                    } catch (syncErr) {
                        console.error("❌ กระบวนการซิงค์ล้างตารางโต๊ะล้มเหลว:", syncErr);
                    }
                }
                return; 
            }

            // =========================================================================
            // 🛑 [ด่านสกัดกั้นตั๋วครัวผีจากบิลชำระเงิน]: ทำงานเมื่อสแกนพบว่าเป็นบิลที่จ่ายเงินเรียบร้อยแล้ว
            // =========================================================================
            if (isPaymentBill) {
                console.log(`💰 %c[Security Guard] ตรวจพบสัญญาณเช็กบิลปิดยอดของบิลรหัส: ${orderId} ของโต๊ะ: ${tableLabel} -> 🛑 สั่งดีดตัวออกจากลูปครัวทันที!`, "color: #ff9800; font-weight: bold;");
                
                // 🚀 [เครื่องแม่]: กระจายข่าวแบบติดป้ายความปลอดภัยระดับสูง ย้ำไปในแพ็กเกจ P2P ทุกระดับว่าบิลนี้จ่ายเงินแล้ว
                if (isHub && typeof sendP2PData === 'function') {
                    sendP2PData({
                        type: 'ORDER', 
                        orderId: orderId,
                        isPayment: true, 
                        orderData: { ...source, table: tableLabel, isPayment: true } 
                    });
                }

                // ส่งออเดอร์เข้าไปบันทึกฐานข้อมูลเครื่องแม่เพื่ออัปเดตสรุปยอดบัญชีหลังบ้าน
                if (typeof processAndRenderOrder === 'function') {
                    try {
                        source.isPayment = true; 
                        await processAndRenderOrder(source); 
                        console.log(`✅ [DB Saved] บันทึกเงินปิดยอดเข้าบัญชีหลังบ้านรหัสบิล ${orderId} เรียบร้อยโดยไม่กวนหน้าจอครัว`);
                    } catch (dbErr) {
                        console.warn("ℹ️ [DB Note] ข้อมูลซ้ำในฐานข้อมูลดั้งเดิม แต่ยอดบัญชีได้รับการอัปเดตเสถียรแล้ว", dbErr);
                    }
                }
                return; // ⛔ [ตัดตอนการไหล]: ดีดสัญญาณออกจากฟังก์ชันทันที! บรรทัด addKitchenTicket ด้านล่างหมดสิทธิ์ทำงานแน่นอน!
            }

            // ⏳ ป้องกันสัญญาณสะท้อนซ้ำซ้อนในกลุ่มออเดอร์สั่งอาหารปกติ
            if (orderId && window.currentlyProcessing.has(orderId)) {
                console.log(`⏳ ID: ${orderId} กำลังทำงานสั่งอาหารอยู่... สกัดสัญญาณสะท้อนเสี้ยววินาทีออกไป`);
                return;
            }
            if (orderId) window.currentlyProcessing.add(orderId);

            const itemsToProcess = incomingItems;

            if (isHub && typeof sendP2PData === 'function') {
                console.log("%c🚀 [Relay] เครื่องแม่พบรายการอาหาร! ทำการกระจายข้อมูลสับรางยิงออเดอร์ตรงไปหน้าร้านทีมงาน...", "color: lime; font-weight: bold;");
                sendP2PData({
                    type: 'ORDER', 
                    orderId: orderId,
                    orderData: { 
                        ...source, 
                        items: itemsToProcess, 
                        table: tableLabel,
                        isPayment: false 
                    }
                });
            }

            // =========================================================================
            // 🍳 [ด่านส่งตั๋วเข้าห้องครัวอัจฉริยะ]: ทำงานเฉพาะออเดอร์สั่งอาหารจานใหม่เท่านั้น
            // =========================================================================
            if (typeof addKitchenTicket === 'function') {
                // 🛡️ ป้องกันขั้นสุดท้าย: ตัวแปร !isPaymentBill ต้องใสสะอาด ไม่มีป้ายจ่ายเงินแปะอยู่ ถึงจะวาดการ์ดลงจอครัว
                if ((isKitchen || isKitchenViewActive) && !isPaymentBill) {
                    console.log(`🍳 %c[DISPLAY] วาดตั๋วอาหารใหม่ของโต๊ะ ${tableLabel} ลงหน้าจอครัวเรียบร้อย!`, "color: orange; font-weight: bold;");
                    addKitchenTicket({ 
                        orderId, 
                        table: tableLabel, 
                        items: itemsToProcess,
                        note: source.note || "" 
                    });
                }
            }

            // บันทึกและสั่งพิมพ์บิลอัปเดตหน้าร้านปกติ สำหรับกรณีออเดอร์สั่งกินใหม่
            if (typeof processAndRenderOrder === 'function') {
                try {
                    if (orderId && window.processedOrderIds.has(orderId)) {
                        console.warn(`🚫 [Anti-Double Block] ตรวจพบการสั่งอาหารซ้ำ! ID: ${orderId} ระบบทำการสกัดคลังข้อมูลเพื่อกันยอดเบิ้ล`);
                    } else {
                        await processAndRenderOrder(source); 
                        console.log(`✅ [DB Saved] บันทึกเงินเข้าบัญชีหลังบ้านของออเดอร์รหัส ${orderId} สำเร็จ ยอดขายขยับแน่นอน!`);
                        
                        if (orderId) {
                            window.processedOrderIds.add(orderId);
                            if (window.processedOrderIds.size > 200) {
                                const oldestOrderId = window.processedOrderIds.values().next().value;
                                window.processedOrderIds.delete(oldestOrderId);
                                console.log(`🧹 [RAM Cleanup] ออเดอร์ล้นคิว! ทำการเบียด ID: ${oldestOrderId} ตกขอบ RAM เพื่อรักษาทรัพยากรเครื่อง`);
                            }
                        }
                    }
                } catch (dbErr) {
                    console.warn("ℹ️ [DB Note] ข้อมูลซ้ำในฐานข้อมูลดั้งเดิม แต่ระบบส่วนอื่นยังทำงานต่อไปได้ปกติ", dbErr);
                }
            }
        }

    } catch (criticalErr) {
        console.error("❌ [Critical] เกิดข้อผิดพลาดใน handleIncomingData:", criticalErr);
    } finally {
        if (orderId) {
            setTimeout(() => window.currentlyProcessing.delete(orderId), 2000);
        }
    }
}

// 2. ฟังก์ชันช่วยเรนเดอร์ (Update: 13-05-2026)
// ทำหน้าที่: บันทึก Local + อัปเดต UI หน้าจอแม่
async function processAndRenderOrder(orderData) {
    try {
        console.log("🛠️ [Manager] กำลังจัดการข้อมูลออเดอร์...");

        // ก) บันทึกข้อมูลลงฐานข้อมูลภายใน (Local Storage / ระบบจัดการโต๊ะของพี่)
        // จุดนี้ระบบจะทำงานภายในเครื่องแม่เอง 100% ไม่มีการวิ่งออกเน็ต
        if (typeof confirmOrder === 'function' && (orderData.isPayment || !orderData.table)) {
            await confirmOrder(orderData.payment_method || 'Cash', true, orderData);  // รอเปลี่ยนเป็น paymentType
        } else if (typeof saveOrderToTable === 'function') {
            await saveOrderToTable(orderData, true);
        }
        
        console.log("💾 [Success] บันทึกออเดอร์ลงเครื่องแม่เรียบร้อย");

        // ข) สั่งให้ตาราง 'รายการออเดอร์วันนี้' (recent-orders-body) โหลดข้อมูลใหม่มาโชว์
       // 🟢 เปลี่ยนมาเช็คและเรียกใช้งานฟังก์ชันใหม่ทั้ง 2 ดวงแทนเลยครับ 25-05-2026
        if (typeof renderRecentOrdersUI === 'function') {
            await renderRecentOrdersUI(); 
        }

        if (typeof renderTodayOrdersTableUI === 'function') {
            await renderTodayOrdersTableUI(); 
        }

        // พ่นข้อความบอกล็อกเมื่อทั้งสองฟังก์ชันทำงานเสร็จสิ้น
        console.log("📝 [UI] อัปเดตตารางหน้าจอเรียบร้อย");
    } catch (err) {
        console.error("❌ [Error] เกิดข้อผิดพลาดขณะจัดการข้อมูลภายใน:", err);
    }
}

// ฟังก์ชันเสริม: คืนค่าสถานะไฟเป็นปกติ
function resetWarpStatus(dot, text) {
    // 🔒 เกราะป้องกันระบบ ตรวจเช็กความพร้อมวัตถุปลายทางก่อนประมวลผล
    if (dot && text) {
        
        // 🟢 ฝั่ง UI ดีไซน์: ปัดกวาดขยะอินไลน์สไตล์ออกพ่นผ่านคลาสควบคุมของ CSS 100%
        dot.className = "warp-status-dot is-warp-ready";
        text.className = "warp-status-text is-warp-ready";
        
        // 🧠 ฝั่งข้อมูล/ลอจิก: ทำหน้าที่อัปเดตข้อความเพียว ๆ สะอาดหมดจด
        text.innerText = 'ระบบวาร์ป: พร้อมส่งออเดอร์';
    }
}

// เพิ่มใน p2p-network.js (เครื่องลูกเป็นคนเรียกใช้) 11-05-2026
// ฟังก์ชันสำหรับส่งข้อมูล "ยอดชำระเงิน" โดยเฉพาะ
function sendPaymentToHub(paymentData) {
    // 1. ตรวจสอบการเชื่อมต่อกับเครื่องแม่
    if (typeof currentConn !== 'undefined' && currentConn && currentConn.open) {
        console.log("💰 [Warp Mode]: กำลังส่งยอดชำระเงินไปเครื่องแม่...");
        
        // 2. ส่งข้อมูลพร้อม "แปะป้ายกำกับ" (isPayment)
        currentConn.send({
            ...paymentData,      // ข้อมูลออเดอร์, รายการอาหาร, ยอดเงิน
            type: 'ORDER_INCOMING', // ใช้ type เดิมเพื่อให้เครื่องแม่รับเข้าท่อปกติ
            isPayment: true      // 🚩 [ป้ายสำคัญ]: บอกเครื่องแม่ว่า "นี่คือจ่ายเงินนะ ห้ามเข้าครัว!"
        });

        // 3. แจ้งเตือนฝั่งคนส่ง (เครื่องลูก)
        console.log("✅ ส่งข้อมูลการชำระเงินเรียบร้อย (Kitchen will be skipped)");
    } else {
        console.warn("⚠️ ไม่สามารถวาร์ปได้: การเชื่อมต่อ P2P ขัดข้อง");
        alert("❌ ไม่สามารถส่งยอดเงินไปเครื่องแม่ได้ กรุณาเช็คการเชื่อมต่อ");
    }
}

// --- ฟังก์ชันควบคุมหน้าจอ (UI) ---


/**
 * 🌐 ฟังก์ชันควบคุมการ เปิด-ปิด สวิตช์เครือข่าย P2P (Single Codebase)
 * แก้ไขล่าสุด: รื้อระบบตรวจคลาส Body ทิ้ง -> ใช้สิทธิ์ UI หน้าจอจริงตัดสินใจแทน [2026-05-27]
 */
// 🧠 ✨ [ฟังก์ชันสร้าง Pop-up แจ้งสถานะการเชื่อมต่อเน็ตเวิร์กหน้าร้าน] ✨
function renderP2PConnectedToast(roleThaiName) {
    // =========================================================================
    // จุดที่ 1: ค้นหาหรือสร้าง Container ควบคุมกลุ่มกล่อง โดยให้ CSS จัดระเบียบสากล
    // =========================================================================
    let container = document.getElementById('p2p-status-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'p2p-status-container'; // 🟢 โหลดโครงสร้างระยะพิกัดและความงามผ่าน CSS ID ทันที
        document.body.appendChild(container);
    }

    // =========================================================================
    // จุดที่ 2 & 3: ประกอบร่างหน้าตาการ์ดแจ้งเตือน (UI Card สวมคลาสสะอาด 100%)
    // =========================================================================
    const toast = document.createElement('div');
    toast.className = "p2p-toast-card"; // 🟢 สวมคลาสหลักเพื่อเรียกใช้ดีไซน์และแอนิเมชันขาเข้าทันที

    toast.innerHTML = `
        <div class="p2p-toast-title">🌐 เชื่อมต่อระบบ P2P สำเร็จ!</div>
        <div class="p2p-toast-body">
            อุปกรณ์นี้ทำงานในสถานะ: <span class="p2p-role-badge">${roleThaiName}</span>
        </div>
    `;
    
    // 🔒 ล็อกคุณความดีเดิมของพี่: ดันการ์ดเข้ากระดานกลุ่มตรงๆ ไม่ทำลายใบอื่น
    container.appendChild(toast);
    
    // =========================================================================
    // จุดที่ 4: 🔊 ระบบยิงสัญญาณเสียงบี๊บประสานคลื่นความถี่สั้น (คงลอจิกเพียว 100%)
    // =========================================================================
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        let osc = audioCtx.createOscillator(); let gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime); // โน้ต E5 เสียงใสเด่นชัด
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        osc.start(); osc.stop(audioCtx.currentTime + 0.12);
    } catch(e) { 
        console.log("เสียงแจ้งเตือนสถานะรันผ่านระบบเงียบ"); 
    }

    // =========================================================================
    // จุดที่ 5: ⏳ ลอจิกการเคลียร์ทรัพยากรหน้าจอขาออก (สลับคลาสสมูทไร้อินไลน์ใน JS)
    // =========================================================================
    setTimeout(() => {
        // 🟢 สั่งสวมคลาสขาออก แอนิเมชันยุบตัวจางหายอย่างนุ่มนวล ผ่านคลัง CSS
        toast.classList.add('is-leaving');
        
        setTimeout(() => { 
            toast.remove(); 
            // 🧹 ตรวจแถวถ้ากระดานว่างเปล่า ให้ถอน Container ออกเพื่อคืน RAM และคลีนระบบ DOM หลังบ้าน
            if (container.children.length === 0) {
                container.remove();
            }
        }, 500); // แมตช์ตามเวลาหน่วงขาออก 0.5 วินาทีใน CSS
    }, 4500); // ตระหง่านแจ้งเตือนเด่นชัด 4.5 วินาทีเท่าเดิมตามที่พี่ล็อกไว้
}
/**
 * 🔄 ฟังก์ชันสับสวิตช์เปิด/ปิดระบบ P2P (เวอร์ชันปรับลำดับความปลอดภัย + แจ้งเตือนหน้าจอ)
 */
/**
 * 🔄 ฟังก์ชันสับสวิตช์เปิด/ปิดระบบ P2P (เวอร์ชันควบคุมลำดับการแสดงผลหน้าจออย่างสมบูรณ์)
 * สิ่งที่จะเกิดขึ้น: จัดระเบียบการซิงค์เน็ตเวิร์กหลังบ้านให้เสร็จ -> แสดงป้ายความสำเร็จสีเขียวบนหน้าจอหลัก -> ค่อยนำทางเข้าจอครัว
 */
function toggleP2P() {
    const checkBox = document.getElementById("p2p-toggle");
    if (!checkBox) return;

    if (checkBox.checked) {
        // =========================================================================
        // 🟢 [กระบวนการขาเปิดระบบ]: เมื่อสับสวิตช์เลื่อนเปิดใช้งานเครือข่ายทางอากาศ
        // =========================================================================
        console.log("🟢 [Network] ระบบกำลังตื่นตัว... เริ่มกระบวนการค้นหาตัวตน");

        // 🧠 สเต็ปที่ 1: ตรวจเช็คบทบาทปัจจุบันที่ผู้ใช้ตัดสินใจเลือกกดไว้บนหน้าจอหลัก
        const currentIdentity = typeof getCurrentIdentity === 'function' ? getCurrentIdentity() : 'single';

        // 🛡️ ตัวกรองความปลอดภัย: หากพนักงานยังไม่ได้เลือกสถานะ (แม่/ลูก/ครัว) ระบบจะดักปัดตกทันที
        if (currentIdentity === 'single' || currentIdentity === 'none') {
            console.log("⚪ [Identity] โหมดปกติ Standalone -> ไม่เปิดระบบ P2P ซ้อนทับ");
            
            // จะเกิดอะไรขึ้น: หน้าจอจะเด้งกล่องข้อความเตือนพนักงานตรง ๆ สั่งสอนให้ไปกดเลือกบทบาทก่อน
            alert("⚠️ ไม่สามารถเปิด P2P ได้: กรุณาเลือกสถานะ (แม่/ลูก/ครัว) บนหน้าจอให้เรียบร้อยก่อนครับ");
            
            // ดีดสวิตช์กลับคืนตำแหน่งปิด และบันทึกค่าความปลอดภัยเพื่อป้องกันระบบเออร์เรอร์
            checkBox.checked = false;
            localStorage.setItem('p2p_enabled', 'false');
            return;
        }

        // สเต็ปที่ 2: เมื่อผ่านด่านความปลอดภัย บันทึกสถานะออนไลน์ลงสู่เครื่องถาวร
        localStorage.setItem('p2p_enabled', 'true');
        let roleThaiName = "เครื่องทั่วไป";
        let isKitchenMode = false; // ตัวแปรธงสำหรับคัดกรองจัดแถวคิวของห้องครัวโดยเฉพาะ

        // สเต็ปที่ 3: บล็อกสับรางสั่งรันฟังก์ชันเครือข่ายตามบทบาทจริงที่เลือกไว้
        if (currentIdentity === 'hub') {
            roleThaiName = "👑 เครื่องแม่ (Hub)";
            console.log("🛡️ [Identity] ร่างจริงคือ Boss -> เริ่มระดมพลเครื่องแม่ (Hub)");
            if (typeof setupAsHub === 'function') setupAsHub();
            
        } else if (currentIdentity === 'kitchen') {
            roleThaiName = "🍳 เครื่องครัว (Kitchen)";
            isKitchenMode = true; // ยกธงขึ้นว่าเป็นเครื่องครัว เพื่อเอาไปใช้เข้าคิวในสเต็ปถัดไป
            console.log("🛡️ [Identity] ร่างจริงคือ Kitchen -> ชุบชีวิตเสาสัญญาณจอครัว (Kitchen)");
            
            // จะเกิดอะไรขึ้น: สั่งเปิดสถานีเครือข่ายห้องครัว (ซึ่งตัวใหม่นี้ไม่มีคำสั่งเปิดหน้าจอแซงคิวแล้ว) 
            // ทำให้หน้าจอตั้งค่าหลักยังคงนิ่งสงบ ไม่โดนเด้งหน้าต่างครัวมาบังสายตาอีกต่อไป
            if (typeof setupAsKitchen === 'function') {
                setupAsKitchen();
            }
            
        } else if (currentIdentity === 'client') {
            roleThaiName = "📱 เครื่องลูกพนักงาน (Client)";
            console.log("🛡️ [Identity] ร่างจริงคือ Baby -> เริ่มระบบเครื่องลูกพนักงาน (Client)");
            if (typeof setupAsClient === 'function') setupAsClient();
        }

        // 🔥 ✨ สเต็ปที่ 4: ยิง Pop-up กล่องการ์ดสีเขียวแจ้งเตือนความสำเร็จขึ้นโชว์เด่นหราบนจอทันที
        // จะเกิดอะไรขึ้น: พนักงานบนมือถือหรือไอแพดจะเห็นป้ายออนไลน์สำเร็จ และได้ยินเสียง "บี๊บ! 🔔" นุ่มนวลทันที
        renderP2PConnectedToast(roleThaiName);

        // 🧠 🚀 สเต็ปที่ 5: [ระบบจัดระเบียบหน่วงเวลาเปิดหน้าจอครัวอัตโนมัติ]
        // จะเกิดอะไรขึ้น: หากเครื่องนี้คือ "ห้องครัว" โค้ดจะปล่อยให้พนักงานยืนดูป้ายสีเขียวเชื่อมต่อสำเร็จจนสบายใจ 1.5 วินาที
        // จากนั้นระบบจะสวมชุดคลาส 'kitchen-mode' (ผ่านโค้ดดั้งเดิมของพี่) เพื่อสลับเข้าหน้าต่างครัวให้เองอัตโนมัติอย่างนุ่มนวล
        if (isKitchenMode) {
            setTimeout(() => {
                // สั่งถอดชุดสไตล์โหมดอื่นออกให้หมด และสวมชุดหน้าจอห้องครัวอย่างเป็นระเบียบตามคิว
                document.body.classList.remove('boss-mode', 'baby-mode');
                document.body.classList.add('kitchen-mode');
                
                console.log("🍳 [Queue Navigation] เชื่อมต่อท่อ P2P ครบถ้วน -> นำทางเข้าสู่หน้าจอครัวเรียบร้อย");
                
                // สั่งเรียกตัวรันระบบวาดใบตั๋วออเดอร์ห้องครัวเดิมซ้ำอีกครั้ง เพื่อให้รายการอาหารหน้าร้านอัปเดตสดใหม่ที่สุด
                if (typeof renderKitchenTickets === 'function') {
                    renderKitchenTickets();
                }
            }, 1500); // หน่วงเวลาดีเลย์ไว้ 1.5 วินาที (เป็นเวลาที่เหมาะสมที่สุดในทางสากล)
        }

    } else {
        // =========================================================================
        // 🔴 [กระบวนการขาปิดระบบ]: เมื่อพนักงานสับสวิตช์ปิดการเชื่อมต่อเครือข่าย P2P
        // =========================================================================
        console.log("🔴 [Network] ปิดระบบการเชื่อมต่อทางอากาศ");
        localStorage.setItem('p2p_enabled', 'false');

        // ทำลายท่อเชื่อมต่อสัญญาณ Peer และคืนทรัพยากร RAM ตามมาตรฐานความปลอดภัยเดิมป้องกันเครื่องหน่วง
        if (window.peer) {
            window.peer.destroy();
            window.peer = null;
            console.log("🧹 [Clean] ทำลายการเชื่อมต่อ Peer และคืนทรัพยากร RAM เรียบร้อย");
        }
        
        // คืนค่าสภาพแวดล้อมหน้าจอ POS ให้กลับไปสู่โหมดขายหน้าร้านแบบ Offline Standalone ตัวเดิม
        if (typeof resetP2P === 'function') resetP2P(); 

        // สั่งเคลียร์ล้างหน้าจอกล่อง Pop-up สีเขียวทันที เพื่อไม่ให้เกะกะสายตาตอนปิดระบบ
        const oldToast = document.getElementById('p2p-status-container');
        if (oldToast) oldToast.innerHTML = '';
    }

    // สั่งรีเฟรชอัปเดตสถานะป้ายสัญลักษณ์ (Badge) เน็ตเวิร์กบนแถบเมนูหลักเดิมของตัวโปรแกรมตามปกติ
    if (typeof updateRoleDisplay === 'function') {
        updateRoleDisplay();
    }
}

//เครื่องแม่
/**
 * ฟังก์ชันตั้งค่าเครื่องให้เป็น "เครื่องแม่ (Hub)"
 * [หน้าที่]: เป็นศูนย์กลางรับข้อมูลจากเครื่องลูก และกระจายออเดอร์ไปยังจอครัว
 * [อัปเดตล่าสุด]: 15-05-2026 เพิ่มระบบจัดการ Connection สำหรับกระจายออเดอร์
 */
/**
 * 👑 [Master Function] ตั้งค่าเครื่องให้เป็นเครื่องแม่ (Hub)
 * อัปเดต: สวมชุด boss-mode ทันทีเพื่อให้ Badge เปลี่ยนสีโดยไม่รอ Peer
 */
async function setupAsHub() {
    // 1. ดึงชื่อร้าน (ID) จากช่อง Input
    const nameInput = document.getElementById('shop-id-input');
    const name = nameInput ? nameInput.value : null;
    
    if (!name) return alert("กรุณาใส่ชื่อร้านก่อนครับพี่!");
    
    // 🚩 [The UI King]: เปลี่ยนสถานะหน้าจอเป็นโหมดบอสทันที
    document.body.classList.remove('kitchen-mode', 'baby-mode');
    document.body.classList.add('boss-mode');

    // 🚩 บันทึกสถานะระบบ P2P
    localStorage.setItem('p2p_enabled', 'true');

    // 2. เคลียร์การเชื่อมต่อเก่าทิ้งก่อน เพื่อเริ่มระบบใหม่ให้นิ่ง
    if (window.peer) {
        console.log("♻️ กำลังรีเซ็ตระบบ Peer เดิม...");
        try {
            window.peer.destroy();
            window.peer = null;
        } catch(e) { console.log("ไม่มี peer เก่าให้ทำลาย"); }
    }

    // ประกาศ Array กลางสำหรับเก็บท่อเชื่อมต่อของลูกทีม
    window.connections = []; 

    // 3. สร้าง Peer ใหม่ด้วยชื่อร้าน
    window.peer = new Peer(name);

    // 4. รอรับการเชื่อมต่อที่วาร์ปเข้ามา (Incoming Connection)
    window.peer.on('connection', (conn) => {
        console.log("📡 [Hub] มีเครื่องใหม่วาร์ปเข้ามาเชื่อมต่อ: " + conn.peer);

        conn.on('open', () => {
            console.log(`✅ [Hub] เชื่อมต่อกับ [${conn.peer}] สำเร็จ`);
            
            // 🧼 ล้างท่อเชื่อมต่อเก่าที่เป็นชื่อเดียวกันออกก่อน เพื่อไม่ให้สายซ้อนในแรม
            window.connections = window.connections.filter(c => c.peer !== conn.peer);
            window.connections.push(conn);

            // 🛡️ [ย้ายเข้ามาที่นี่]: สั่งให้เครื่องแม่เงี่ยหูฟังข้อมูล "หลังจากท่อเชื่อมต่อกันแน่นหนาแล้วเท่านั้น"
            if (typeof setupConnListeners === 'function') {
                setupConnListeners(conn);
            }
        });

        conn.on('close', () => {
            console.warn(`👋 [Hub] เครื่อง [${conn.peer}] หลุดการเชื่อมต่อ`);
            window.connections = window.connections.filter(c => c.peer !== conn.peer);
        });
    });
    
    // 5. ตั้งค่าตัวดักฟังสถานะ Peer ของตัวเอง
    if (typeof setupPeerListeners === 'function') {
        setupPeerListeners();
    }

    // 🚩 [Final Step]: สั่งอัปเดตป้ายสถานะ UI ทันที
    if (typeof updateRoleDisplay === 'function') {
        updateRoleDisplay();
    }

    console.log("👑 เครื่องแม่ (Hub) ประจำการในโหมด UI: Boss");
}


//เครื่องลูก 13-05-2026
/**
 * 📱 [Master Function] ตั้งค่าเครื่องให้เป็นเครื่องลูก (Client)
 * อัปเดต: สวมชุด baby-mode ทันที และใช้ระบบวาร์ปอัตโนมัติหาเครื่องแม่
 */
function setupAsClient() {
    const nameInput = document.getElementById('shop-id-input');
    const name = nameInput ? nameInput.value : null;
    
    if (!name) return alert("กรุณาใส่ชื่อร้านแม่เพื่อเชื่อมต่อครับพี่!");

    // 🚩 [The UI King]: สวมชุด "เครื่องลูก" ทันทีที่กดปุ่ม
    // เพื่อให้ Badge เปลี่ยนจากสีเหลืองเป็นสีฟ้า (Baby) ทันทีโดยไม่ต้องรอสัญญาณ
    document.body.classList.remove('boss-mode', 'kitchen-mode');
    document.body.classList.add('baby-mode');

    // 🚩 1. ล้างระบบเก่า (Clean Up) 
    if (window.peer) {
        console.log("♻️ ล้างระบบเชื่อมต่อเก่าเพื่อเตรียมวาร์ปใหม่...");
        try {
            window.peer.destroy(); 
            window.peer = null;
        } catch(e) { console.log("เคลียร์ Peer เก่าเรียบร้อย"); }
    }

    console.log("⏳ กำลังเตรียมเครื่องเพื่อวาร์ปไปหา: " + name);

    // 🚩 2. สร้าง Peer ใหม่ (เป็นแบบสุ่ม ID เพราะเครื่องลูกไม่ต้องให้ใครวาร์ปหา)
    window.peer = new Peer(); 
    
    // เรียกใช้ฟังก์ชันดักฟัง Error ทั่วไป
    if (typeof setupPeerListeners === 'function') {
        setupPeerListeners(); 
    }

    // 🚩 3. เมื่อเครื่องลูกออนไลน์สำเร็จ (พร้อมวาร์ป)
    window.peer.on('open', (id) => {
        console.log("✅ เครื่องลูกออนไลน์พร้อมวาร์ป (My ID: " + id + ")");
        
        // อัปเดต Badge ให้แสดงสถานะล่าสุด
        if (typeof updateRoleDisplay === 'function') {
            updateRoleDisplay();
        }

        // แปะไว้ในฟังก์ชัน setupAsClient() ตรงบล็อก window.peer.on('open', (id) => { ... }) ใต้บรรทัด connectToHub(name);
        setTimeout(() => {
            if (typeof sendP2PData === 'function') {
                console.log("%c🛰️ [Client Auto-Trigger] ยิงคำขอซิงค์ผังโต๊ะหาแม่ทันทีหลังออนไลน์ติด!", "color: #3498db; font-weight: bold;");
                sendP2PData({ type: 'TABLE_SYNC_REQUEST' });
            }
        }, 1500); // ดีเลย์ 1.5 วินาทีให้สาย P2P ประกบกันแน่นหนาก่อน

        /**
         * ✨ [จุดสำคัญ]: วาร์ปหาเครื่องแม่ทันที
         * ใช้ฟังก์ชัน connectToHub(targetId) ที่พี่มีระบบ Reconnect ในตัว
         */
        if (typeof connectToHub === 'function') {
            connectToHub(name); 
        } else {
            console.error("❌ [Error] ไม่พบฟังก์ชัน connectToHub ในระบบ");
        }
    });

    // 🚩 4. ดัก Error กรณีวาร์ปไม่สำเร็จ
    window.peer.on('error', (err) => {
        if (err.type === 'peer-unavailable') {
            alert("❌ ไม่พบชื่อร้าน '" + name + "' \n\nตรวจสอบว่า:\n1. เครื่องแม่เปิดระบบอยู่\n2. พิมพ์ชื่อร้านถูกต้องทุกตัวอักษร");
        } else {
            console.error("🚨 ระบบเครือข่ายขัดข้อง:", err);
        }
    });
}

/**
 * 🍳 ฟังก์ชันลงทะเบียนและเปิดเสาสัญญาณเครือข่ายสำหรับเครื่องครัว (Kitchen) [2026-05-28]
 * สิ่งที่จะเกิดขึ้น: ทำหน้าที่จัดการระบบเชื่อมต่อและท่อส่งข้อมูล Peer หน้าร้าน โดยไม่มีการก้าวล่วงไปเปิดหน้าจอ UI เองแล้ว
 */
function setupAsKitchen() {
    // 1. ดึงชื่อร้านแม่จาก Input ในระบบ
    const targetId = document.getElementById('shop-id-input').value; 
    if (!targetId) return alert("กรุณาใส่ชื่อร้าน (ID เครื่องแม่) ก่อนครับพี่!");

    // ✂️ [ย้ายออกสำเร็จ]: ลบคำสั่งสวมชุดหน้าจอครัวทันทีออกไป เพื่อไม่ให้แซงคิวป็อปอัปสีเขียวสำเร็จ
    // (ย้ายหน้าที่สลับหน้าจอนี้ไปอยู่ภายใต้การควบคุมของฟังก์ชัน toggleP2P แทน)

    // 2. เคลียร์ระบบเดิม (ถ้ามี) เพื่อให้การเชื่อมต่อใหม่เสถียรที่สุด ป้องกันอาการท่อตัน
    if (window.peer) {
        console.log("♻️ [Kitchen] ล้างระบบ Peer เดิมออก...");
        try {
            window.peer.destroy();
            window.peer = null;
        } catch(e) { console.log("เคลียร์ Peer เก่าเรียบร้อย"); }
    }
    
    // 3. เริ่มต้นสร้างวัตถุ Peer สัญญาณใหม่ 
    window.peer = new Peer(); 

    // เมื่อสถานีสัญญาณของเครื่องครัวเปิดสำเร็จ
    window.peer.on('open', (id) => {
        console.log("📡 [Kitchen] Peer ID ของเราออนไลน์แล้ว: " + id);

        // 4. [Identity Sync]: อัปเดตป้ายสถานะ (Badge) เล็ก ๆ บนหน้าจอหลัก
        if (typeof updateRoleDisplay === 'function') updateRoleDisplay();

        // 5. [The Warp]: เรียกใช้ฟังก์ชันเดิมเพื่อเจาะรูท่อวาร์ปสัญญาณไปหาเครื่องแม่ (Hub)
        if (typeof connectToHub === 'function') {
            connectToHub(targetId); 
        } else {
            console.error("❌ [Error] ไม่พบฟังก์ชัน connectToHub ในไฟล์ระบบ");
        }
        
        console.log("⏳ [Kitchen] กำลังจองท่อวาร์ปหาเครื่องแม่...");
    });

    // =========================================================================
    // 🛰️ [The Warp Sync - Auto-Trigger]: ดักยิงคำขออัปเดตข้อมูลอัตโนมัติป้องกันตั๋วผี
    // =========================================================================
    setTimeout(() => {
        if (typeof sendP2PData === 'function') {
            console.log("%c🛰️ [Kitchen Auto-Trigger] ยิงคำขอซิงค์หาแม่เพื่อล้างตั๋วผีทันทีหลังออนไลน์ติด!", "color: #3498db; font-weight: bold;");
            sendP2PData({ type: 'KITCHEN_SYNC_REQUEST' });
        }
    }, 1500); // คงดีเลย์ 1.5 วินาทีของเดิมไว้ เพื่อให้ท่อ P2P ประกบกันแน่นหนาก่อนส่งข้อมูล

    // 6. ดักจับกรณีเกิดความผิดพลาดระหว่างสัญญาณทางอากาศ
    window.peer.on('error', (err) => {
        console.error("❌ [Kitchen] Peer System Error:", err);
        
        // หากสัญญาณเครื่องแม่ไม่ยอมตอบรับ (ชื่อร้านผิด หรือเครื่องแม่ปิดอยู่)
        if (err.type === 'peer-unavailable') {
            alert("❌ ไม่พบ ID เครื่องแม่: '" + targetId + "' \n\nตรวจสอบว่า:\n1. เครื่องแม่เปิด P2P อยู่\n2. พิมพ์ชื่อร้านถูกต้อง");
            
            // จะเกิดอะไรขึ้น: ดีดหน้าจอครัวออกทันทีหากกำลังใช้งาน เพื่อความปลอดภัย
            document.body.classList.remove('kitchen-mode');
            if (typeof updateRoleDisplay === 'function') updateRoleDisplay();
        }
    });
}

/**
 * ฟังก์ชันจัดการระเบียบหน้าจอสำหรับโหมดครัว
 * [หน้าที่]: สั่งซ่อนส่วนที่ไม่เกี่ยวข้องกับคนทำอาหาร (เช่น ยอดขาย, กำไร) 
 * และแสดงปุ่มที่จำเป็นสำหรับงานครัวเท่านั้น 15-05-2026
 */
/**
 * 👨‍🍳 ฟังก์ชันจัดการหน้าตา UI ตามบทบาท (Role-based UI Management)
 * ปรับปรุง: ใช้ Identity Detector และจัดการสิทธิ์การมองเห็นข้อมูลสำคัญ
 */
function applyKitchenLogic() {
    // 1. [Identity Check]: เช็คว่าตอนนี้เครื่องอยู่ในร่างไหน (เช็คจาก Class บน Body)
    // แทนการใช้ localStorage โดยตรง เพื่อป้องกันค่าค้างที่ไม่ได้อัปเดตตาม UI จริง
    const identity = typeof getCurrentIdentity === 'function' ? getCurrentIdentity() : 'none';
    
    // 2. ดึง Element สำคัญ (ใช้เพื่อซ่อนความลับ Boss และจัดการปุ่ม)
    const financialSection = document.getElementById('financial-summary'); 
    const profitText = document.getElementById('profit-display');
    const posButtons = document.getElementById('pos-action-buttons');
    const kitchenScreen = document.getElementById('kitchen-screen');

    // --- 🚩 [กรณีที่ 1: เข้าสู่ร่างห้องครัว] ---
    if (identity === 'kitchen') {
        console.log("👨‍🍳 [Kitchen Mode] กำลังซ่อนข้อมูลการเงินและสลับไปหน้าจอครัว...");

        // ซ่อนส่วนการเงิน (ความลับของ Boss) และปุ่มขาย
        // ใช้ setProperty('display', 'none', 'important') เพื่อป้องกัน CSS อื่นมาสั่งโชว์ทับ
        if (financialSection) financialSection.style.setProperty('display', 'none', 'important');
        if (profitText) profitText.style.setProperty('display', 'none', 'important');
        if (posButtons) posButtons.style.setProperty('display', 'none', 'important');
        
        // สั่งเปิดหน้าจอครัว (ถ้ามีฟังก์ชันจัดการ UI เฉพาะให้เรียกใช้)
        if (typeof showKitchen === 'function') {
            showKitchen();
        } else if (kitchenScreen) {
            kitchenScreen.style.display = 'block';
        }

    } 
    // --- 🏠 [กรณีที่ 2: ร่างเครื่องแม่ (Hub), เครื่องลูก (Client) หรือโหมดปกติ] ---
    else {
        console.log("🏠 [Logic] คืนค่าหน้าจอเข้าสู่โหมดขายปกติ (Role: " + identity + ")");
        
        // คืนค่าการแสดงผล: ใช้ค่าว่าง '' เพื่อให้กลับไปใช้ค่าเดิมตามไฟล์ CSS (เช่น flex หรือ block)
        // หน้าจอจะได้ไม่เบี้ยวจากการบังคับใส่ block ทุกตัว
        if (financialSection) financialSection.style.display = ''; 
        if (profitText) profitText.style.display = '';
        if (posButtons) posButtons.style.display = '';
        
        // สั่งปิดหน้าจอครัว
        if (typeof hideKitchen === 'function') {
            hideKitchen();
        } else if (kitchenScreen) {
            kitchenScreen.style.display = 'none';
        }
    }
}

// --- ฟังก์ชันการทำงานอื่นๆ (KDS / Kitchen) ---

/**
 * ฟังก์ชันส่งข้อมูลผ่านระบบ P2P 12-05-2026
 * [หน้าที่]: ส่งข้อมูล (Payload) จากเครื่องเราไปยังเครื่องอื่นๆ ที่เชื่อมต่ออยู่
 * [พิเศษ]: รองรับการส่งหาหลายเครื่องพร้อมกัน (Broadcast) สำหรับเครื่องแม่
 */

/**
 * 🚀 ฟังก์ชันส่งข้อมูล P2P (The Universal Broadcaster) 30-05-2026
 * ใช้สำหรับส่งข้อมูลออก ไม่ว่าจะเป็นการ "ส่งหาแม่" หรือ "แม่กระจายหาลูก"
 */
function sendP2PData(payload) {
    console.log("🔍 [P2P Trace] เริ่มตรวจสอบการส่ง:", payload.type);

    // --- 1. การเช็คด่านหน้า (Guard Clauses) ---
    const isEnabled = localStorage.getItem('p2p_enabled') === 'true';
    if (!isEnabled) {
        console.warn("⚠️ [Skip] ระบบ P2P ถูกปิดอยู่ที่ localStorage");
        return;
    }

    if (!payload || typeof payload !== 'object' || !payload.type) {
        console.error("❌ [Abort] ข้อมูล 'payload' ไม่สมบูรณ์หรือรูปแบบผิด", payload);
        return;
    }

    // 🛡️ [เพิ่มเข้ามาใหม่]: แปะป้าย ID เครื่องตัวเองเข้าไปใน Payload เพื่อให้ปลายทางรู้ว่าใครส่ง
    if (!payload.senderId && window.peer && window.peer.id) {
        payload.senderId = window.peer.id;
    }

    // ตัวแปรเก็บ ID ของเครื่องแม่ที่เราส่งไป (เพื่อป้องกันการส่งซ้ำในข้อ 3)
    let hubPeerId = null;

    // --- 2. [ส่วนเครื่องลูก]: ส่งเข้าหาศูนย์กลาง (Upstream) ---
    // เช็คผ่าน window.currentConn ที่พี่ปักหมุดไว้
    if (window.currentConn && window.currentConn.open) {
        try {
            window.currentConn.send(payload);
            hubPeerId = window.currentConn.peer; // จำ ID เครื่องแม่ไว้
            console.log(`✅ [Upstream] วาร์ป ${payload.type} ไปหาแม่ (${hubPeerId}) สำเร็จ`);
        } catch (err) {
            console.error("❌ [Upstream] พยายามส่งหาแม่แต่ล้มเหลว:", err);
        }
    }

    // --- 3. [ส่วนเครื่องแม่]: กระจายข่าว (Relay / Broadcast) ---
    // เช็คผ่าน window.connections ที่พี่ประกาศเป็น Array กลาง
    if (Array.isArray(window.connections) && window.connections.length > 0) {
        let broadcastCount = 0;
        console.log(`📊 [Relay] พบรายชื่อลูกทีมในสมุด ${window.connections.length} เครื่อง`);

        window.connections = window.connections.filter(conn => {
            // เช็คสถานะท่อว่าพร้อมไหม
            if (conn && conn.open) {
                try {
                    // 🛑 [ด่านกั้นร่างทรงสะท้อนกลับ - อัปเดตใหม่]:
                    // เงื่อนไขที่ A: เป็นเครื่องแม่เครื่องเดียวกับที่เราเพิ่งส่งไปในข้อ 2 (กรณีเครื่องนี้เป็นเครื่องลูก)
                    // เงื่อนไขที่ B: ท่อปลายทางนี้เป็น "คนส่งสัญญาณนี้มา" (กรณีเครื่องนี้เป็นเครื่องแม่ที่กำลังกระจายข่าว)
                    // หากตรงกับเงื่อนไขใดเงื่อนไขหนึ่ง -> ให้ข้ามไปเลย ไม่ต้องส่งข้อมูลกลับไปให้เขาซ้ำ!
                    if ((hubPeerId && conn.peer === hubPeerId) || (payload.senderId && conn.peer === payload.senderId)) {
                        console.log(`🛑 [Anti-Loop] ข้ามการส่งหา ${conn.peer} เพื่อป้องกันสัญญาณสะท้อนกลับซ้ำซ้อน`);
                        return true; 
                    }

                    conn.send(payload);
                    broadcastCount++;
                    console.log(`🚀 [Relay] ส่งต่อให้ ${conn.peer} สำเร็จ`);
                    return true; 
                } catch (e) {
                    console.warn(`⚠️ [Cleaning] ส่งหา ${conn.peer} ไม่ได้... คัดออกสะสม`);
                    return false; 
                }
            }
            return false; // ท่อปิด หรือ null
        });

        if (broadcastCount > 0) {
            console.log(`📢 [Hub] กระจายข้อมูลสำเร็จทั้งหมด ${broadcastCount} เครื่อง`);
        }
    } else {
        // กรณีไม่มีลูกทีม และไม่ใช่เครื่องลูกที่เชื่อมหาแม่
        if (!hubPeerId) {
            console.warn("⚠️ [Final Check] ไม่พบท่อที่เปิดอยู่ ทั้งเครื่องแม่และเครื่องลูก");
        }
    }
}

function markAsDone(orderId, itemName) {
    sendP2PData({
        type: 'ORDER_DONE',
        orderId: orderId,
        itemName: itemName
    });
}

function completeTicket(orderId) {
    const ticket = document.getElementById(`ticket-${orderId}`);
    if (ticket) {
        ticket.style.opacity = '0.3';
        setTimeout(() => { ticket.remove(); }, 500);
    }
}

//ฝั่งเครื่องลูก: สั่งอาหาร (ส่งข้อมูลไปเครื่องแม่)
// ฟังก์ชันส่งออเดอร์ (เรียกใช้เมื่อกดปุ่ม "สั่งอาหาร") 11-05-2026
// ปรับให้รับค่า data เพื่อรับช่วงต่อจาก executeOrderSent()
/**
 * ฟังก์ชันส่งข้อมูลออเดอร์ผ่าน P2P
 * @param {Object} data - ข้อมูลออเดอร์ (ถ้าไม่มีจะดึงจากหน้าจออัตโนมัติ)
 * @param {Boolean} isPayment - ป้ายบอกทาง (false = สั่งอาหาร/เด้งครัว, true = จ่ายเงิน/ห้ามเด้งครัว)
 */
function submitOrderP2P(data, isPayment = false) {
    // 1. ตรวจสอบและสร้างข้อมูลออเดอร์ (Payload)
    // เราแนบ isPayment ลงไปในกล่องข้อมูลด้วยเพื่อให้เครื่องแม่รับทราบ
    const orderPayload = data || {
        type: 'ORDER_INCOMING',
        orderId: 'ORD-' + Date.now(),
        table: document.getElementById('table-number')?.value || 'ทั่วไป',
        items: [...cart], 
        time: new Date().toLocaleTimeString('th-TH'),
        note: document.getElementById('order-note')?.value || '',
        isPayment: isPayment // 🚩 เพิ่มป้ายบอกสถานะลงใน Payload
    };

    // กรณีที่ส่ง data มาจากฟังก์ชันอื่น (เช่น จากหน้าโต๊ะ) ให้ยัดป้าย isPayment ลงไปด้วย
    if (data) {
        orderPayload.isPayment = isPayment;
    }

    // 2. ส่งข้อมูลวาร์ปไปที่เครื่องแม่
    if (typeof sendP2PData === 'function') {
        sendP2PData(orderPayload);
    } else if (currentConn && currentConn.open) {
        currentConn.send(orderPayload);
        console.log("✅ วาร์ปข้อมูลไปเครื่องแม่สำเร็จ (isPayment:", isPayment, ")");
    } else {
        console.error("❌ ระบบ P2P ยังไม่พร้อม ข้อมูลไม่ถูกส่ง");
        return; 
    }

    // 🚩 3. การวาดตั๋วที่ "กระดานห้องครัว" ของเครื่องตัวเอง
    // [ตรรกะใหม่]: ถ้าเป็นการ "จ่ายเงิน" (isPayment: true) เราจะไม่วาดตั๋วซ้ำในครัว
    if (!isPayment) {
        if (typeof addKitchenTicket === 'function') {
            console.log("🎨 ออเดอร์ใหม่: กำลังวาดตั๋วลงกระดานห้องครัวเครื่องลูก...");
            addKitchenTicket(orderPayload);
        } else {
            console.warn("⚠️ ไม่พบฟังก์ชัน addKitchenTicket");
        }
    } else {
        console.log("💰 สถานะจ่ายเงิน: บันทึกข้อมูลเงียบๆ ไม่วาดตั๋วซ้ำในครัว");
    }

    // 4. ล้างตะกร้าสินค้า (เปิดคอมเม้นท์ไว้เผื่อพี่อยากให้กดปุ่มจ่ายเงินแล้วเคลียร์ตะกร้าทันที)
    // if (typeof clearCart === 'function') clearCart(); 
}

/**
 * 1. ฟังก์ชันสำหรับเปิดโหมดห้องครัว (สลับหน้าจอ)
 * ปรับปรุง: 10-05-2026
 */
function showKitchen() {
    console.log("👨‍🍳 ระบบกำลังเตรียมหน้าจอ KDS...");
    
    // 1. ดึงหน้าจอหลัก (ถ้าพี่ห่อหน้าขายทั้งหมดไว้ใน id นี้)
    const posInterface = document.getElementById('pos-interface'); 
    
    // 2. ดึงหน้าจอครัว (ใช้ ID ให้ตรงกับใน HTML ของพี่คือ kitchen-screen)
    const kitchenInterface = document.getElementById('kitchen-screen'); 

    if (kitchenInterface) {
        // ✅ ถ้ามีหน้าขาย ให้ซ่อนหน้าขายก่อน
        if (posInterface) posInterface.style.display = 'none';
        
        // ✅ โชว์หน้าครัว
        kitchenInterface.style.display = 'block'; 
        
        // ล็อกหน้าจอไม่ให้เลื่อนไปมา (ช่วยให้คนทำครัวใช้งานง่ายขึ้น)
        document.body.style.overflow = 'hidden';
        
        console.log("✅ เปลี่ยนหน้าจอเป็นโหมดห้องครัวเรียบร้อย");
    } else {
        // แจ้งเตือนกรณีหา ID 'kitchen-screen' ไม่เจอ
        alert("⚠️ ไม่พบหน้าจอครัว (kitchen-screen) กรุณาตรวจสอบ ID ใน HTML ครับ");
    }
}

/**
 * ฟังก์ชันสร้างและวางตั๋วอาหารลงในหน้าจอครัว
 * อัปเดตล่าสุด: 27-05-2026 | รองรับระบบแจ้งเตือนและแอนิเมชั่น
 */
/**
 * 👨‍🍳 ฟังก์ชันวาดตั๋วรายการอาหารลงบนหน้าจอเครื่องครัว
 * ปรับปรุง: ยอมให้วาดตั๋วแม้จะจ่ายเงินแล้ว และเพิ่มระบบ Log เพื่อการตรวจสอบ
 */
/**
 * 🎟️ ฟังก์ชันวาดตั๋วอาหารลงหน้าจอครัว
 * ปรับปรุง: รองรับข้อมูล Relay และป้องกันตั๋วหายจากปัญหา Data Empty
 */
function addKitchenTicket(data) {
    // =========================================================================
    // 1. [ด่านเช็กพื้นที่หน้าจอครัว]
    // =========================================================================
    const container = document.getElementById('kitchen-ticket-container');
    if (!container) return;

    // =========================================================================
    // 📸 2. [ด่านกล้องวงจรปิดพิเศษ - Inspector Camera คงเดิมเป๊ะ]
    // =========================================================================
    console.log("%c🔍 [AddKitchenTicket - Inspector Camera]", "color: #ffffff; background: #2980b9; font-size: 13px; font-weight: bold; padding: 4px; border-radius: 4px;");
    console.log("📌 1. วัตถุข้อมูลดิบ (data) ทั้งก้อนที่วิ่งเข้ามาคือ:", data);
    console.log("📌 2. รายชื่อ Keys ทั้งหมดใน data ระดับนอกสุด:", data ? Object.keys(data) : "ไม่มีก้อนข้อมูล");
    
    if (data && data.orderData) {
        console.log("📌 3. ตรวจพบก้อนย่อย orderData ซ่อนอยู่ข้างใน! มีโครงสร้าง Keys คือ:", Object.keys(data.orderData));
    }

    // =========================================================================
    // 🛡️ 3. [เกราะนิรภัยชั้นที่ 2 - สแกนสัญลักษณ์สัญญาณเช็คบิลพื้นฐาน]
    // =========================================================================
    const isPaymentBill = data && (
        data.isPayment === true || 
        data.status === 'paid' ||
        data.type === 'ORDER_PAID' ||
        data.paymentType !== undefined || 
        (data.orderData && (
            data.orderData.isPayment === true || 
            data.orderData.status === 'paid' ||
            data.orderData.paymentType !== undefined
        ))
    );

    if (isPaymentBill) {
        console.log(
            `%c🛑 [Safety Shield Layer 2] บล็อกสัญญาณเช็คบิลสำเร็จ บิลเลขที่: ${data.orderId || (data.orderData ? data.orderData.orderId : 'ไม่ระบุ')}`, 
            "color: #ff3333; font-weight: bold; background: #fff0f0; padding: 4px; border: 1px solid #ffcccc; border-radius: 4px;"
        );
        return;
    }

    // =========================================================================
    // ⚠️ 4. [ด่านคัดกรองความสมบูรณ์ข้อมูลอาหาร]
    // =========================================================================
    if (!data || !data.items || data.items.length === 0) {
        console.warn("⚠️ [Skip Render] ข้อมูลว่างเปล่า หรือไม่มีรายการอาหารวิ่งเข้ามาในคำสั่งซื้อนี้");
        return;
    }

    console.log("📥 [Incoming Order] ข้อมูลผ่านด่านตรวจครบถ้วน กำลังจัดการเข้าคิวห้องครัวรายจาน:", data);

    const ticketId = `ticket-${data.orderId}`;
    const existingTicket = document.getElementById(ticketId);
    const tableDisplay = data.table !== undefined && data.table !== null ? data.table : 'กลับบ้าน';

    // =========================================================================
    // 🚨 5. [ฟังก์ชันย่อยสกัดตั๋วซ้ำ - จัดการคิวออเดอร์สั่งเพิ่มระลอก 2 (Append Round)]
    // =========================================================================
    if (existingTicket) {
        console.log(`🔄 [Append Round] ออเดอร์บิลเลขที่ ${data.orderId} ของ "${tableDisplay}" มีอยู่แล้ว ดำเนินการเติมจานใหม่ต่อท้าย...`);
        
        const itemsListContainer = existingTicket.querySelector('.items-list-box');
        if (itemsListContainer) {
            data.items.forEach((item, index) => {
                const safeItemId = item.itemId || (item.name ? item.name.replace(/\s+/g, '') : index);
                const rowId = `item-row-${data.orderId}-${safeItemId}`;

                if (!document.getElementById(rowId)) {
                    const finalQty = item.qty || item.quantity || 1;
                    // 🟢 ปรับโครงสร้างใช้คลาส .food-options-note แทนอินไลน์ดีไซน์
                    const options = item.options ? `<div class="food-options-note">✨ ${item.options}</div>` : '';
                    
                    // 🟢 สาดโครงสร้าง HTML สะอาดหมดจด สวมคลาสระเบียบ CSS สากล (.kt-action-group, .btn-kt-done)
                    const newItemHtml = `
                        <div class="kitchen-item-row" id="${rowId}" data-status="pending">
                            <div style="flex: 1;">
                                <div class="food-name-title">🍳 ${item.name} <span class="badge-new-round">สั่งเพิ่ม</span></div>
                                ${options}
                            </div>
                            <div class="kt-action-group">
                                <strong class="kt-qty-badge">x${finalQty}</strong>
                                <button onclick="markAsDoneP2P('${data.orderId}', '${safeItemId}', '${tableDisplay}', '${item.name ? item.name.replace(/'/g, "\\'") : ''}')" 
                                        class="btn-kt-done is-append-round">
                                    <i class="fas fa-check"></i>
                                </button>
                            </div>
                        </div>
                    `;
                    itemsListContainer.insertAdjacentHTML('beforeend', newItemHtml);
                }
            });
        }
        
        if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
        return;
    }

    // =========================================================================
    // 🧱 6. [ฟังก์ชันหลักวาดตั๋วอาหารใบใหม่เอี่ยม (New Ticket Card Render)]
    // =========================================================================
    const ticketHtml = `
        <div class="kitchen-ticket" id="${ticketId}" data-order-id="${data.orderId}">
            
            <div class="kt-header">
                <strong class="kt-table-title">📍 โต๊ะ: ${tableDisplay}</strong>
                <span class="kt-time-lbl">🕒 ${data.time || new Date().toLocaleTimeString()}</span>
            </div>

            <div class="items-list-box">
                ${data.items.map((item, index) => {
                    const finalQty = item.qty || item.quantity || 1;
                    // 🟢 ปรับโครงสร้างใช้คลาสควบคุมหมายเหตุอาหารสากล
                    const options = item.options ? `<div class="food-options-note">✨ ${item.options}</div>` : '';
                    
                    const safeItemId = item.itemId || (item.name ? item.name.replace(/\s+/g, '') : index);
                    const rowId = `item-row-${data.orderId}-${safeItemId}`;
                    
                    // 🟢 สวมชุดคลาสสวยงามสำหรับรอบบิลแรก (.is-normal-round สัญญาณสีเขียว) ปลอดขยะอินไลน์สไตล์ 100%
                    return `
                        <div class="kitchen-item-row" id="${rowId}" data-status="pending">
                            <div style="flex: 1;">
                                <div class="food-name-title">🍳 ${item.name}</div>
                                ${options}
                            </div>
                            <div class="kt-action-group">
                                <strong class="kt-qty-badge">x${finalQty}</strong>
                                <button onclick="markAsDoneP2P('${data.orderId}', '${safeItemId}', '${tableDisplay}', '${item.name ? item.name.replace(/'/g, "\\'") : ''}')" 
                                        class="btn-kt-done is-normal-round">
                                    <i class="fas fa-check"></i>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            
        </div>
    `;

    container.insertAdjacentHTML('afterbegin', ticketHtml);
    
    if (typeof checkEmptyKitchen === 'function') checkEmptyKitchen();
    
    console.log(`✅ [Success] วาดตั๋วอาหารเริ่มต้นของโต๊ะ ${tableDisplay} สำเร็จ เรียบร้อยกริบ`);
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
}

// 2. ฟังก์ชัน "ปิด" หน้าครัว (ใส่ไว้ทั้ง 2 ชื่อเพื่อความชัวร์) 10-05-2026
function hideKitchen() {
    const screen = document.getElementById('kitchen-screen');
    if (screen) {
        screen.style.display = 'none'; // สั่งซ่อน
        document.body.style.overflow = 'auto'; // คืนค่าการเลื่อนหน้าจอ
        console.log('🏠 กลับสู่หน้าขายปกติ');
    }
}

// สร้างชื่อสำรองไว้ เผื่อในอนาคตพี่เผลอไปเรียกใช้ชื่อนี้ 10-05-2026
function closeKitchen() {
    hideKitchen(); 
}

/**
 * 🧹 ฟังก์ชันไล่ผี: วาร์ปไปบอกครัวให้ลบตั๋วเมื่อเช็คบิลสำเร็จ 15-05-2026
 */
async function warpBillToKitchen(orderId, tableLabel) {
    if (typeof sendP2PData === 'function') {
        console.log(`🧹 [Ghost Buster] กำลังส่งสัญญาณลบตั๋วโต๊ะ ${tableLabel} ที่ครัว...`);
        
        await sendP2PData({
            type: 'ORDER',      // ใช้ Type ORDER เพื่อให้วิ่งเข้า handleIncomingData ตัวเดิม
            orderId: orderId,
            table: tableLabel,
            isPayment: true,    // 🚩 ส่งสัญญาณว่า "นี่คือการจ่ายเงินนะ (ลบตั๋วซะ)"
            items: []           // ไม่ต้องส่งรายการอาหารไป
        });
    }
}

//พื่อให้การลบตั๋วสมบูรณ์ 15-05-2026
function removeKitchenTicket(orderId) {
    const ticketId = `ticket-${orderId}`;
    const ticketElement = document.getElementById(ticketId);
    
    if (ticketElement) {
        // เพิ่มลูกเล่นให้ตั๋วค่อยๆ จางหายไป (Fade Out)
        ticketElement.style.transition = "0.3s";
        ticketElement.style.opacity = "0";
        ticketElement.style.transform = "scale(0.8)";
        
        setTimeout(() => {
            ticketElement.remove();
            console.log(`✅ ลบตั๋ว ID: ${orderId} ออกจากครัวแล้ว`);
        }, 300);
    }
}

/**
 * ฟังก์ชันสำหรับพ่อครัวกด "ทำเสร็จแล้ว" เพื่อส่งข้อมูลกลับไปหาเครื่องแม่ 28-05-2026
 * [ปรับปรุง]: เปลี่ยนมาใช้ window.currentConn เพื่อแก้ปัญหาตัวแปรเป็น null
 */
/**
 * 📡 [Kitchen P2P Signaler] ฟังก์ชันต้นทางฝั่งครัว สั่งอัปเดตสถานะทำเสร็จและยิงข้อมูลข้ามระบบ
 * ปรับปรุงความรอบคอบ: ขยายการรับพารามิเตอร์เป็น 4 ตัว โดยเพิ่ม 'menuName' (ชื่ออาหาร) เพื่อส่งไปกับเครือข่าย 100%
 */
function markAsDoneP2P(orderId, itemIdOrTable, tableIfItem, menuName) {
    if (!orderId) return;

    let itemId = null;
    let table = "ไม่ระบุโต๊ะ";
    let detectedMenuName = null;

    // =========================================================================
    // 🧠 1. [ตรรกะ Polymorphism]: ตรวจจับรูปแบบพารามิเตอร์ขาเข้า
    // อธิบาย: การันตีความปลอดภัยระบบ Single Codebase ไม่ให้ปุ่มยกบิลแบบเดิมพัง
    // =========================================================================
    if (tableIfItem !== undefined) {
        // เคสที่ 1: มาจากปุ่มกดรายจาน (ส่งพารามิเตอร์มา 3-4 ตัว)
        itemId = itemIdOrTable;              // พารามิเตอร์ตัวที่ 2 คือ ID ของจานอาหาร
        table = tableIfItem || "ไม่ระบุโต๊ะ";  // พารามิเตอร์ตัวที่ 3 คือ ชื่อโต๊ะ
        detectedMenuName = menuName || null; // 🎯 พารามิเตอร์ตัวที่ 4 คือ ชื่ออาหารตัวจริงที่เราสอยมาจากหน้าจอครัว
    } else {
        // เคสที่ 2: มาจากปุ่มยกบิล หรือปุ่มหน้าคิดเงิน (ส่งพารามิเตอร์มา 2 ตัว)
        table = itemIdOrTable || "ไม่ระบุโต๊ะ"; // พารามิเตอร์ตัวที่ 2 สลับหน้าที่มารับชื่อโต๊ะแทน
    }

    // 📡 ดึงสถานะการเปิดใช้งาน P2P จากความจำถาวรในเครื่อง
    const isP2PEnabled = localStorage.getItem('p2p_enabled') === 'true';
    let sentSuccess = false;

    // =========================================================================
    // 📦 ส่วนที่ 1: จัดเตรียม Payload และระบายข้อมูลข้ามเครือข่าย (P2P Air Sync)
    // อธิบาย: ฝังคีย์ 'menuName' ติดไปกับกล่องข้อมูลแบบ ITEM_DONE ทันทีเพื่อให้เครื่องแม่อ่านได้ทันที
    // =========================================================================
    const payload = itemId 
        ? { 
            type: 'ITEM_DONE', 
            orderId: orderId, 
            itemId: itemId, 
            table: table, 
            menuName: detectedMenuName, // 🌟 ชื่ออาหารตัวจริงวิ่งไปกับสายอากาศข้ามเครื่องทันที
            sender: 'kitchen' 
          }
        : { type: 'ORDER_DONE', orderId: orderId, table: table, sender: 'kitchen' };

    if (isP2PEnabled) {
        console.log(`📡 [Network Sync] กำลังส่งสัญญาณประเภท '${payload.type}' [เมนู: ${payload.menuName || 'ยกบิล'}] ไปยังวงเครือข่าย P2P...`);
        
        // 🛠️ [ท่อส่งสัญญาณสำรอง 3 ชั้นป้องกันระบบล่ม]
        // สิ่งที่จะเกิดขึ้น: พยายามยิงข้อมูลผ่าน 3 ท่อ หากท่อไหนพังจะสลับไปท่อถัดไปทันทีเพื่อให้ข้อมูลถึงปลายทางแน่นอน
        if (typeof sendP2PData === 'function') {
            try { sendP2PData(payload); sentSuccess = true; } catch (err) { console.error("❌ ท่อ 1 พัง:", err); }
        }
        
        if (!sentSuccess && typeof sendDataToPeer === 'function') {
            try { sendDataToPeer(payload); sentSuccess = true; } catch (err) { console.error("❌ ท่อ 2 พัง:", err); }
        }
        
        if (!sentSuccess && window.currentConnection) {
            try { window.currentConnection.send(JSON.stringify(payload)); sentSuccess = true; } catch (err) { console.error("❌ ท่อ 3 พัง:", err); }
        }
    } else {
        // ⚪ [โหมด Standalone]: หากร้านค้าปิดระบบเครือข่ายเล่นในเครื่องคนเดียว 
        console.log("⚪ [Standalone Mode] บันทึกและเปลี่ยนสถานะเงียบๆ ภายในเครื่องเดียว");
        sentSuccess = true; 
    }

    // =========================================================================
    // 🖥️ ส่วนที่ 2: มาตรการควบคุมหน้าจอและการสั่งระเบิดตั๋วอาหาร (UI & Animation)
    // =========================================================================
    // 🚨 มาตรการดักจับสายสัญญาณหลุดกลางคัน
    // สิ่งที่จะเกิดขึ้น: ถ้าระบบส่งเครือข่ายล้มเหลว โค้ดจะหยุดรันทันที ตั๋วบนหน้าจอครัวจะไม่หาย เพื่อความปลอดภัยสูงสุด
    if (!sentSuccess) {
        alert("❌ แจ้งจัดการข้อมูลล้มเหลว! สัญญาณเครือข่ายหลุด กรุณาตรวจสอบเครื่องแม่ข่าย");
        return;
    }

    // 🎯 เคส A: การเคลียร์แยกรายจาน (Item-Level) เมื่อส่งเน็ตผ่านแล้ว
    if (itemId) {
        console.log(`👨‍🍳 [Kitchen-Action] แจ้งจานเสร็จสิ้น: โต๊ะ ${table} (บิล: ${orderId} | จาน: ${itemId})`);
        const rowId = `item-row-${orderId}-${itemId}`;
        const itemRow = document.getElementById(rowId);
        
        if (itemRow) {
            // ✨ [จุดผสมผสาน UI เพื่อยาย]: ปรับเอฟเฟกต์การมองเห็นให้เนี๊ยบที่สุด
            // สิ่งที่จะเกิดขึ้น: แถวอาหารจานนั้นจะโดนขีดฆ่า จางลงเหลือ 30% และห้ามกดซ้ำซ้อนกันระบบรวน
            itemRow.style.opacity = "0.3";
            itemRow.style.textDecoration = "line-through"; 
            itemRow.style.transform = "scale(0.95)";
            itemRow.style.pointerEvents = "none";
            itemRow.setAttribute('data-status', 'done'); // ปรับตราประทับเป็น 'done'
        }

        // 🔍 [สแกนเนอร์สลายร่างตั๋วอัตโนมัติ]: ดักตรวจสอบตั๋วภาพรวม
        const ticketId = `ticket-${orderId}`;
        const mainTicketCard = document.getElementById(ticketId);
        
        if (mainTicketCard) {
            const allRowsInTicket = mainTicketCard.querySelectorAll('.kitchen-item-row');
            let hasRemainingPendingItems = false;
            
            // สแกนตรวจสอบทีละแถวในตั๋วใบนี้ ว่ายังมีจานไหนค้างทำอยู่อีกไหม
            allRowsInTicket.forEach(row => {
                if (row.getAttribute('data-status') === 'pending') {
                    hasRemainingPendingItems = true; // เจอจานค้างอยู่ ดึงตั๋วไว้ก่อน!
                }
            });

            // สิ่งที่จะเกิดขึ้น: หากไม่เหลือจานค้างทำแล้ว (pending) ตั๋วใบนี้จะร่อนหายไปจากหน้าจออย่างนุ่มนวล
            if (!hasRemainingPendingItems) {
                if (typeof removeTicketWithAnimation === 'function') {
                    removeTicketWithAnimation(mainTicketCard);
                } else {
                    mainTicketCard.remove(); // ทางเลือกสำรองกรณีฟังก์ชันแอนิเมชันขาดหาย
                }
            }
        }
    } 
    // 🎯 เคส B: การเคลียร์ยกบิลทั้งหมดรวดเดียว (Legacy Mode หรือ บิลกดชำระเงินหน้าร้าน)
    else {
        console.log(`👨‍🍳 [Kitchen-Action] แจ้งรายการเสร็จทั้งบิล: โต๊ะ ${table} (ID: ${orderId})`);
        const ticket = document.getElementById(`ticket-${orderId}`);
        if (ticket) {
            if (typeof removeTicketWithAnimation === 'function') {
                removeTicketWithAnimation(ticket);
            } else {
                ticket.remove();
            }
        }
    }

    // 📱 ระบบสั่นสัมผัสเพื่อความมั่นใจสูงสุด (Haptic Feedback)
    if (navigator.vibrate) navigator.vibrate(50);
}

// 🎨 ฟังก์ชันผู้ช่วยทำลายแผ่นตั๋วพร้อมเอนิเมชันสไลด์แบบโมเดิร์น
function removeTicketWithAnimation(ticketElement) {
    // ใช้ Cubic-Bezier ในการควบคุมความนุ่มนวลในการร่อนหลบออกทางฝั่งขวาของหน้าจอ
    ticketElement.style.transition = "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"; 
    ticketElement.style.transform = "translateX(120px) scale(0.8)"; 
    ticketElement.style.opacity = "0";
    
    // หน่วงเวลา 300ms ให้เอนิเมชันวิ่งจบตา จากนั้นสั่งลบแท็ก HTML นั้นทิ้งจาก RAM ทันที
    setTimeout(() => { 
        ticketElement.remove(); 
        // เช็คต่อว่าหน้าจอครัวว่างเปล่าสนิทหรือยัง เพื่อโชว์ข้อความ "อาหารหมดแล้วจ้า" คืนสู่หน้าจอของยาย
        if (typeof checkEmptyKitchen === 'function') checkEmptyKitchen(); 
    }, 300);
}

//ใช้ "ปิดระบบ P2P" หรือรีเซ็ตค่า 12-05-2026
/**
 * ฟังก์ชันรีเซ็ตระบบ P2P และคืนค่าหน้าจอ
 * [หน้าที่]: ปิดการเชื่อมต่อ Peer, ลบสถานะในเครื่อง และสั่งจัดระเบียบหน้าจอใหม่
 */
function resetP2P() {
    console.log("🔄 กำลังปิดระบบเครือข่ายและคืนค่าหน้าจอ...");

    // 1. ปิดการเชื่อมต่อ PeerJS (ถ้ามี)
    if (typeof peer !== 'undefined' && peer) {
        peer.destroy();
        console.log("🚫 ปิดการเชื่อมต่อ Peer เรียบร้อย");
    }

    // 2. ลบโหมด P2P ออกจากความจำเครื่อง
    localStorage.removeItem('p2p_mode');

    // 3. สั่งอัปเดตป้ายสถานะ (จะกลับไปเป็นสีเทา "Alone/Standalone")
    if (typeof updateRoleDisplay === 'function') {
        updateRoleDisplay();
    }

    // 4. สั่งจัดระเบียบหน้าจอใหม่ (จะกลับมาโชว์ยอดเงินและปุ่มขายของ)
    if (typeof applyKitchenLogic === 'function') {
        applyKitchenLogic();
    }
    
    // 5. ปิดหน้าจอครัว (ถ้าเปิดค้างไว้)
    if (typeof hideKitchen === 'function') {
        hideKitchen();
    }

    alert("กลับสู่โหมดใช้งานเครื่องเดียวเรียบร้อยครับพี่!");
}

//27-05-2026
//สั่งหน้าร้าน (Client) ขีดฆ่า/ทำสีจางเมนูที่เสิร์ฟแล้วเรียลไทม์
function updatePOSItemStatusUI(orderId, itemId, status) {
    // 1. ค้นหาแถวเมนูอาหารในหน้าจอพรีวิวออเดอร์ปัจจุปัน (ถ้าพนักงานกำลังเปิดโต๊ะนั้นดูอยู่)
    const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
    if (itemElement) {
        itemElement.style.opacity = "0.4";
        itemElement.style.textDecoration = "line-through";
        // ใส่ตราปั๊มสีเขียวเหนี่ยวทรัพย์บอกพนักงานหน้าร้าน
        const titleDiv = itemElement.querySelector('div style*="font-weight: bold"');
        if (titleDiv && !titleDiv.innerHTML.includes('[เสิร์ฟแล้ว]')) {
            titleDiv.innerHTML += ` <span style="color:#2ecc71; font-size:0.8rem; font-weight:bold;">[เสิร์ฟแล้ว]</span>`;
        }
    }

    // 2. อัปเดตสถานะลงในตัวแปรตะกร้ากลาง (cart) เผื่อมีการกดดูซ้ำ
    if (typeof cart !== 'undefined' && Array.isArray(cart)) {
        cart.forEach(item => {
            if (item.itemId === itemId) {
                item.status = status;
            }
        });
    }
    console.log(`🎨 [UI Sync] ขีดฆ่าเมนูจาน ${itemId} บนจอ POS หน้าร้านเรียบร้อย`);
}

/**
 * 💾 [Hub DB Status Updater] บันทึกสถานะอาหารทำเสร็จรายจานลงฐานข้อมูลเครื่องแม่ 28-05-2026
 * แก้ไข: ค้นหาจาก orderId แล้วเข้าไปอัปเดตสถานะ status ในอาเรย์ items ให้ถูกต้องตามโครงสร้างจริง
 */
async function updateItemStatusInDB(orderId, itemId, status) {
    if (!window.db || !orderId || !itemId) return;
    
    try {
        // 1. 🎯 ค้นหาออเดอร์ใหญ่ (บิล) จากตาราง orders โดยใช้ รหัสออเดอร์หลัก (orderId) ซึ่งหาเจอชัวร์ 100%
        const order = await db.orders.get(orderId);
        
        if (order && order.items && Array.isArray(order.items)) {
            // 2. 🔍 เข้าไปควานหาจานอาหารตัวจริงที่อยู่ในอาเรย์ items ข้างในบิลนั้น
            const targetItem = order.items.find(item => item.itemId === itemId);
            
            if (targetItem) {
                // 3. 🔄 ปรับปรุงสถานะจานนั้น (เช่น เปลี่ยนจาก pending เป็น done)
                targetItem.status = status; // หรือใช้ item_status ตามที่ระบบPOSพี่ใช้อ่านหน้าจอ
                if (targetItem.item_status) targetItem.item_status = status; // เคลียร์เผื่อไว้ทั้งสองชื่อคีย์
                
                // 4. 💾 สั่งบันทึกก้อนออเดอร์ที่อัปเดตแล้ว กลับทับลงฐานข้อมูลหลัก (IndexedDB)
                await db.orders.put(order);
                console.log(`💾 [Hub DB] บันทึกอัปเดตสถานะจานในคลังสำเร็จ: บิลเลขที่ ${orderId} -> จานรหัส ${itemId} เปลี่ยนเป็น '${status}'`);
            } else {
                console.warn(`⚠️ [Hub DB] เจอตัวบิล ${orderId} แต่ไม่พบรหัสจานอาหาร ${itemId} อยู่ข้างในบิล`);
            }
        } else {
            console.warn(`⚠️ [Hub DB] ไม่พบข้อมูลออเดอร์รหัส ${orderId} ในฐานข้อมูลหลักของเครื่องแม่`);
        }
    } catch (err) {
        console.error("❌ บั๊กในการบันทึกสถานะจานลง DB เครื่องแม่:", err);
    }
}

//สั่งเครื่องแม่ (Hub) รวบรวมคิวงานล่าสุด ยิงวาร์ปตอกกลับไปให้ห้องครัวตอนต่อเน็ตใหม่
async function responseKitchenSync() {
    if (!window.db || typeof sendP2PData !== 'function') return;
    try {
        // 1. ดึงข้อมูลรายการออเดอร์ทั้งหมดของวันนี้จากฐานข้อมูล
        const allOrders = await db.orders.toArray();
        
        // 2. นำข้อมูลมาจัดกลุ่ม (Group by order_id) เพื่อสร้างโครงสร้างตั๋วที่ครัวเข้าใจ
        const ticketsMap = {};
        allOrders.forEach(order => {
            // คัดกรองเอาเฉพาะรายการที่ยังทำไม่เสร็จ หรือบิลที่ยังมีของค้างอยู่
            if (!ticketsMap[order.order_id]) {
                ticketsMap[order.order_id] = {
                    orderId: order.order_id,
                    table: order.table_name || order.payment_method || "ทั่วไป", // ชื่อโต๊ะ
                    time: order.created_at ? order.created_at.split(' ')[1] : '',
                    items: []
                };
            }
            ticketsMap[order.order_id].items.push({
                name: order.menu_name,
                qty: order.qty,
                options: order.options,
                itemId: order.item_id,
                status: order.item_status || 'pending'
            });
        });

        //แปลงเป็นรูปแบบ Array และกรองเอาเฉพาะบิลที่มีของยังทำไม่เสร็จ (ตั๋วไม่ว่าง)
        const activeTickets = Object.values(ticketsMap).filter(ticket => {
            return ticket.items.some(item => item.status === 'pending');
        });

        // 3. แพ็กใส่กล่องสัญญาณวาร์ปดีดส่งกลับไปให้ห้องครัวจัดระเบียบหน้าจอทันที
        sendP2PData({
            type: 'KITCHEN_SYNC_RESPONSE',
            activeTickets: activeTickets
        });
        console.log(`🚀 [Hub Sync] ยิงกล่องข้อมูลตั๋วค้างจำนวน ${activeTickets.length} บิล ส่งกลับไปกู้หน้าจอครัวสำเร็จ`);

    } catch (err) {
        console.error("❌ ระบบตอบกลับ Sync ห้องครัวขัดข้อง:", err);
    }
}

/**
 * 👑 สกิลเครื่องแม่: ดึงข้อมูลโต๊ะที่เปิดอยู่ทั้งหมดในคลัง ยิงส่งกลับไปอัปเดตให้เครื่องลูกหน้าร้าน
 */
async function responseTableSync() {
    if (!window.db || typeof sendP2PData !== 'function') return;
    try {
        // 1. ดึงข้อมูลโต๊ะทั้งหมดที่กำลังทำงานอยู่ (สีส้ม) จากคลังเครื่องแม่
        const activeTables = await db.active_tables.toArray();
        
        // 2. แพ็กกล่องข้อมูลดีดส่งกลับไปให้เครื่องลูกหน้าร้านเอาไปวาด UI ใหม่
        sendP2PData({
            type: 'TABLE_SYNC_RESPONSE',
            activeTables: activeTables
        });
        console.log(`🚀 [Hub Table Sync] ยิงกล่องข้อมูลสถานะโต๊ะจำนวน ${activeTables.length} โต๊ะ กลับไปอัปเดตเครื่องลูกสำเร็จ`);
    } catch (err) {
        console.error("❌ ระบบตอบกลับซิงค์ผังโต๊ะขัดข้อง:", err);
    }
}

// ==========================================
// 📦 ระบบผสมร่าง: ตื่นมาทวง & ซิงค์บิลตกค้างย้อนหลัง (Bulk Sync Logic) 30-05-2026
// ==========================================

/**
 * ฟังก์ชันสั่งเปิดฉากการทวงถามออเดอร์ค้างส่ง (จะถูกสั่งรันอัตโนมัติเมื่อ P2P เชื่อมติด)
 */
// ประกาศตัวแปรล็อกสถานะไว้ที่ระดับ Global (นอกฟังก์ชัน) เพื่อให้ระบบจำค่าได้
if (typeof window.isSyncingInProgress === 'undefined') {
    window.isSyncingInProgress = false;
}

// เพิ่มตัวแปร Global ไว้ติดตามสถานะ (ใส่ไว้ในไฟล์ Config หรือจุดที่เหมาะสม)
window.lastSyncTime = window.lastSyncTime || null;
window.syncWatchdogTimer = null; // สำหรับจัดการเรื่อง timeout

async function triggerBackgroundSync() {
    // 🛡️ [ด่านกั้นร่างทรงซิงค์รัว]: ป้องกันไม่ให้รันหลายรอบพร้อมกัน
    if (window.isSyncingInProgress) {
        console.log('🛑 [Sync Guard] ปฏิเสธคำขอซิงค์ซ้ำ!');
        return;
    }

    console.log('🤝 [Sync Gateway] เริ่มทำงาน! เปิดประตูระบบล็อก...');
    window.isSyncingInProgress = true;

    // ⏱️ [Watchdog Timer] ป้องกันกรณีระบบเงียบหายไป
    // หากผ่านไป 5 วินาทีแล้วไม่มีการตอบกลับ (ACK/SYNC) ให้ปลดล็อกเองทันที
    window.syncWatchdogTimer = setTimeout(() => {
        if (window.isSyncingInProgress) {
            console.warn('⚠️ [Sync Watchdog] ตรวจพบการรอซิงค์นานเกินไป! ปลดล็อกเพื่อความปลอดภัย...');
            window.isSyncingInProgress = false;
        }
    }, 5000);

    try {
        if (typeof sendP2PData === 'function') {
            sendP2PData({ type: 'REQUEST_PENDING_ORDERS' });
        }
    } catch (err) {
        console.error("❌ เกิดข้อผิดพลาดในระบบ Gateway Sync:", err);
        clearTimeout(window.syncWatchdogTimer); // ถ้าพัง ต้องหยุดตัวจับเวลาด้วย
        window.isSyncingInProgress = false;
    }
}


/**
 * ขยายพอร์ตประตูเมืองกลาง (Centralized Logic) ของนาย
 * ให้นำโค้ด 3 ลอจิกนี้ ไปหยอดเพิ่มเข้าไปในฟังก์ชัน handleIncomingData(data) ปัจจุบันของนายครับ
 */
async function processSyncIncomingData(data) {
    // --- ด่านกั้นความปลอดภัยด่านแรก ---
    if (!data || !data.type) return;

    // 🔴 ลอจิกที่ 1: มีเครื่องอื่นยิงมาขอตรวจบิลค้างส่ง
    if (data.type === 'REQUEST_PENDING_ORDERS') {
        const pendingOrders = await db.orders.where('sync_status').equals('pending').toArray();
        
        if (pendingOrders.length > 0) {
            console.log(`🚀 [Sync] ส่งออกออเดอร์ค้างส่ง ${pendingOrders.length} รายการ`);
            if (typeof sendP2PData === 'function') {
                sendP2PData({ type: 'SYNC_BULK_ORDERS', ordersList: pendingOrders });
            }
        }
    }

    // 🔵 ลอจิกที่ 2: ฝั่งเครื่องรับ ได้รับมัดรวมออเดอร์ย้อนหลัง
    if (data.type === 'SYNC_BULK_ORDERS') {
        const incomingOrders = data.ordersList || [];
        if (incomingOrders.length === 0) return;

        // ใช้ Transaction เพื่อความปลอดภัย: ถ้าพังต้องย้อนกลับทั้งหมด
        const newOrders = await db.transaction('rw', db.orders, async () => {
            const saved = [];
            for (const order of incomingOrders) {
                const isExist = await db.orders.get(order.id);
                if (!isExist) {
                    saved.push(order);
                }
            }
            if (saved.length > 0) await db.orders.bulkAdd(saved);
            return saved;
        });

        // เฉพาะตอนมีของใหม่เข้ามาจริงเท่านั้น ถึงจะสั่งรื้อ UI
        if (newOrders.length > 0) {
            console.log(`🎉 [Sync] ลงบัญชีสำเร็จ ${newOrders.length} รายการ กำลังรีเฟรช UI...`);
            if (typeof loadRecentOrders === 'function') await loadRecentOrders();
            if (typeof fetchTodaySales === 'function') fetchTodaySales();
            if (typeof renderRecentOrdersUI === 'function') renderRecentOrdersUI();
            if (typeof renderTodayOrdersTableUI === 'function') renderTodayOrdersTableUI();
        }

        // ส่ง ACK กลับ
        if (typeof sendP2PData === 'function') {
            sendP2PData({
                type: 'ACK_SYNC_SUCCESS',
                orderDatabaseIds: incomingOrders.map(o => o.id)
            });
        }
    }

    // 🟢 ลอจิกที่ 3: ฝั่งเครื่องส่ง ได้รับคำยืนยัน -> ล้างสถานะค้างส่ง
    if (data.type === 'ACK_SYNC_SUCCESS') {
        const targetIds = data.orderDatabaseIds || [];
        if (targetIds.length > 0) {
            // ใช้ Bulk Update แทน Loop เพื่อไม่ให้หน้าจอหน่วงในเสี้ยววินาทีนั้น
            await db.orders.bulkUpdate(
                targetIds.map(id => ({ key: id, changes: { sync_status: 'completed' } }))
            );
            console.log(`🧼 [Sync] ล้างสถานะ 'completed' สำเร็จ ${targetIds.length} รายการ`);
        }
    }
}

/**
 * 🏁 [The First Aid] กู้ชีพข้อมูลจากคลัง DB ทันทีที่เครื่องตื่น
 * เรียกใช้ฟังก์ชันนี้ตอน window.onload เพื่อไม่ให้หน้าจอว่างเปล่าระหว่างรอต่อท่อแม่ 24-06-2026
 */
async function initLocalDisplay() {
    console.log("🔄 [Startup] ตรวจสอบคลังข้อมูลส่วนตัว...");

    try {
        // 1. ดึงข้อมูลทั้งหมดจาก Dexie DB ของเครื่องตัวเอง
        const localData = await db.orders.toArray();
        
        if (localData.length > 0) {
            console.log(`📦 [Startup] พบข้อมูลค้างในคลัง ${localData.length} รายการ กำลังกู้คืนหน้าจอ...`);

            // 2. ถ้าเป็นโหมดครัว: จัดการล้างจอแล้ววาดใหม่
            if (document.body.classList.contains('kitchen-mode')) {
                const container = document.getElementById('kitchen-ticket-container');
                if (container) container.innerHTML = '';
                
                // กรองเฉพาะอันที่ยังไม่ทำเสร็จมาโชว์
                const pendingOnly = localData.filter(o => o.sync_status !== 'completed');
                pendingOnly.forEach(ticket => {
                    if (typeof addKitchenTicket === 'function') addKitchenTicket(ticket);
                });
            }

            // 3. ถ้าเป็นโหมดเครื่องลูก (Client): สั่งเรนเดอร์ UI ผังโต๊ะและรายการอาหาร
            if (document.body.classList.contains('client-mode')) {
                if (typeof renderRecentOrdersUI === 'function') renderRecentOrdersUI(localData);
                if (typeof renderTableSelection === 'function') renderTableSelection();
            }

            console.log("✨ [Startup] หน้าจอพร้อมใช้งานด้วยข้อมูลเก่าแล้ว! (ไม่ต้องรอสัญญาณแม่)");
        } else {
            console.log("ℹ️ [Startup] คลังข้อมูลว่างเปล่า รอรับข้อมูลจากเครื่องแม่ตามปกติ...");
        }
    } catch (err) {
        console.error("❌ [Startup Error] เกิดข้อผิดพลาดในการกู้ชีพข้อมูล:", err);
    }
}

// ผูกไว้ที่จุดเริ่มของระบบ
window.addEventListener('load', initLocalDisplay);

//ท้ายเสมอ 30-05-2026
// ==========================================================================
// 📱 [ล่างสุดของไฟล์ p2p-network.js] 
// ระบบอัจฉริยะ: Auto-Resume (กู้ชีพสาย P2P ทันทีเมื่อหน้าจอตื่น)
// ==========================================================================
document.addEventListener('visibilitychange', async () => {
    
    // ทำงานทันทีเมื่อหน้าจอมือถือของคุณยายสว่างขึ้น หรือสลับแท็บกลับมาที่หน้าจอแอป POS
    if (document.visibilityState === 'visible') {
        console.log('🔄 [Auto-Resume] หน้าจอตื่นแล้วจ้า! กำลังตรวจเช็กสภาพท่อส่ง P2P...');

        // เช็กสถานะจากตัวแปรเชื่อมต่อจริงในไฟล์นี้ว่าสายขาดไปในช่วงที่จอดับหรือไม่
        const isWarpLive = (window.currentConn && window.currentConn.open === true);

        if (!isWarpLive) {
            console.log('⚡ [Auto-Resume] ตรวจพบว่าสาย P2P ขาดหาย! เริ่มแผนกู้ชีพด่วน...');
            
            // ดึง ID เครื่องแม่ล่าสุดมาเตรียมพร้อมใช้งาน
            const savedHubId = window.currentConn ? window.currentConn.peer : localStorage.getItem('last_hub_peer_id');
            
            if (savedHubId && typeof connectToHub === 'function') {
                console.log(`🔗 กำลังวาร์ปเชื่อมต่อสายใหม่ไปที่ไอดีแม่ [${savedHubId}] อัจฉริยะหลังบ้าน...`);
                connectToHub(savedHubId);
            } else {
                console.warn('⚠️ [Auto-Resume] ไม่สามารถเชื่อมต่ออัตโนมัติได้เนื่องจากไม่พบไอดีเป้าหมายล่าสุด');
            }
        } else {
            console.log('🟢 [Auto-Resume] สาย P2P ยังทำงานดีอยู่ ปลอดภัย 100% ไม่ต้องต่อสายซ้อนให้ท่อรวน');
        }
    }
});