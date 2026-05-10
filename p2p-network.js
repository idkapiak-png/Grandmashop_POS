/* 
========================================================================
   ระบบ P2P Network - ร้านยายขายทุกอย่าง
   อัปเดตล่าสุด: 06-05-2026 
========================================================================
*/

let peer = null;
let currentConn = null;

// --- ฟังก์ชันหลักของระบบ Peer ---

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
 * ฟังก์ชันจัดการข้อมูลเข้า (Universal Handler)
 * อัปเดตล่าสุด: 10-05-2026 | ปรับโฉมเป็น "ไฟสถานะ" (Indicator Mode)
 */
function handleIncomingData(data) {
    console.log('🔔 ได้รับข้อมูลวาร์ป:', data);
    
    if (!data || !data.type) return;

    // --- 1. เครื่องแม่: รับออเดอร์ (เหมือนเดิม) ---
    if (data.type === 'ORDER_INCOMING') {
        if (typeof addKitchenTicket === 'function') {
            addKitchenTicket(data);

            if (typeof currentConn !== 'undefined' && currentConn && currentConn.open) {
                currentConn.send({
                    type: 'ACK_ORDER',
                    orderId: data.orderId,
                    receivedAt: new Date().toLocaleTimeString('th-TH')
                });
            }
            if (navigator.vibrate) navigator.vibrate(200); 
        }
    }
    
    // --- 2. เครื่องลูก: รับการยืนยัน (โหมดไฟสัญญาณ ✅) ---
    if (data.type === 'ACK_ORDER') {
        console.log('✅ ครัวได้รับออเดอร์แล้ว:', data.orderId);
        
        // ค้นหาแถบสถานะ และ วงกลมไฟ
        const statusContainer = document.getElementById('warp-status-bar');
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');

        if (statusContainer && statusDot && statusText) {
            // จังหวะที่ 1: เปลี่ยนเป็นสถานะ "สำเร็จ"
            statusDot.style.backgroundColor = '#2ecc71'; // ไฟเขียวสด
            statusDot.style.boxShadow = '0 0 10px #2ecc71'; // เพิ่มแสงฟุ้งให้ดูมีพลัง
            statusText.innerText = 'วาร์ปสำเร็จ! ครัวได้รับแล้ว';
            statusText.style.color = '#27ae60';
            
            if (navigator.vibrate) navigator.vibrate([50, 30, 50]);

            // จังหวะที่ 2: คืนค่ากลับเป็นสถานะ "พร้อม" (Standby) หลังจาก 2 วินาที
            setTimeout(() => {
                statusDot.style.backgroundColor = '#bdc3c7'; // กลับเป็นสีเทา
                statusDot.style.boxShadow = 'none';
                statusText.innerText = 'ระบบวาร์ป: พร้อมส่งออเดอร์';
                statusText.style.color = '#6c757d';
            }, 2000);
        }
    }

    // --- 3. แจ้งเตือนเมื่ออาหารเสร็จ (เหมือนเดิม) ---
    if (data.type === 'ORDER_DONE' || data.type === 'ORDER_READY') {
        const tableInfo = data.table || 'ไม่ระบุโต๊ะ';
        alert(`✅ อาหารโต๊ะ [ ${tableInfo} ] เสร็จเรียบร้อยแล้วครับ!`);
        if (navigator.vibrate) navigator.vibrate(500); 
    }
}

// --- ฟังก์ชันควบคุมหน้าจอ (UI) ---

function toggleP2P() {
    const checkBox = document.getElementById("p2p-toggle");
    if (checkBox.checked) {
        console.log("🟢 ระบบเครือข่าย: กำลังเปิดใช้งาน...");
        localStorage.setItem('p2p_enabled', 'true');
        if (!peer) {
            peer = new Peer(); 
            setupPeerListeners();
        }
    } else {
        console.log("🔴 ระบบเครือข่าย: ปิดการทำงาน");
        localStorage.setItem('p2p_enabled', 'false');
        if (peer) {
            peer.destroy();
            peer = null;
            currentConn = null;
        }
    }
}

function setupAsHub() {
    const name = document.getElementById('shop-id-input').value;
    if (!name) return alert("กรุณาใส่ชื่อร้านก่อนครับ");
    
    if (peer) peer.destroy(); // เคลียร์ของเก่าก่อนเปลี่ยนโหมด
    
    peer = new Peer(name); 
    setupPeerListeners();
    localStorage.setItem('p2p_mode', 'hub');
    alert("ตอนนี้เครื่องนี้คือ 'เครื่องแม่' แล้วครับ");
}

function setupAsClient() {
    const name = document.getElementById('shop-id-input').value;
    if (!name) return alert("กรุณาใส่ชื่อร้านแม่เพื่อเชื่อมต่อครับ");

    // 🚩 จุดสำคัญ: ถ้าเคยมี Peer ค้างอยู่ ให้ทำลายทิ้งก่อนสร้างใหม่
    if (peer) {
        console.log("♻️ ล้างระบบเชื่อมต่อเก่า...");
        peer.destroy(); 
        peer = null;
    }

    console.log("⏳ กำลังเริ่มระบบใหม่เพื่อเชื่อมต่อกับ: " + name);

    // สร้าง Peer ใหม่ทุกครั้งที่กด เพื่อป้องกัน ID ค้าง
    peer = new Peer(); 
    setupPeerListeners();

    // รอให้ Peer ของเครื่องลูกจดทะเบียนกับ Server สำเร็จก่อน (Event 'open')
    peer.on('open', (id) => {
        console.log("✅ เครื่องลูกออนไลน์แล้ว (ID: " + id + ")");
        
        // เมื่อตัวเองพร้อมค่อยไป "เคาะประตู" เรียกเครื่องแม่
        currentConn = peer.connect(name, {
            reliable: true
        });

        currentConn.on('open', () => {
            alert("✅ เชื่อมต่อสำเร็จ! ร้าน " + name + " รับออเดอร์ได้เลย");
            localStorage.setItem('p2p_mode', 'client');
        });

        currentConn.on('error', (err) => {
            console.error("❌ เชื่อมต่อล้มเหลว:", err);
            alert("❌ หาเครื่องแม่ชื่อ '" + name + "' ไม่เจอ ลองเช็คชื่ออีกครั้งครับ");
        });
    });

    // ดัก Error ระดับระบบ (เช่น เน็ตหลุด)
    peer.on('error', (err) => {
        if (err.type === 'peer-unavailable') {
            alert("❌ ไม่พบชื่อร้าน '" + name + "' ในระบบ (เครื่องแม่อาจจะยังไม่ได้เปิด)");
        } else {
            console.error("Peer System Error:", err);
        }
    });
}

// --- ฟังก์ชันการทำงานอื่นๆ (KDS / Kitchen) ---

function sendP2PData(payload) {
    const isEnabled = localStorage.getItem('p2p_enabled') === 'true';
    if (isEnabled && currentConn && currentConn.open) {
        currentConn.send(payload);
    }
}

function markAsDone(orderId, itemName) {
    sendP2PData({
        type: 'ORDER_DONE',
        orderId: orderId,
        itemName: itemName
    });
}

function addKitchenTicket(orderData) {
    const container = document.getElementById('kitchen-ticket-container');
    if (!container) return;

    const ticketHtml = `
        <div class="kitchen-ticket" id="ticket-${orderData.orderId}" style="background: white; width: 250px; border-radius: 10px; padding: 15px; box-shadow: 0 4px 8px rgba(0,0,0,0.2); color: #333; margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #eee; padding-bottom: 5px;">
                <strong style="font-size: 1.2em;">📍 โต๊ะ: ${orderData.table || '-'}</strong>
            </div>
            <div style="margin: 10px 0;">
                ${orderData.items ? orderData.items.map(item => `
                    <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #eee;">
                        <span>- ${item.name}</span>
                        <strong>x ${item.quantity || 1}</strong>
                    </div>
                `).join('') : 'ไม่มีรายการ'}
            </div>
            <button onclick="completeTicket('${orderData.orderId}')" style="width: 100%; background: #27ae60; color: white; border: none; padding: 10px; border-radius: 5px; font-weight: bold; cursor: pointer; margin-top: 5px;">
                ✅ ทำเสร็จแล้ว
            </button>
        </div>
    `;
    container.innerHTML += ticketHtml;
}

function completeTicket(orderId) {
    const ticket = document.getElementById(`ticket-${orderId}`);
    if (ticket) {
        ticket.style.opacity = '0.3';
        setTimeout(() => { ticket.remove(); }, 500);
    }
}

//ฝั่งเครื่องลูก: สั่งอาหาร (ส่งข้อมูลไปเครื่องแม่)
// ฟังก์ชันส่งออเดอร์ (เรียกใช้เมื่อกดปุ่ม "สั่งอาหาร") 09-05-2026
// ปรับให้รับค่า data เพื่อรับช่วงต่อจาก executeOrderSent()
function submitOrderP2P(data) {
    // 1. ตรวจสอบว่ามีข้อมูลส่งมาไหม ถ้าไม่มีให้ดึงเอง (สำรองไว้)
    const orderPayload = data || {
        type: 'ORDER_INCOMING',
        orderId: 'ORD-' + Date.now(),
        table: document.getElementById('table-number')?.value || 'ทั่วไป',
        items: cart, 
        time: new Date().toLocaleTimeString('th-TH')
    };

    // 2. ส่งข้อมูลผ่านท่อ P2P (ใช้ชื่อฟังก์ชันส่งของพี่ที่มีอยู่จริง)
    // หมายเหตุ: พี่ต้องเช็คว่าในไฟล์ p2p-network.js พี่ใช้ชื่อ sendP2PData หรือ currentConn.send
    if (typeof sendP2PData === 'function') {
        sendP2PData(orderPayload);
        // alert("👨‍🍳 ส่งออเดอร์เข้าครัวสำเร็จ!"); // (เอาออกได้ถ้าพี่ใส่ alert ใน saveOrderToTable แล้ว)
    } else if (currentConn && currentConn.open) {
        currentConn.send(orderPayload);
        console.log("✅ ส่งข้อมูลผ่าน currentConn.send สำเร็จ");
    } else {
        console.error("ระบบ P2P ยังไม่พร้อม");
    }
}

/**
 * 1. ฟังก์ชันสำหรับเปิดโหมดห้องครัว (สลับหน้าจอ)
 * ปรับปรุง: 10-05-2026
 */
function showKitchen() {
    console.log("👨‍🍳 ระบบกำลังเตรียมหน้าจอ KDS...");
    
    // สิ่งที่จะเกิดขึ้น: สลับการแสดงผล (Toggle)
    // พี่ต้องมี ID เหล่านี้ใน HTML เพื่อให้มันสลับหน้ากันได้จริงๆ
    const posInterface = document.getElementById('pos-interface'); // หน้าขาย
    const kitchenInterface = document.getElementById('kitchen-display'); // หน้าครัว

    if (posInterface && kitchenInterface) {
        posInterface.style.display = 'none';      // ซ่อนหน้าขาย
        kitchenInterface.style.display = 'block'; // โชว์หน้าครัว
        console.log("✅ เปลี่ยนหน้าจอเป็นโหมดห้องครัวเรียบร้อย");
    } else {
        // ถ้าหา Element ไม่เจอ จะแจ้งเตือนกันพลาด
        alert("⚠️ ไม่พบ Element สำหรับหน้าจอครัว กรุณาตรวจสอบ ID ใน HTML ครับ");
    }
}

/**
 * 2. ฟังก์ชันสร้างตั๋วอาหารในครัว (KDS)
 * ปรับปรุง: 10-05-2026 (รองรับข้อมูลจากการวาร์ป P2P)
 */
function addKitchenTicket(data) {
    // สิ่งที่จะเกิดขึ้น: ตรวจสอบพื้นที่วางตั๋ว
    const container = document.getElementById('kitchen-ticket-container');
    if (!container) {
        console.error("❌ ไม่พบพื้นที่ kitchen-ticket-container สำหรับวางตั๋วอาหาร");
        return;
    }

    // สิ่งที่จะเกิดขึ้น: ป้องกันการรับข้อมูลที่ไม่มีเมนูอาหาร
    if (!data.items || data.items.length === 0) {
        console.warn("⚠️ ข้อมูลออเดอร์ไม่มีรายการอาหาร");
        return;
    }

    const ticketId = `ticket-${data.orderId}`;
    
    // ตรวจสอบว่ามีตั๋ว ID นี้อยู่แล้วหรือยัง (ป้องกันการส่งซ้ำ)
    if (document.getElementById(ticketId)) return;

    const ticketHtml = `
        <div class="kitchen-ticket" id="${ticketId}" 
             style="background: #fff; border-left: 8px solid #e67e22; border-radius: 8px; padding: 15px; margin-bottom: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); font-family: sans-serif;">
            
            <div style="display: flex; justify-content: space-between; border-bottom: 2px dashed #eee; padding-bottom: 8px;">
                <strong style="font-size: 1.2em; color: #2c3e50;">📍 โต๊ะ: ${data.table}</strong>
                <span style="color: #888;">🕒 ${data.time}</span>
            </div>

            <div style="padding: 10px 0; min-height: 50px;">
                ${data.items.map(item => `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 1.1em;">
                        <span>🍴 ${item.name}</span>
                        <strong style="color: #e67e22;">x${item.quantity || 1}</strong>
                    </div>
                `).join('')}
            </div>

            <button onclick="markAsDoneP2P('${data.orderId}', '${data.table}')" 
                    style="width: 100%; background: #27ae60; color: white; border: none; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 1em; transition: 0.3s;">
                ✅ ทำเสร็จแล้ว (แจ้งพนักงาน)
            </button>
        </div>
    `;

    // สิ่งที่จะเกิดขึ้น: ออเดอร์ใหม่จะเด้งไปอยู่บนสุดของหน้าจอครัว
    container.insertAdjacentHTML('afterbegin', ticketHtml);
    
    // แถม: เสียงแจ้งเตือนออเดอร์ใหม่ (ถ้ามีไฟล์เสียง)
    // playNotificationSound(); 
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