/* 
========================================================================
   ระบบ P2P Network - ร้านยายขายทุกอย่าง
   อัปเดตล่าสุด: 05-05-2026 
========================================================================
*/

let peer = null;
let currentConn = null;

// ฟังก์ชันสำหรับ "เปิดระบบ" (เครื่องแม่)
function startAsHub(shopName) {
    // ใช้ชื่อร้านเป็น ID ให้เครื่องลูกหาเจอได้ง่าย
    peer = new Peer(shopName); 
    
    peer.on('open', (id) => {
        console.log('✅ ระบบ P2P พร้อมใช้งานในชื่อร้าน: ' + id);
        localStorage.setItem('p2p_mode', 'hub');
    });

    peer.on('connection', (conn) => {
        currentConn = conn;
        
        // 🌟 รวมการรับข้อมูล: ทั้งออเดอร์ใหม่ และสถานะจากครัว
        currentConn.on('data', (data) => {
            console.log('🔔 ได้รับข้อมูล:', data);
            
            // เมื่อได้รับออเดอร์ (ส่งจากเครื่องลูกมาเครื่องแม่/ครัว)
            if (data.type === 'ORDER_INCOMING') {
                console.log('👨‍🍳 ออเดอร์ใหม่วาร์ปเข้าครัว!');
                // เรียกใช้ฟังก์ชันสร้างตั๋ว (KDS)
                if (typeof addKitchenTicket === 'function') {
                    addKitchenTicket(data);
                }
            }
            
            // เมื่อห้องครัวแจ้งว่าทำเสร็จแล้ว
            if (data.type === 'ORDER_DONE') {
                console.log('✅ อาหารเสร็จแล้ว:', data.itemName);
            }
        });
    });
}

// ฟังก์ชันสำหรับ "เชื่อมต่อ" (เครื่องลูก)
function connectToHub(targetShopName) {
    peer = new Peer();
    peer.on('open', () => {
        currentConn = peer.connect(targetShopName);
        currentConn.on('open', () => {
            console.log('🔗 เชื่อมต่อกับเครื่องแม่สำเร็จ!');
            localStorage.setItem('p2p_mode', 'client');
        });

        // เครื่องลูกรอรับข้อมูล (เช่น ครัวส่งสัญญาณบอกว่าอาหารเสร็จแล้ว)
        currentConn.on('data', (data) => {
            if (data.type === 'ORDER_DONE') {
                alert(`🔔 อาหารเสร็จแล้ว: ${data.itemName} (โต๊ะ ${data.table || '?'})`);
            }
        });
    });
}

// ฟังก์ชัน "ส่งข้อมูล" (ใช้ร่วมกัน)
function sendP2PData(payload) {
    // เช็คก่อนว่า "เปิดสวิตช์" ระบบเน็ตเวิร์กไว้หรือไม่
    const isEnabled = localStorage.getItem('p2p_enabled') === 'true';
    
    if (isEnabled && currentConn && currentConn.open) {
        currentConn.send(payload);
    }
}

// โค้ดควบคุมปุ่ม
function toggleP2P() {
    const isEnabled = document.getElementById('p2p-toggle').checked;
    const settingsDiv = document.getElementById('p2p-settings');
    
    // บันทึกสถานะไว้ในเครื่อง ลูกค้าไม่ต้องตั้งค่าใหม่ทุกครั้งที่เปิดแอป
    localStorage.setItem('p2p_enabled', isEnabled);
    
    if (isEnabled) {
        if (settingsDiv) settingsDiv.style.display = 'block';
    } else {
        if (settingsDiv) settingsDiv.style.display = 'none';
        // ถ้าปิดสวิตช์ ให้ตัดการเชื่อมต่อทั้งหมด
        if (peer) peer.destroy();
        console.log("🚫 ปิดการเชื่อมต่อเครือข่ายแล้ว");
    }
}

// ฟังก์ชันกดปุ่ม "เป็นเครื่องแม่"
function setupAsHub() {
    const name = document.getElementById('shop-id-input').value;
    if (!name) return alert("กรุณาใส่ชื่อร้านก่อนครับ");
    startAsHub(name); 
    alert("ตอนนี้เครื่องนี้คือ 'เครื่องแม่' แล้วครับ");
}

// ฟังก์ชันกดปุ่ม "เป็นเครื่องลูก"
function setupAsClient() {
    const name = document.getElementById('shop-id-input').value;
    if (!name) return alert("กรุณาใส่ชื่อร้านแม่เพื่อเชื่อมต่อครับ");
    connectToHub(name); 
}

// 👨‍🍳 ฟังก์ชันแจ้งเตือนเมื่อทำเสร็จ (ส่งกลับไปหาเครื่องอื่น)
function markAsDone(orderId, itemName) {
    if (currentConn && currentConn.open) {
        currentConn.send({
            type: 'ORDER_DONE',
            orderId: orderId,
            itemName: itemName
        });
        console.log("✅ แจ้งเครื่องแม่ว่าอาหารเสร็จแล้ว");
    }
}

// --- การเพิ่มปุ่มเปิดหน้าจอครัว 02-05-2026 ---

// ฟังก์ชันสลับหน้าจอครัว
function showKitchen() {
    const kitchenScreen = document.getElementById('kitchen-screen');
    if (kitchenScreen) {
        kitchenScreen.style.display = 'block';
    }
}

function hideKitchen() {
    const kitchenScreen = document.getElementById('kitchen-screen');
    if (kitchenScreen) {
        kitchenScreen.style.display = 'none';
    }
}

// ฟังก์ชันสร้างตั๋วอาหาร (เมื่อได้รับออเดอร์จาก P2P)
function addKitchenTicket(orderData) {
    const container = document.getElementById('kitchen-ticket-container');
    if (!container) return;

    const ticketHtml = `
        <div class="kitchen-ticket" id="ticket-${orderData.orderId}" style="background: white; width: 250px; border-radius: 10px; padding: 15px; box-shadow: 0 4px 8px rgba(0,0,0,0.2); color: #333; margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #eee; padding-bottom: 5px;">
                <strong style="font-size: 1.2em;">📍 โต๊ะ: ${orderData.table}</strong>
                <span style="color: #7f8c8d; font-size: 0.85em;">${orderData.time}</span>
            </div>
            <div style="margin: 10px 0;">
                ${orderData.items.map(item => `
                    <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #eee;">
                        <span>- ${item.name}</span>
                        <strong>x ${item.quantity || 1}</strong>
                    </div>
                `).join('')}
            </div>
            <button onclick="completeTicket('${orderData.orderId}')" style="width: 100%; background: #27ae60; color: white; border: none; padding: 10px; border-radius: 5px; font-weight: bold; cursor: pointer; margin-top: 5px;">
                ✅ ทำเสร็จแล้ว
            </button>
        </div>
    `;
    
    container.innerHTML += ticketHtml;
}

// ฟังก์ชันเมื่อพ่อครัวทำเสร็จ (ลบตั๋วออกจากหน้าจอ)
function completeTicket(orderId) {
    const ticket = document.getElementById(`ticket-${orderId}`);
    if (ticket) {
        ticket.style.opacity = '0.3';
        setTimeout(() => {
            ticket.remove(); 
        }, 500);
    }
}