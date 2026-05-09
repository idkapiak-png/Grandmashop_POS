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

function handleIncomingData(data) {
    console.log('🔔 ได้รับข้อมูล:', data);
    
    if (data.type === 'ORDER_INCOMING') {
        console.log('👨‍🍳 ออเดอร์ใหม่วาร์ปเข้าครัว!');
        if (typeof addKitchenTicket === 'function') {
            addKitchenTicket(data);
        }
    }
    
    if (data.type === 'ORDER_DONE') {
        alert(`✅ อาหารเสร็จแล้ว: ${data.itemName}`);
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

// ฟังก์ชันสร้างตั๋วอาหารในครัว (KDS) 07-05-2026
function addKitchenTicket(data) {
    const container = document.getElementById('kitchen-ticket-container');
    if (!container) return;

    const ticketId = `ticket-${data.orderId}`;
    const ticketHtml = `
        <div class="kitchen-ticket" id="${ticketId}" style="background: #fff; border-left: 8px solid #e67e22; border-radius: 8px; padding: 15px; margin-bottom: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                <strong style="font-size: 1.2em;">📍 โต๊ะ: ${data.table}</strong>
                <span style="color: #888;">${data.time}</span>
            </div>
            <div style="padding: 10px 0;">
                ${data.items.map(item => `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <span>- ${item.name}</span>
                        <strong>x${item.quantity || 1}</strong>
                    </div>
                `).join('')}
            </div>
            <button onclick="markAsDoneP2P('${data.orderId}', '${data.items[0]?.name || 'รายการอาหาร'}')" 
                    style="width: 100%; background: #27ae60; color: white; border: none; padding: 10px; border-radius: 5px; font-weight: bold; cursor: pointer;">
                ✅ ทำเสร็จแล้ว (แจ้งพนักงาน)
            </button>
        </div>
    `;
    container.insertAdjacentHTML('afterbegin', ticketHtml); // ออเดอร์ใหม่ขึ้นบนสุด
}

// ฟังก์ชันแจ้งเตือนเครื่องลูก (เรียกใช้เมื่อครัวกดปุ่มทำเสร็จ) 07-05-2026
function markAsDoneP2P(orderId, itemName) {
    const donePayload = {
        type: 'ORDER_DONE',
        orderId: orderId,
        itemName: itemName
    };

    // ส่งข้อมูลกลับไปหาเครื่องลูก
    if (currentConn && currentConn.open) {
        currentConn.send(donePayload);
        
        // ลบตั๋วออกจากหน้าจอครัว
        const ticket = document.getElementById(`ticket-${orderId}`);
        if (ticket) {
            ticket.style.transform = "scale(0.8)";
            ticket.style.opacity = "0";
            setTimeout(() => ticket.remove(), 300);
        }
    }
}