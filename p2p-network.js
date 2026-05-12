/* 
========================================================================
   ระบบ P2P Network - ร้านยายขายทุกอย่าง
   อัปเดตล่าสุด: 06-05-2026 
========================================================================
*/

let peer = null;
let currentConn = null;
let connections = []; // สำหรับเครื่องแม่ที่ต้องจำเครื่องลูกหลายเครื่อง

// --- ฟังก์ชันหลักของระบบ Peer ---

/**
 * ฟังก์ชันสำหรับ "ดักฟัง" ข้อมูลที่วาร์ปผ่านการเชื่อมต่อ (Connection) 12-05-2026
 * [หน้าที่]: แยกแยะประเภทข้อมูล (ออเดอร์/การตอบกลับ) และสั่งงานให้ตรงตามบทบาทของเครื่องนั้นๆ
 */
function setupConnListeners(conn) {
    // 1. เมื่อมีข้อมูล (Data) วาร์ปมาถึง
    conn.on('data', function(data) {
        console.log("📩 [P2P] ข้อมูลวาร์ปมาถึงแล้ว:", data);

        // ตรวจสอบความถูกต้องของข้อมูลเบื้องต้น
        if (!data || !data.type) return;

        // ดึงโหมดปัจจุบันของเครื่องเรามาเช็ก
        const currentMode = localStorage.getItem('p2p_mode');

        // 🚩 [เคสที่ 1]: ถ้าเราเป็น "จอครัว" และได้รับข้อมูลประเภท ORDER
        if (currentMode === 'kitchen' && data.type === 'ORDER') {
            console.log("👨‍🍳 [Kitchen] ออเดอร์ใหม่เข้าครัว! กำลังเพิ่มตั๋ว...");
            
            // เรียกใช้ฟังก์ชันวาดตั๋วอาหาร (ใช้ข้อมูลจาก orderData ที่เครื่องแม่ส่งมา)
            if (typeof addKitchenTicket === 'function') {
                addKitchenTicket(data.orderData);
            } else {
                console.error("❌ [Error] หาฟังก์ชัน addKitchenTicket ไม่เจอครับพี่!");
            }
        }

        // 🚩 [เคสที่ 2]: ถ้าข้อมูลที่ส่งมาเป็นประเภทอื่น (เช่น การตอบกลับ ACK หรือแจ้งสถานะ)
        // ส่งต่อไปให้ handleIncomingData ช่วยจัดการต่อ เพื่อให้ตรรกะไม่ซ้ำซ้อน
        if (typeof handleIncomingData === 'function') {
            handleIncomingData(data);
        }
    });

    // 2. เมื่อการเชื่อมต่อถูกตัด (Close)
    conn.on('close', function() {
        console.warn("🔴 [P2P] การเชื่อมต่อสิ้นสุดลง (Disconnected)");
        
        // ถ้าเป็นจอครัว ให้แจ้งเตือนว่าหลุดจากเครื่องแม่แล้ว
        if (localStorage.getItem('p2p_mode') === 'kitchen') {
            alert("⚠️ ขาดการติดต่อกับเครื่องแม่! กรุณาตรวจสอบสถานะเครื่องแม่ครับ");
        }
    });

    // 3. เมื่อเกิดข้อผิดพลาด (Error)
    conn.on('error', function(err) {
        console.error("⚠️ [P2P] เกิดข้อผิดพลาดในการรับข้อมูล:", err);
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
 * ฟังก์ชันจัดการข้อมูลวาร์ป (Data Handler) - "สมอง" ของเครื่องแม่
 * ปรับปรุง: แก้ไขบั๊กสั่งกลับบ้านแล้วครัวเงียบ + จัดลำดับ UI Refresh ใหม่
 */
/**
 * ฟังก์ชันรับข้อมูลวาร์ป (P2P): เครื่องแม่ประมวลผลข้อมูลที่ส่งมาจากเครื่องลูก
 */
async function handleIncomingData(data) {
    console.log('🔔 [P2P] ได้รับข้อมูลวาร์ปใหม่:', data);
    
    if (!data || !data.type) return;

    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');

    // =========================================================
    // 🚩 [โหมดรับออเดอร์]: เครื่องแม่ประมวลผลข้อมูล
    // =========================================================
    if (data.type === 'ORDER_INCOMING') {
        
        // 1. เตรียมข้อมูลพื้นฐาน
        const isPayment = data.isPayment === true; 
        const tableStr = data.table ? String(data.table).trim() : "";
        const newItems = data.newOnly || (data.items ? data.items.filter(i => !i.fromDB) : []);
        const hasNewItems = newItems.length > 0;
        const method = data.payment_method || data.paymentType || 'Cash';

        console.log(`📊 ประมวลผล: โต๊ะ[${tableStr}] | ของใหม่[${newItems.length}] | จ่ายด้วย[${method}]`);

        // 2. จัดการตั๋วครัว (Kitchen Ticket) 
        if (hasNewItems) {
            console.log("👨‍🍳 [Action] พบออเดอร์ใหม่ -> เตรียมส่งเข้าครัว...");
            const kitchenData = { ...data, items: newItems };

            // 2.1 วาดตั๋วบนหน้าจอเครื่องแม่เอง (ถ้าเปิดโหมดดูครัวไว้)
            if (typeof addKitchenTicket === 'function') {
                addKitchenTicket(kitchenData); 
            }

            // 🚩 [จุดที่เพิ่มใหม่]: ส่งข้อมูลต่อไปยัง "จอครัว" ผ่าน P2P
            // เครื่องแม่ต้อง "ตะโกนบอก" ทุกเครื่องที่ต่ออยู่ว่า "มีออเดอร์เข้านะ!"
            if (typeof sendP2PData === 'function') {
                console.log("📢 [Broadcast] กำลังวาร์ปออเดอร์ไปที่จอครัว...");
                sendP2PData({
                    type: 'ORDER',      // ใช้ type 'ORDER' เพื่อให้ตรงกับที่ครัวรอฟัง
                    orderData: kitchenData
                });
            }
            
            if (typeof showOrderNotify === 'function') {
                showOrderNotify(`[โต๊ะ ${tableStr}] สั่งเพิ่ม ${newItems.length} รายการ!`);
            }
        }

        // 3. จัดการฐานข้อมูล (Database Management)
        // (ส่วนนี้คงเดิมตามของพี่ เพื่อบันทึกยอดขายและอัปเดตโต๊ะ)
        try {
            const isTakeAway = !tableStr || ['กลับบ้าน', 'ทั่วไป', ''].includes(tableStr);
            if (isPayment || isTakeAway) {
                if (typeof confirmOrder === 'function') {
                    await confirmOrder(method, true, data); 
                }
            } else {
                if (typeof saveOrderToTable === 'function') {
                    await saveOrderToTable(data, true);
                }
            }

            // 4. สั่งรีเฟรชหน้าจอแม่
            await Promise.all([
                (typeof renderTableSelection === 'function') ? renderTableSelection() : Promise.resolve(),
                (typeof loadRecentOrders === 'function') ? loadRecentOrders() : Promise.resolve(),
                (typeof fetchTodaySales === 'function') ? fetchTodaySales() : Promise.resolve()
            ]);
            if (typeof updateOrderList === 'function') updateOrderList();

        } catch (error) {
            console.error("❌ [Error] บันทึกข้อมูลวาร์ปล้มเหลว:", error);
        }

        // 5. ส่งสัญญาณ ACK (ตอบกลับ) ให้เครื่องลูก (ส่งหาเฉพาะเครื่องที่ส่งมา)
        if (typeof currentConn !== 'undefined' && currentConn && currentConn.open) {
            currentConn.send({ type: 'ACK_ORDER', orderId: data.orderId });
        }
        if (navigator.vibrate) navigator.vibrate(200); 
    }
    
    // --- ส่วนดักสัญญาณ ACK และสถานะอาหารเสร็จ (คงเดิม) ---
    if (data.type === 'ACK_ORDER') {
        if (statusDot && statusText) {
            statusDot.style.backgroundColor = '#2ecc71'; 
            statusText.innerText = 'วาร์ปสำเร็จ! แม่ได้รับแล้ว';
            setTimeout(() => { 
                if (statusDot) statusDot.style.backgroundColor = '#7f8c8d';
                if (statusText) statusText.innerText = 'ระบบพร้อมวาร์ป';
            }, 3000);
        }
    }

    if (data.type === 'ORDER_DONE' || data.type === 'ORDER_READY') {
        alert(`✅ อาหารโต๊ะ [ ${data.table || 'ไม่ระบุ'} ] เสร็จแล้วครับ!`);
    }
}

// ฟังก์ชันเสริม: คืนค่าสถานะไฟเป็นปกติ
function resetWarpStatus(dot, text) {
    if (dot && text) {
        dot.style.backgroundColor = '#bdc3c7'; 
        dot.style.boxShadow = 'none';
        text.innerText = 'ระบบวาร์ป: พร้อมส่งออเดอร์';
        text.style.color = '#6c757d';
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
 * ฟังก์ชันหลักเมื่อมีการสลับสวิตช์ เปิด/ปิด P2P
 * [คำอธิบาย]: ควบคุมการเชื่อมต่อ Peer และสถานะในเครื่องทั้งหมด
 */
/**
 * ฟังก์ชันควบคุมการเปิด-ปิด ระบบ P2P ผ่าน Checkbox
 * [หน้าที่]: สลับโหมดระหว่าง "ใช้งานเครื่องเดียว" และ "ระบบเครือข่าย"
 */
function toggleP2P() {
    const checkBox = document.getElementById("p2p-toggle");
    
    // ตรวจสอบว่ามี Checkbox จริงไหมเพื่อกัน Error
    if (!checkBox) return;

    if (checkBox.checked) {
        // --- 🟢 กรณีเปิดใช้งาน (Checked) ---
        console.log("🟢 ระบบเครือข่าย: กำลังเตรียมพร้อมใช้งาน...");
        
        // 1. บันทึกสถานะว่าเปิดระบบแล้ว
        localStorage.setItem('p2p_enabled', 'true');
        
        // 2. เริ่มต้นระบบ Peer (ถ้ายังไม่มีการสร้างไว้)
        if (typeof peer === 'undefined' || !peer) {
            peer = new Peer(); 
            // หมายเหตุ: setupPeerListeners คือตัวดักฟังสถานะพื้นฐานของ Peer
            if (typeof setupPeerListeners === 'function') {
                setupPeerListeners();
            }
        }
        
        console.log("ℹ️ ระบบพร้อมให้เลือกบทบาท (แม่/ลูก/ครัว)");

    } else {
        // --- 🔴 กรณีปิดการทำงาน (Unchecked) ---
        console.log("🔴 ระบบเครือข่าย: ปิดการทำงานและล้างข้อมูลค้าง");
        
        // 1. เรียกใช้ฟังก์ชันรีเซ็ตที่เราสร้างไว้ (สำคัญมาก!)
        // [ผล]: จะทำการ peer.destroy(), ลบ p2p_mode, และคืนหน้าจอปกติ
        if (typeof resetP2P === 'function') {
            resetP2P();
        } else {
            // กรณีไม่มีฟังก์ชัน resetP2P ให้ทำลาย Peer ตรงนี้เลย
            localStorage.setItem('p2p_enabled', 'false');
            localStorage.setItem('p2p_mode', 'none'); 
            if (typeof peer !== 'undefined' && peer) {
                peer.destroy();
                peer = null;
            }
        }

        // 2. จัดระเบียบหน้าจอคืนค่าเดิม (เช่น แสดงยอดเงินที่เคยซ่อน)
        if (typeof applyKitchenLogic === 'function') {
            applyKitchenLogic();
        }
    }

    // 🚩 3. อัปเดตป้ายสถานะทันที
    // [ผล]: ถ้าติ๊กออก ป้ายจะกลายเป็นสีเทา "Alone" ทันทีตามที่พี่ต้องการ
    if (typeof updateRoleDisplay === 'function') {
        updateRoleDisplay();
    }
}

//เครื่องแม่
/**
 * ฟังก์ชันตั้งค่าเครื่องให้เป็น "เครื่องแม่ (Hub)"
 * [หน้าที่]: เป็นศูนย์กลางรับข้อมูลจากเครื่องลูก และกระจายออเดอร์ไปยังจอครัว
 * [อัปเดตล่าสุด]: 12-05-2026 เพิ่มระบบจัดการ Connection สำหรับกระจายออเดอร์
 */
function setupAsHub() {
    // 1. ดึงชื่อร้าน (ID) จากช่อง Input
    const name = document.getElementById('shop-id-input').value;
    if (!name) return alert("กรุณาใส่ชื่อร้านก่อนครับ");
    
    // 2. เคลียร์การเชื่อมต่อเก่าทิ้งก่อน (ถ้ามี) เพื่อเริ่มระบบใหม่ให้นิ่งๆ
    if (typeof peer !== 'undefined' && peer) {
        peer.destroy();
    }
    
    // 3. สร้าง Peer ใหม่โดยใช้ชื่อร้านเป็น ID
    peer = new Peer(name); 

    // 🚩 [จุดสำคัญ]: ล้างรายชื่อเครื่องที่เชื่อมต่อสะสมไว้ เพื่อเริ่มนับใหม่เมื่อเปิดโหมด Hub
    if (typeof connections !== 'undefined') {
        connections = []; 
    }

    // 4. 🚩 [หัวใจหลัก]: รอรับการเชื่อมต่อที่ทักเข้ามา (Incoming Connection)
    // ไม่ว่าจะเป็น เครื่องลูก (Client) หรือ จอครัว (Kitchen) จะต้องผ่านประตูนี้
    peer.on('connection', (conn) => {
        console.log("📡 [Hub] มีเครื่องใหม่วาร์ปเข้ามาเชื่อมต่อ: " + conn.peer);

        // เก็บข้อมูลเครื่องที่ทักเข้ามาลงใน Array 'connections'
        // [ผล]: เพื่อให้ฟังก์ชัน sendP2PData รู้ว่าจะต้องวาร์ปออเดอร์ไปหาใครบ้าง
        if (typeof connections !== 'undefined') {
            connections.push(conn);
        }

        // 🚩 สั่งให้เครื่องแม่ "เงี่ยหูฟัง" ข้อมูลที่เครื่องนี้จะส่งมา (เช่น ออเดอร์จากเครื่องลูก)
        if (typeof setupConnListeners === 'function') {
            setupConnListeners(conn);
        }

        // เมื่อการเชื่อมต่อเปิดใช้งานสมบูรณ์
        conn.on('open', () => {
            console.log(`✅ เชื่อมต่อกับ [${conn.peer}] สำเร็จ`);
        });
    });
    
    // 5. ตั้งค่าตัวดักฟังสถานะพื้นฐานของ Peer
    if (typeof setupPeerListeners === 'function') {
        setupPeerListeners();
    }

    // 6. บันทึกโหมดลงในความจำเครื่อง
    localStorage.setItem('p2p_mode', 'hub');

    // 7. อัปเดตแถบสถานะ (Status Bar) ให้เป็นสีเขียว "เครื่องแม่ (Hub)"
    if (typeof updateRoleDisplay === 'function') {
        updateRoleDisplay();
    }

    alert("ตอนนี้เครื่องนี้คือ 'เครื่องแม่' แล้วครับ");
}

//เครื่องลูก 10-05-2026
function setupAsClient() {
    const name = document.getElementById('shop-id-input').value;
    if (!name) return alert("กรุณาใส่ชื่อร้านแม่เพื่อเชื่อมต่อครับ");

    // 🚩 1. ล้างระบบเก่า (Clean Up)
    if (peer) {
        console.log("♻️ ล้างระบบเชื่อมต่อเก่า...");
        peer.destroy(); 
        peer = null;
    }

    console.log("⏳ กำลังเริ่มระบบใหม่เพื่อเชื่อมต่อกับ: " + name);

    // 🚩 2. สร้าง Peer และเซตหูฟังระดับระบบ
    peer = new Peer(); 
    setupPeerListeners(); 

    // 🚩 3. เมื่อเครื่องลูกออนไลน์สำเร็จ (Register กับ Server สำเร็จ)
    peer.on('open', (id) => {
        console.log("✅ เครื่องลูกออนไลน์แล้ว (ID: " + id + ")");
        
        // ส่งสัญญาณ "เคาะประตู" ไปหาเครื่องแม่
        currentConn = peer.connect(name, {
            reliable: true
        });

        // จังหวะที่ท่อเชื่อมต่อ (Connection) เปิดใช้งานได้
        currentConn.on('open', () => {
            alert("✅ เชื่อมต่อสำเร็จ! ร้าน " + name + " พร้อมวาร์ปออเดอร์");
            localStorage.setItem('p2p_mode', 'client');

            //แถบสถานะ (Status Bar) P2P 12-05-2026
            updateRoleDisplay();

            // ✨ [จุดที่เพิ่มใหม่]: ติดตั้งหูฟังดักรับข้อมูลขากลับจากเครื่องแม่
            // สิ่งที่จะเกิดขึ้น: เมื่อแม่กด "ทำเสร็จแล้ว" ข้อมูลจะวิ่งเข้าบรรทัดนี้ทันที
            currentConn.on('data', (data) => {
                console.log("📥 ได้รับสัญญาณวาร์ปขากลับ:", data);
                
                // ตรวจสอบว่ามีฟังก์ชันจัดการข้อมูลไหม ถ้ามีให้สั่งทำงานทันที
                if (typeof handleIncomingData === 'function') {
                    handleIncomingData(data); 
                    // ข้อมูลจะถูกส่งไปเปลี่ยนสีไฟ หรือ Alert แจ้งเตือนพนักงานตามที่เราเขียนไว้
                }
            });
        });

        // ดัก Error กรณีท่อส่งข้อมูลระหว่างเครื่องมีปัญหา
        currentConn.on('error', (err) => {
            console.error("❌ เชื่อมต่อล้มเหลว:", err);
            alert("❌ ติดต่อเครื่องแม่ไม่ได้ ลองตรวจสอบว่าเครื่องแม่ยังออนไลน์อยู่ไหม");
        });
    });

    // 🚩 4. ดัก Error ระดับ Peer System
    peer.on('error', (err) => {
        if (err.type === 'peer-unavailable') {
            alert("❌ ไม่พบชื่อร้าน '" + name + "' (เครื่องแม่อาจยังไม่ได้เปิดโหมด P2P)");
        } else {
            console.error("Peer System Error:", err);
        }
    });
}

// จอครัว 12-05-2026
/**
 * ฟังก์ชันตั้งค่าเครื่องให้เป็น "จอครัว (KDS)"
 * [หน้าที่]: สร้างการเชื่อมต่อ P2P ไปยังเครื่องแม่ และเปลี่ยนหน้าจอให้เป็นระบบจัดการคิวอาหาร
 */
function setupAsKitchen() {
    // 1. ดึงชื่อร้าน (Peer ID ของเครื่องแม่) จากช่อง Input
    const targetId = document.getElementById('shop-id-input').value; 
    
    // ตรวจสอบว่าใส่ ID หรือยัง ถ้าไม่ใส่ให้หยุดและเตือนทันที
    if (!targetId) return alert("กรุณาใส่ชื่อร้าน (ID เครื่องแม่) ก่อนครับ");

    // 2. เคลียร์การเชื่อมต่อเก่า (ถ้ามี) เพื่อป้องกันการเชื่อมต่อซ้อนจนอืด
    if (typeof peer !== 'undefined' && peer) {
        console.log("♻️ กำลังรีเซ็ตการเชื่อมต่อเก่า...");
        peer.destroy();
    }
    
    // 3. เริ่มต้นระบบ Peer ใหม่
    peer = new Peer(); 

    // เมื่อ Peer พร้อมใช้งาน (ได้รับ ID ของตัวเองมาแล้ว)
    peer.on('open', (id) => {
        console.log("📡 Peer ID ของเครื่องครัวคือ: " + id);

        // 4. สั่ง "เชื่อมต่อ" ไปยัง ID เครื่องแม่ (Hub)
        const conn = peer.connect(targetId);

        // 🚩 [จุดสำคัญ]: เรียกใช้ฟังก์ชัน "ดักฟังข้อมูล" 
        // เพื่อให้เครื่องครัวรู้ว่าเมื่อไหร่ที่มีออเดอร์วาร์ปมาจากเครื่องแม่
        setupConnListeners(conn); 

        applyKitchenLogic(); // 🚩 เพิ่มตรงนี้ เพื่อให้หน้าจอจัดระเบียบทันทีที่เชื่อมต่อติด

        // 5. บันทึกบทบาทลงในความจำเครื่อง (LocalStorage) 
        // [ผล]: ค่านี้จะถูกนำไปใช้ใน applyKitchenLogic และ updateRoleDisplay
        localStorage.setItem('p2p_mode', 'kitchen');

        // 6. อัปเดตป้ายสถานะ (Badge) มุมจอทันที
        // [ผล]: ป้ายจะเปลี่ยนเป็นสีส้ม "👨‍🍳 จอครัว" โดยไม่ต้องรีเฟรชหน้าจอ
        if (typeof updateRoleDisplay === 'function') {
            updateRoleDisplay(); 
        }

        // 7. จัดระเบียบหน้าจอสำหรับโหมดครัว
        // [ผล]: ซ่อนยอดเงิน/กำไร และแสดงส่วนของตั๋วอาหารขึ้นมาแทน
        if (typeof applyKitchenLogic === 'function') {
            applyKitchenLogic();
        }

        // 8. แสดงหน้าจอครัว (Overlay) ที่พี่ทำไว้
        if (typeof showKitchen === 'function') {
            showKitchen();
        }

        console.log("✅ เชื่อมต่อระบบครัวสำเร็จ: กำลังรอออเดอร์...");
    });

    // กรณีเกิดความผิดพลาดในการเชื่อมต่อ (เช่น หา ID เครื่องแม่ไม่เจอ)
    peer.on('error', (err) => {
        console.error("❌ เกิดข้อผิดพลาด P2P:", err);
        alert("เชื่อมต่อไม่สำเร็จ: กรุณาเช็กว่า ID เครื่องแม่ถูกต้องและเครื่องแม่เปิดระบบอยู่ครับ");
    });
}

/**
 * ฟังก์ชันจัดการระเบียบหน้าจอสำหรับโหมดครัว
 * [หน้าที่]: สั่งซ่อนส่วนที่ไม่เกี่ยวข้องกับคนทำอาหาร (เช่น ยอดขาย, กำไร) 
 * และแสดงปุ่มที่จำเป็นสำหรับงานครัวเท่านั้น
 */
function applyKitchenLogic() {
    const p2pMode = localStorage.getItem('p2p_mode');
    
    // 1. ดึง Element ที่เกี่ยวข้องกับการเงิน (ปรับ ID ตามที่พี่ใช้จริงนะครับ)
    const financialSection = document.getElementById('financial-summary'); 
    const profitText = document.getElementById('profit-display');
    const posButtons = document.getElementById('pos-action-buttons'); // ปุ่มกดสั่งอาหารหน้าหลัก

    if (p2pMode === 'kitchen') {
        console.log("🧹 [Logic] กำลังจัดระเบียบหน้าจอสำหรับคนทำอาหาร...");
        
        // ซ่อนส่วนที่เป็นความลับทางการเงิน
        if (financialSection) financialSection.style.display = 'none';
        if (profitText) profitText.style.display = 'none';
        
        // อาจจะซ่อนปุ่มขายของหน้าหลัก เพื่อกันคนเผลอไปกดสั่งซ้อน
        if (posButtons) posButtons.style.display = 'none';
        
        // สั่งเปิดหน้าจอครัว (Overlay) ทันที
        if (typeof showKitchen === 'function') showKitchen();

    } else {
        // กรณีไม่ใช่โหมดครัว (เช่น กลับมาเป็น Standalone หรือ Hub) ให้โชว์ทุกอย่างตามปกติ
        if (financialSection) financialSection.style.display = 'block';
        if (profitText) profitText.style.display = 'block';
        if (posButtons) posButtons.style.display = 'block';
        
        console.log("🏠 [Logic] กลับสู่โหมดการทำงานปกติ");
    }
}

// --- ฟังก์ชันการทำงานอื่นๆ (KDS / Kitchen) ---

/**
 * ฟังก์ชันส่งข้อมูลผ่านระบบ P2P 12-05-2026
 * [หน้าที่]: ส่งข้อมูล (Payload) จากเครื่องเราไปยังเครื่องอื่นๆ ที่เชื่อมต่ออยู่
 * [พิเศษ]: รองรับการส่งหาหลายเครื่องพร้อมกัน (Broadcast) สำหรับเครื่องแม่
 */
function sendP2PData(payload) {
    const isEnabled = localStorage.getItem('p2p_enabled') === 'true';
    
    // 1. ตรวจสอบก่อนว่าเปิดระบบ P2P อยู่หรือไม่
    if (!isEnabled) {
        console.warn("⚠️ ไม่สามารถส่งข้อมูลได้: ระบบ P2P ถูกปิดอยู่");
        return;
    }

    // 2. กรณีเครื่องทั่วไป (มี Connection เดียว เช่น เครื่องลูกส่งหาเครื่องแม่)
    if (currentConn && currentConn.open) {
        currentConn.send(payload);
        console.log("📤 [P2P] ส่งข้อมูลสำเร็จ (Single Connection)");
    } 

    // 3. 🚩 [จุดสำคัญสำหรับเครื่องแม่]: กระจายข้อมูลให้ทุกเครื่อง (Broadcast)
    // เช็กว่ามีรายการเครื่องที่เชื่อมต่อสะสมไว้ใน Array หรือไม่
    if (typeof connections !== 'undefined' && Array.isArray(connections)) {
        let sentCount = 0;
        
        connections.forEach((conn, index) => {
            if (conn && conn.open) {
                conn.send(payload);
                sentCount++;
            }
        });

        if (sentCount > 0) {
            console.log(`📢 [Broadcast] วาร์ปข้อมูลไปทั้งหมด ${sentCount} เครื่องเรียบร้อย!`);
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
 * อัปเดตล่าสุด: 10-05-2026 | รองรับระบบแจ้งเตือนและแอนิเมชั่น
 */
function addKitchenTicket(data) {
    // 1. ตรวจสอบพื้นที่วางตั๋ว (Container)
    const container = document.getElementById('kitchen-ticket-container');
    if (!container) {
        console.error("❌ ไม่พบพื้นที่ kitchen-ticket-container ใน HTML");
        return;
    }

    // 2. ป้องกันข้อมูลขยะ
    if (!data || !data.items || data.items.length === 0) {
        console.warn("⚠️ ข้อมูลออเดอร์ไม่ถูกต้อง");
        return;
    }

    // 3. ป้องกันตั๋วซ้ำ
    const ticketId = `ticket-${data.orderId}`;
    if (document.getElementById(ticketId)) {
        console.log(`📌 ตั๋วเลขที่ ${data.orderId} มีอยู่ในหน้าจอแล้ว`);
        return;
    }

    // 4. สร้างโครงสร้าง HTML ของตั๋ว
    const ticketHtml = `
        <div class="kitchen-ticket" id="${ticketId}" 
             style="background: #fff; border-left: 8px solid #e67e22; border-radius: 12px; padding: 18px; margin-bottom: 15px; 
                    box-shadow: 0 6px 12px rgba(0,0,0,0.1); font-family: 'Kanit', sans-serif; 
                    animation: slideIn 0.4s ease-out;">
            
            <div style="display: flex; justify-content: space-between; border-bottom: 2px dashed #eee; padding-bottom: 10px; margin-bottom: 10px;">
                <strong style="font-size: 1.3em; color: #2c3e50;">📍 โต๊ะ: ${data.table || 'ไม่ระบุ'}</strong>
                <span style="color: #e67e22; font-weight: bold;">🕒 ${data.time || new Date().toLocaleTimeString()}</span>
            </div>

            <div style="padding: 5px 0; min-height: 40px;">
                ${data.items.map(item => {
                    // 🔥 [จุดที่เพิ่มใหม่]: ดึงข้อมูล "พิเศษ" (options)
                    // ถ้ามีข้อมูลจะแสดงเป็นตัวหนาสีแดงเพื่อให้พ่อครัวสะดุดตา
                    const optionDisplay = item.options 
                        ? `<div style="color: #e74c3c; font-size: 0.9em; font-weight: bold; margin-top: 2px;">✨ ${item.options}</div>` 
                        : '';

                    return `
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; border-bottom: 1px solid #f1f1f1; padding-bottom: 8px;">
                            <div style="flex: 1;">
                                <div style="color: #34495e; font-size: 1.15em; font-weight: 500;">🍳 ${item.name}</div>
                                ${optionDisplay} </div>
                            <div style="margin-left: 10px;">
                                <strong style="color: #d35400; background: #fff5eb; padding: 4px 10px; border-radius: 6px; font-size: 1.2em; border: 1px solid #ffe0c1;">
                                    x${item.qty || item.quantity || 1}
                                </strong>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            ${data.note ? `<div style="font-size: 0.95em; color: #e67e22; background: #fff9f4; padding: 8px; border-radius: 6px; margin-top: 5px; border: 1px solid #ffefe0;">📝 หมายเหตุ: ${data.note}</div>` : ''}

            <button onclick="markAsDoneP2P('${data.orderId}', '${data.table}')" 
                    style="width: 100%; background: #27ae60; color: white; border: none; padding: 14px; border-radius: 8px; 
                           font-weight: bold; cursor: pointer; font-size: 1.1em; transition: 0.2s; margin-top: 15px;
                           box-shadow: 0 4px 0 #1e8449;"
                    onmousedown="this.style.transform='translateY(2px)'; this.style.boxShadow='0 2px 0 #1e8449'"
                    onmouseup="this.style.transform='translateY(0px)'; this.style.boxShadow='0 4px 0 #1e8449'">
                ✅ ทำเสร็จแล้ว (วาร์ปบอกพนักงาน)
            </button>
        </div>
    `;

    // 5. สั่งวาดตั๋ว: ออเดอร์ใหม่เด้งขึ้นบนสุด
    container.insertAdjacentHTML('afterbegin', ticketHtml);
    
    // 6. แจ้งเตือนด้วยการสั่น
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    
    console.log(`🎯 วาดตั๋วโต๊ะ ${data.table} พร้อมรายละเอียดพิเศษสำเร็จ!`);
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

// ฟังก์ชันแจ้งเตือนเครื่องลูก (เรียกใช้เมื่อครัวกดปุ่มทำเสร็จ) 07-05-2026
/**
 * ฟังก์ชันเมื่อพ่อครัวกด "ทำเสร็จแล้ว" (เครื่องแม่ -> เครื่องลูก)
 * อัปเดต: 10-05-2026
 */
function markAsDoneP2P(orderId, table) {
    // 1. เตรียมข้อมูลส่งกลับ (Payload)
    // เปลี่ยนจาก itemName เป็น table เพื่อให้พนักงานรู้ว่าต้องไปเสิร์ฟที่ "โต๊ะไหน"
    const donePayload = {
        type: 'ORDER_DONE', // หรือ 'ORDER_READY' ตามที่เราดักไว้ใน handleIncomingData
        orderId: orderId,
        table: table // ส่งเลขโต๊ะกลับไป
    };

    // 2. ตรวจสอบท่อวาร์ปก่อนส่ง
    if (typeof currentConn !== 'undefined' && currentConn && currentConn.open) {
        // ส่งข้อมูลวาร์ปกลับไปหาเครื่องลูก
        currentConn.send(donePayload);
        console.log(`📤 แจ้งพนักงานแล้ว: อาหารโต๊ะ ${table} เสร็จแล้ว`);

        // 3. เอฟเฟกต์ลบตั๋วออกจากหน้าจอครัว (ทำตามที่พี่เขียนมาเลย สวยมาก!)
        const ticket = document.getElementById(`ticket-${orderId}`);
        if (ticket) {
            ticket.style.transition = "all 0.3s ease"; // เพิ่ม transition เพื่อความนุ่มนวล
            ticket.style.transform = "scale(0.8)";
            ticket.style.opacity = "0";
            setTimeout(() => {
                ticket.remove();
                console.log(`🗑️ ลบตั๋ว ${orderId} ออกจากหน้าจอแล้ว`);
            }, 300);
        }
    } else {
        // กรณีท่อหลุด ส่งไม่ได้ ให้แจ้งเตือนพ่อครัว
        alert("❌ ส่งข้อมูลหาพนักงานไม่ได้: กรุณาตรวจสอบการเชื่อมต่อ");
    }
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