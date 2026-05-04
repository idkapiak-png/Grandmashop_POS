// ==========================================
// กล่องที่ 1: หัวใจระบบ (ฐานข้อมูล Dexie) - อัปเกรดเตรียมทำ Dashboard 03-05-2026
// ==========================================
const db = new Dexie("StandaloneDatabase");

// 🚀 อัปเกรดเป็น version(11) เพื่อรองรับระบบ "ประวัติการซื้อย้อนหลัง"
// การขยับเลขเวอร์ชันจะทำให้ Dexie อัปเดตโครงสร้างตารางโดยไม่ลบข้อมูลเก่าครับ
db.version(11).stores({
    // 1: ตารางตั้งค่า (ห้ามลบ)
    settings: 'key', 

    // 2: ตารางคำสั่งซื้อ
    orders: '++id, order_id, menu_name, total_price, discount, created_at, options, payment_method',

    // 3: ระบบโต๊ะ
    active_tables: 'table_id, last_update', 

    // 4: ตารางสรุปรายวัน (ใช้ทำกราฟเส้นหัวใจ)
    dailysummary: 'summary_date, total_sales, egg_count, daily_investment, net_profit',

    // 5-6: เมนูและตัวเลือกเสริม
    menus: '++id, name, price',
    extra_options: '++id, name, price',

    // 7: บันทึกความปลอดภัย
    security_logs: '++id, dateOnly, event',

    // 8: [จุดที่แก้ไข ✨] ตารางรายการซื้อของ (Shopping List)
    // เพิ่ม 'confirmed_date' เพื่อบันทึกวันที่ซื้อจริง และทำให้ค้นหา 'status' ได้เร็วขึ้น
    shopping_list: '++id, name, price, status, date, confirmed_date',

    // 9: [จุดที่แก้ไข ✨] คลังประวัติราคา (Price Insight)
    // เพิ่ม 'last_updated' เพื่อใช้จัดลำดับราคาล่าสุดที่เคยบันทึกไว้
    price_history: 'name, last_price, best_price, last_updated' 
});

// เปิดการเชื่อมต่อฐานข้อมูล
db.open().then(() => {
    console.log("✅ ฐานข้อมูลพร้อมใช้งาน (Version 11: เปิดระบบประวัติการซื้อย้อนหลังให้คุณยาย)");
}).catch(err => {
    console.error("❌ เปิดฐานข้อมูลไม่ได้: " + err.stack);
});

// --- [ตัวแปรสถานะระบบ] ---
let currentOrder = { name: "", price: 0, qty: 1 };
let selectedTable = null;

// สำหรับระบบจดของ
let currentEditId = null; // บันทึกเสร็จแล้ว เคลียร์ค่า ID ทิ้ง
let currentShoppingItem = { name: "", price: 0 };


// ✨ เพิ่มบรรทัดนี้เข้าไปครับ เพื่อแก้ Error: menus is not defined
let menus = [];

// ฟังก์ชันบันทึกรายการ (จดปากกาเขียนลงสมุด)
async function saveShoppingItem() { 
    /* ...โค้ดชุดที่มี nowWithTime และ status: 'pending' ที่พี่แก้แล้ว... */
}

// ฟังก์ชันดูประวัติราคา (เมื่อยายกดแว่นขยาย 🔍)
async function showPriceHistory(itemName) {
    /* ...โค้ดชุดที่มี filter status: 'completed' และแสดง Modal... */
}

// ==========================================
// กล่องที่ 2: ระบบจัดการหน้าตาเว็บและการตั้งค่า
// ==========================================
function showSetting() {
    // 1. ดึงค่าชื่อร้าน และชื่อเมนูหลัก มาใส่ใน Input
    const nameInput = document.getElementById('name-input');
    const nameMain = document.getElementById('name-main');
    if (nameInput && nameMain) nameInput.value = nameMain.innerText;

    const menuInput = document.getElementById('menu-input');
    const menuName = document.getElementById('menu-name');
    if (menuInput && menuName) menuInput.value = menuName.innerText;

    // 2. ดึงค่า "ชื่อการนับ" และ "หน่วย" มาใส่ใน Input
    const counterLabelInput = document.getElementById('counter-label-input');
    const counterUnitInput = document.getElementById('counter-unit-input');
    
    if (counterLabelInput) {
        counterLabelInput.value = localStorage.getItem('counterLabel') || 'ไข่ดาว';
    }
    if (counterUnitInput) {
        counterUnitInput.value = localStorage.getItem('counterUnit') || 'ฟอง';
    }

    // 3. จัดการเรื่อง Browser History
    history.pushState({ page: 'settings' }, 'Settings', '#settings');

    // 4. สลับหน้าจอ
    document.getElementById('front-page').style.display = 'none';
    document.getElementById('back-page').style.display = 'block';

    // 5. โหลดข้อมูลต่างๆ มาโชว์ในหน้าตั้งค่า
    loadDashboardData();
    renderMenuSettings(); // แสดงเฉพาะเมนูขายหน้าแรก
    renderOptionsSettings(); 
}

async function saveAndExit() {
    // --- 1. ดึงค่าพื้นฐานจากหน้าตั้งค่า (30-04-2026) ---
    const shopName = document.getElementById('name-input').value;
    const shopMenu = document.getElementById('menu-input').value;
    const counterLabel = document.getElementById('counter-label-input').value;
    const counterUnit = document.getElementById('counter-unit-input').value;
    
    // 🔥 แก้ไขจุดที่ 1: ดึงค่าทั้งจากช่องตัวเลข และ Dropdown
    const discountInput = document.getElementById('set_discount');
    const discountType = document.getElementById('discount_type'); // ดึงตัวเลือก บาท/% มาด้วย
    
    const rawNum = discountInput ? discountInput.value.trim() : "0";
    const selectedType = discountType ? discountType.value : "amount"; 

    // --- 2. บันทึกรายการเมนูขายหน้าแรก (เหมือนเดิมที่คุณยายเขียน) ---
    const menuList = [];
    const container = document.getElementById('menu-settings-list');
    if (container) {
        const rows = container.querySelectorAll('.menu-setting-row'); 
        rows.forEach(row => {
            const inputs = row.querySelectorAll('input');
            if (inputs.length >= 2) {
                const name = inputs[0].value;
                const price = parseFloat(inputs[1].value);
                if (name.trim() !== "") {
                    menuList.push({ name, price });
                }
            }
        });
        localStorage.setItem('quickMenus', JSON.stringify(menuList));
    }

    // --- 3. บันทึกชื่อร้านและหัวข้อเมนู (เหมือนเดิม) ---
    if(shopName.trim() !== "") {
        if(document.getElementById('name-main')) document.getElementById('name-main').innerText = shopName;
        localStorage.setItem('shopName', shopName);
    }
    if(shopMenu.trim() !== "") {
        if(document.getElementById('menu-name')) document.getElementById('menu-name').innerText = shopMenu;
        localStorage.setItem('shopMenu', shopMenu);
    }

    // --- 4. บันทึกค่าการนับ (เหมือนเดิม) ---
    if(counterLabel.trim() !== "") {
        localStorage.setItem('counterLabel', counterLabel);
        if(document.getElementById('display-label')) 
            document.getElementById('display-label').innerText = "📊 วันนี้ใช้ " + counterLabel + " ไปแล้ว";
    }
    if(counterUnit.trim() !== "") {
        localStorage.setItem('counterUnit', counterUnit);
    }

    // --- 5. 🔥 ส่วนที่แก้ไขใหม่: รวมร่างตัวเลขกับเครื่องหมาย % ---
    let finalDiscountValue = "0";
    let numValue = parseFloat(rawNum) || 0;

    if (numValue > 0) {
        // ถ้าเลือกโหมดเปอร์เซ็นต์ ให้เติม % ต่อท้ายก่อนบันทึก
        if (selectedType === 'percent') {
            finalDiscountValue = numValue.toString() + "%";
        } else {
            finalDiscountValue = numValue.toString();
        }
    }
    
    // บันทึกลงระบบ (ทั้งคู่เพื่อความชัวร์)
    localStorage.setItem('default_discount', finalDiscountValue);
    if (typeof db !== 'undefined') {
        await db.settings.put({ key: 'default_discount', value: finalDiscountValue });
    }
    
    console.log(`🎯 บันทึกสำเร็จ: ${finalDiscountValue} (${finalDiscountValue.includes('%') ? 'โหมดเปอร์เซ็นต์' : 'โหมดบาท'})`);

    // --- 6. ปิดหน้าตั้งค่า ---
    if (window.location.hash === '#settings') {
        history.back(); 
    }
    document.getElementById('front-page').style.display = 'block';
    document.getElementById('back-page').style.display = 'none';
    
    // --- 7. อัปเดตหน้าจอขาย ---
    if (typeof renderOrderButtons === "function") renderOrderButtons();  
    if (typeof renderExtraOptions === "function") renderExtraOptions();  
    
    if (typeof updateOrderPreview === "function") {
        updateOrderPreview();
    }
}

function loadDailyCost() {
    const savedCost = localStorage.getItem('myDailyCost');
    if (savedCost) document.getElementById('daily-cost').value = savedCost;
}

//ทุนวันนี้ 03-05-2026
async function saveCostAndRefresh() {
    // 1. ดึงค่าจากช่อง "ทุนวันนี้" ใน HTML
    const newCost = parseFloat(document.getElementById('daily-cost').value) || 0;
    
    // 2. เก็บใน localStorage ไว้เหมือนเดิม (เพื่อให้ UI ส่วนอื่นที่ดึงค่านี้ไปใช้ยังทำงานได้)
    localStorage.setItem('myDailyCost', newCost);

    // 3. เตรียมข้อมูลวันที่ (ใช้ Key เดียวกับ dailysummary)
    const today = new Date().toISOString().split('T')[0];

    try {
        // 4. ดึงข้อมูลยอดขายของวันนี้ที่มีอยู่ในฐานข้อมูลมาก่อน (ถ้ามี)
        const existingData = await db.dailysummary.get(today);
        const currentSales = existingData ? existingData.total_sales : 0;
        const currentEggs = existingData ? existingData.egg_count : 0;

        // 5. บันทึก (put) ลง Dexie DB Version 10
        await db.dailysummary.put({
            summary_date: today,
            total_sales: currentSales,
            egg_count: currentEggs,
            daily_investment: newCost, // ✨ บันทึกทุนวันนี้ลงไปแล้ว!
            net_profit: currentSales - newCost // ✨ คำนวณกำไรสุทธิเก็บไว้เลย
        });

        console.log(`✅ หลานรักจดบันทึกให้ยายแล้ว: ทุน ${newCost} บาท, กำไรวันนี้ ${currentSales - newCost} บาท`);

    } catch (error) {
        console.error("❌ จดบันทึกลงฐานข้อมูลไม่ได้:", error);
    }

    // 6. เรียกฟังก์ชันเดิมของคุณเพื่ออัปเดตการแสดงผลบนหน้าจอ
    fetchTodaySales();
}

// ==========================================
// กล่องที่ 3: ระบบ Dynamic Menu & Options (แยกส่วนหน้าขายและคลัง)
// ==========================================

// วาดปุ่มกดสั่งอาหาร (หน้าแรก) - ดึงจาก localStorage เท่านั้น
async function renderOrderButtons() {
    const menuContainer = document.getElementById('Order-menu');
    if (!menuContainer) return;

    const savedQuickMenus = JSON.parse(localStorage.getItem('quickMenus')) || [];

    menuContainer.innerHTML = savedQuickMenus.length ? '' : 
        '<p style="grid-column: span 2; text-align: center; color: #888; padding: 20px;">ยังไม่มีเมนูด่วน... ตั้งค่าที่ "บันทึกรายการเมนูขาย" ⚙️</p>';

    savedQuickMenus.forEach(menu => {
        const btn = document.createElement('button');
        btn.innerHTML = `${menu.name}<br><small>${menu.price}.-</small>`;
        btn.onclick = () => {
            orderMenu(menu.name, menu.price);
            document.querySelectorAll('#Order-menu button').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        };
        menuContainer.appendChild(btn);
    });
}

// วาดรายการ "บันทึกรายการเมนูขาย" ในหน้าตั้งค่า - ดึงจาก localStorage  25-04-2026
function renderMenuSettings() {
    const container = document.getElementById('menu-settings-list');
    if (!container) return;
    const quickMenus = JSON.parse(localStorage.getItem('quickMenus')) || [];
    container.innerHTML = '';
    
    quickMenus.forEach((menu, index) => {
        const div = document.createElement('div');
        div.className = 'menu-setting-row';
        // ใช้การตั้งค่าแบบเดิมของนาย เพื่อให้ CSS ในไฟล์ Standalone.css ยังทำงานได้ปกติ
        div.style.display = "flex"; 
        div.style.gap = "5px"; 
        div.style.marginBottom = "8px";
        
        div.innerHTML = `
            <input type="text" value="${menu.name}" disabled style="flex: 2; padding: 8px; background: #f0f0f0;">
            <input type="number" value="${menu.price}" disabled style="width: 70px; padding: 8px; background: #f0f0f0;">
            <button type="button" onclick="toggleEditRow(this)" style="background: #3498db; color: white; border: none; padding: 5px 10px; border-radius: 5px;">📝</button>
            <button type="button" onclick="this.parentElement.remove()" style="background: #ff4757; color: white; border: none; padding: 5px 10px; border-radius: 5px;">🗑️</button>
        `;
        container.appendChild(div);
    });
}

// ฟังก์ชันสำหรับสลับโหมด แก้ไข/ล็อก (Toggle Edit) 25-04-2026
function toggleEditRow(btn) {
    const row = btn.parentElement;
    const inputs = row.querySelectorAll('input');
    const isCurrentlyDisabled = inputs[0].disabled;

    inputs.forEach(input => {
        input.disabled = !isCurrentlyDisabled;
        // เปลี่ยนสีพื้นหลังเล็กน้อยเพื่อให้รู้ว่าช่องไหนแก้ได้/ไม่ได้
        input.style.background = isCurrentlyDisabled ? "#ffffff" : "#f0f0f0";
        if (isCurrentlyDisabled) input.style.border = "1px solid #00acc1";
        else input.style.border = "1px solid #ddd";
    });

    // เปลี่ยนไอคอนปุ่ม
    btn.innerText = isCurrentlyDisabled ? "✅" : "📝";
    btn.style.background = isCurrentlyDisabled ? "#2ecc71" : "#3498db";
}

// ปรับส่วนเพิ่มแถวใหม่ ให้พร้อมพิมพ์ได้ทันที (ไม่ต้องกดแก้) 25-04-2026
function addMenuField() {
    const container = document.getElementById('menu-settings-list');
    const div = document.createElement('div');
    div.className = 'menu-setting-row';
    div.style.display = "flex"; 
    div.style.gap = "5px"; 
    div.style.marginBottom = "8px";
    
    div.innerHTML = `
        <input type="text" placeholder="ชื่อเมนู" style="flex: 2; padding: 8px; border: 1px solid #00acc1;">
        <input type="number" placeholder="ราคา" style="width: 70px; padding: 8px; border: 1px solid #00acc1;">
        <button type="button" onclick="this.parentElement.remove()" style="background: #ff4757; color: white; border: none; padding: 5px 10px; border-radius: 5px;">🗑️</button>
    `;
    container.appendChild(div);
}

// วาดส่วนเพิ่มเติม (Options) 25-04-2026
async function renderExtraOptions() {
    const container = document.getElementById('dynamic-options-list');
    if (!container) return;
    const allOptions = await db.extra_options.toArray();
    container.innerHTML = '';

    allOptions.forEach(opt => {
        const label = document.createElement('label');
        label.style.display = "block";
        label.style.marginBottom = "5px";
        label.innerHTML = `
            <input type="checkbox" class="extra-opt-check"
            data-name="${opt.name}" 
            data-price="${opt.price}"
            onchange="syncOptions()">  <span>+ ${opt.name} (${opt.price}.-)</span>
        `;
        container.appendChild(label);
    });
}
// 04-05-2026 
function syncOptions() {
    // 1. ถ้าในตะกร้ายังไม่มีของเลย ก็ไม่ต้องทำอะไร
    if (cart.length === 0) return;

    // 2. ดึงค่า Options ที่ถูกติ๊กอยู่ในปัจจุบันทั้งหมด
    let extraPrice = 0;
    let extraNames = [];
    document.querySelectorAll('.extra-opt-check:checked').forEach(checkbox => {
        extraPrice += parseFloat(checkbox.getAttribute('data-price')) || 0;
        extraNames.push(checkbox.getAttribute('data-name'));
    });

    // 3. เข้าไปแก้ไข "รายการล่าสุด" ในตะกร้า
    let lastItem = cart[cart.length - 1];
    
    // --- 🚩 จุดที่แก้ไข: ตรวจสอบและบันทึกราคาพื้นฐาน (Base Price) ---
    // ถ้าตัวแปร basePrice ยังไม่มีค่า ให้เอาค่า price ปัจจุบันนั่นแหละบันทึกเก็บไว้ก่อน
    if (lastItem.basePrice === undefined || lastItem.basePrice === null) {
        lastItem.basePrice = parseFloat(lastItem.price) || 0;
    }

    // อัปเดตราคาที่ถูกต้อง (ราคาพื้นฐานที่จำไว้ + ราคาตัวเลือกเสริมที่เพิ่งติ๊ก)
    lastItem.price = lastItem.basePrice + extraPrice;
    
    // อัปเดตชื่อตัวเลือกเสริม
    lastItem.options = extraNames.join(', ');

    // 4. สั่งวาดหน้าจอใหม่
    if (typeof updateOrderPreview === "function") {
        updateOrderPreview();
    }
}

async function renderOptionsSettings() {
    const container = document.getElementById('options-settings-list');
    if (!container) return;
    const allOptions = await db.extra_options.toArray();
    container.innerHTML = '';
    allOptions.forEach(opt => {
        const div = document.createElement('div');
        div.style.display = "flex"; div.style.gap = "5px"; div.style.marginBottom = "8px";
        div.innerHTML = `<input type="text" value="${opt.name}" onchange="updateExtra(${opt.id}, 'name', this.value)" style="flex: 2; padding: 5px;">
                         <input type="number" value="${opt.price}" onchange="updateExtra(${opt.id}, 'price', this.value)" style="width: 70px; padding: 5px;">
                         <button onclick="deleteExtra(${opt.id})" style="background: #ff4757; color: white; border: none; padding: 5px 10px; border-radius: 5px;">🗑️</button>`;
        container.appendChild(div);
    });
}

async function addOptionField() { await db.extra_options.add({ name: "ตัวเลือกใหม่", price: 10 }); renderOptionsSettings(); renderExtraOptions(); }
async function deleteExtra(id) { if (confirm("ลบตัวเลือกนี้ไหม?")) { await db.extra_options.delete(id); renderOptionsSettings(); renderExtraOptions(); } }
async function updateExtra(id, field, value) {
    let updateData = {}; updateData[field] = field === 'price' ? Number(value) : value;
    await db.extra_options.update(id, updateData); renderExtraOptions();
}

// ==========================================
// กล่องที่ 4: ระบบการขาย (Order & Preview)
// ==========================================

let cart = []; // ใช้เก็บรายการอาหารทั้งหมดที่เลือก

function orderMenu(name, price) {
    // 1. เพิ่มวัตถุใหม่ลงใน Array cart ทันที (เริ่มจากราคาปกติก่อน)
    cart.push({
        name: name,
        basePrice: price,     // เก็บราคาต้นฉบับไว้ (สำคัญมาก!)
        price: price,         // ราคาที่จะโชว์ (ตอนแรกยังไม่มี Option)
        qty: 1,
        options: ''           // ตอนเริ่มกด เมนูยังว่างอยู่
    });

    // 2. ล้างติ๊กถูกออก เพื่อให้พร้อมสำหรับเมนูถัดไป (นายมีอยู่แล้ว เยี่ยมมาก!)
    document.querySelectorAll('.extra-opt-check').forEach(c => c.checked = false);

    // 3. อัปเดตการแสดงผล
    updateOrderPreview();
}

function addItemToOrder(name, price) {
    currentOrder.name = name;
    currentOrder.price = price;
    currentOrder.qty = 1;
    document.querySelectorAll('#Order-menu button').forEach(b => b.classList.remove('selected'));
    updateOrderPreview();
}

// 25-04-2026
function changeQty(amount) {
    // 1. เช็กก่อนว่าในตะกร้า (cart) มีของหรือยัง
    if (cart.length === 0) return;

    // 2. หาตำแหน่งของ "จานล่าสุด" (คือลำดับสุดท้ายในตะกร้า)
    let lastIndex = cart.length - 1;

    // 3. ปรับจำนวน qty ของจานนั้น
    cart[lastIndex].qty += amount;

    // 4. กันบั๊ก: ถ้าลดจนน้อยกว่า 1 ให้ค้างไว้ที่ 1 จาน
    if (cart[lastIndex].qty < 1) {
        cart[lastIndex].qty = 1;
    }

    // 5. สั่งวาดหน้าจอใหม่เพื่อให้ตัวเลขจำนวนและราคารวมอัปเดต
    updateOrderPreview();
}

function getSelectedOptions() {
    const checks = document.querySelectorAll('.extra-opt-check:checked');
    let extraPrice = 0;
    let extraNames = [];
    checks.forEach(chk => {
        extraPrice += Number(chk.getAttribute('data-price'));
        extraNames.push(chk.getAttribute('data-name'));
    });
    return { extraPrice, extraNames };
}

// ฟังก์ชันแสดงผล (มีปุ่มลบรายบรรทัด) 1-05-2026
function updateOrderPreview() {
    const detailBox = document.getElementById('order-detail');
    const totalBox = document.getElementById('order-total-price');
    const qtyBox = document.getElementById('order-qty'); 
    
    const btnToTable = document.getElementById('btn-to-table');    
    const btnPayNow = document.getElementById('btn-pay-now');      
    const btnCash = document.getElementById('btn-pay-cash');       
    const btnTransfer = document.getElementById('btn-pay-transfer'); 

    if(btnPayNow) btnPayNow.style.display = 'none'; 

    // --- ส่วนที่ 1: วิเคราะห์ส่วนลด ---
    const rawDiscount = localStorage.getItem('default_discount') || "0";
    const isPercent = rawDiscount.toString().includes('%'); 
    const discountConfigValue = parseFloat(rawDiscount) || 0; 

    // --- ส่วนที่ 2: กรณีตะกร้าว่างเปล่า ---
    if (cart.length === 0) {
        if(detailBox) detailBox.innerHTML = "<div style='text-align:center; color:#999; padding:20px;'>ยังไม่ได้เลือกเมนู</div>";
        if(totalBox) totalBox.innerHTML = "รวมทั้งสิ้น : 0.-";
        if(qtyBox) qtyBox.innerText = "1"; 
        
        [btnCash, btnTransfer].forEach(btn => {
            if(btn) {
                btn.style.display = 'block'; 
                btn.style.opacity = '0.3'; 
                btn.style.pointerEvents = 'none'; 
            }
        });

        if(btnToTable) btnToTable.style.display = 'none'; 
        return; 
    }

    // --- ส่วนที่ 3: คำนวณรายการอาหาร ---
    let grandTotal = 0;
    let detailHTML = cart.map((item, index) => {
        const itemTotal = item.price * item.qty;
        grandTotal += itemTotal;
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px dashed #eee; padding-bottom: 8px;">
                <div style="flex: 1;">
                    <div style="font-weight: bold; font-size: 1rem;">${item.name}</div>
                    ${item.options ? `<small style="color:#7f8c8d;">${item.options}</small>` : ''}
                </div>
                <div style="text-align: right; min-width: 80px;">
                    <span style="font-size: 0.9rem; color:#666;">x ${item.qty}</span><br>
                    <span style="font-weight: bold;">${itemTotal.toLocaleString()}.-</span>
                </div>
                <button onclick="deleteSpecificItem(${index})" style="background: #ff4757; color: white; border: none; border-radius: 50%; width: 32px; height: 32px; margin-left: 12px; cursor: pointer; font-size: 1.2rem;">×</button>
            </div>
        `;
    }).join('');

    // คำนวณส่วนลดจริง
    let actualDiscountAmount = 0;
    if (isPercent) {
        actualDiscountAmount = (grandTotal * discountConfigValue) / 100;
    } else {
        actualDiscountAmount = discountConfigValue;
    }

    // 🚩 วางโค้ดตรวจสอบ (Debug) ตรงนี้ครับ
    console.log("--- 🕵️ ตรวจสอบการคำนวณ ---");
    console.log("1. ราคาเต็มจากตะกร้า (ก่อนลด):", grandTotal);
    console.log("2. ยอดส่วนลดที่ดึงมาใช้:", actualDiscountAmount);
    console.log("3. ยอดสุทธิ (ข้อ 1 ลบ ข้อ 2):", grandTotal - actualDiscountAmount);
    console.log("-----------------------");

    const netTotal = Math.max(0, grandTotal - actualDiscountAmount);
    
    // --- ส่วนที่ 4: แสดงผลส่วนลด (Visual Feedback) ---
    if(detailBox) {
        if (actualDiscountAmount > 0) {
            const label = isPercent ? `ส่วนลดพิเศษ (${discountConfigValue}%)` : `ส่วนลดพื้นฐาน`;
            detailHTML += `
                <div style="display: flex; justify-content: space-between; color: #d35400; padding: 12px 0; font-weight: bold; border-top: 2px solid #f9f9f9; background: #fff5e6; margin-top: 10px; border-radius: 8px; padding: 8px;">
                    <span>${label}:</span>
                    <span>-${actualDiscountAmount.toLocaleString()}.-</span>
                </div>
            `;
        }
        detailBox.innerHTML = detailHTML;
    }

    // --- 🔥 [จุดที่ปรับแต่งใหม่] แสดงยอดรวมสุทธิแบบฉลาด ---
    if(totalBox) {
        // สร้างตัวแปรเก็บ HTML ของขีดฆ่า (ถ้าไม่มีส่วนลด จะได้ค่าว่าง)
        const strikeThroughHTML = (actualDiscountAmount > 0) 
            ? `<small style="font-size: 0.85rem; color: #95a5a6; text-decoration: line-through;">ยอดรวม: ${grandTotal.toLocaleString()}.-</small><br>` 
            : '';

        totalBox.innerHTML = `
            <div style="line-height: 1.2;">
                ${strikeThroughHTML}
                <span style="font-size: 0.9rem; color: #2c3e50;">สุทธิ:</span> 
                <span style="color: #27ae60; font-size: 1.6rem; font-weight: 800;">${netTotal.toLocaleString()}.-</span>
            </div>
        `;
    }

    // --- ส่วนที่ 5: ปลดล็อกปุ่มและฟีเจอร์อื่นๆ ---
    if(qtyBox && cart.length > 0) qtyBox.innerText = cart[cart.length - 1].qty;

    [btnCash, btnTransfer].forEach(btn => {
        if(btn) {
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
        }
    });

    if (typeof selectedTable !== 'undefined' && selectedTable !== null) {
        if(btnToTable) btnToTable.style.display = 'block'; 
    } else {
        if(btnToTable) btnToTable.style.display = 'none';
    }
}
// ฟังก์ชันลบเฉพาะบางรายการ 25-04-2026
function deleteSpecificItem(index) {
    cart.splice(index, 1); // ลบข้อมูลใน Array ตามตำแหน่งที่กด
    updateOrderPreview();  // วาดหน้าจอใหม่
}

// ฟังก์ชันยืนยัน (บันทึกลงฐานข้อมูล) 30-04-2026
async function confirmOrder(paymentType) {
    // ป้องกันการกดซ้ำหรือตะกร้าว่าง
    if (cart.length === 0) return alert("เลือกเมนูก่อนครับคุณยาย!");
    
    const thailandTime = new Date().toLocaleString('sv-SE'); 
    const orderId = Date.now(); 

    // --- 1. วิเคราะห์ส่วนลด (รองรับ % และ บาท) ---
    const rawDiscount = localStorage.getItem('default_discount') || "0";
    const isPercent = rawDiscount.toString().includes('%'); 
    const discountConfigValue = parseFloat(rawDiscount) || 0; 
    
    // คำนวณยอดรวมดิบ (ก่อนลด)
    const rawTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    // 🔥 [คำนวณส่วนลด] แปลงจาก % ให้กลายเป็น "บาท" เพื่อลงบัญชี
    let actualDiscountBath = isPercent 
        ? (rawTotal * discountConfigValue) / 100 
        : discountConfigValue;

    const netTotal = Math.max(0, rawTotal - actualDiscountBath); 

    // จัดระเบียบประเภทการชำระเงิน
    const finalPaymentMethod = (paymentType === 'transfer' || paymentType === 'QR') ? 'QR' : 'Cash';

    // ข้อมูลสำหรับแสดงผลบนใบเสร็จ (Receipt)
    const receiptData = {
        order_id: orderId,
        items: [...cart], 
        total_price: rawTotal,
        discount: actualDiscountBath, // ส่งเป็นยอดบาทเสมอเพื่อให้ Receipt คำนวณง่าย
        net_total: netTotal,
        payment_method: finalPaymentMethod, 
        created_at: thailandTime
    };

    try {
        // --- 2. บันทึกลงฐานข้อมูล Dexie ---
        
        // 2.1 บันทึกรายการอาหารทีละรายการ 04-05-2026
        for (let i = 0; i < cart.length; i++) {

            // 🚩 บรรทัดที่ให้เพิ่มเพื่อเช็คครับ
            console.log(`รายการที่ ${i+1}:`, cart[i].name, "ราคาในตะกร้าคือ:", cart[i].price);

        // 🚩 มั่นใจว่าราคาที่บันทึก คือราคาที่รวม options แล้วจริงๆ
        // ถ้าโครงสร้างข้อมูลพี่มี basePrice ให้ใช้ basePrice + extra (ถ้ามี)
        // แต่ถ้าพี่แก้ syncOptions ให้ update ค่า price แล้ว itemTotal จะถูกต้องเองครับ
        let itemTotal = cart[i].price * cart[i].qty; 

        await db.orders.add({
            order_id: orderId,
            menu_name: cart[i].name,
            qty: cart[i].qty,
            options: cart[i].options || "", 
            total_price: itemTotal, // <--- ตัวนี้ต้องเป็น 60 ไม่ใช่ 50
            discount: 0,            
            payment_method: finalPaymentMethod,
            created_at: thailandTime
        });
    }

        // 2.2 🔥 [จุดยุทธศาสตร์] บันทึกแถวส่วนลดแยกต่างหาก 04-05-2026
       // 2.2 🔥 บันทึกแถวส่วนลด
        // เปลี่ยนจาก actualDiscountAmount เป็น actualDiscountBath ให้ตรงกันครับ
        if (actualDiscountBath > 0) { 
            await db.orders.add({
                order_id: orderId,
                menu_name: `🔻 ส่วนลด (${isPercent ? discountConfigValue + '%' : 'บาท'})`, 
                qty: 1,
                options: "โปรโมชั่น/ส่วนลดพื้นฐาน",
                total_price: -actualDiscountBath, // ต้องใช้ชื่อนี้เท่านั้น
                discount: actualDiscountBath,     // ต้องใช้ชื่อนี้เท่านั้น
                payment_method: finalPaymentMethod,
                created_at: thailandTime
            });
        }

        // --- 3. จัดการสถานะโต๊ะ (ถ้ามี) ---
        if (typeof selectedTable !== 'undefined' && selectedTable !== null) {
            await db.active_tables.delete(selectedTable);
            selectedTable = null; 

            // ปรับการแสดงผลหน้าจอให้กลับเป็น Walk-in
            const display = document.getElementById('current-table-display');
            if (display) {
                display.innerText = "📍 กำลังขาย: หน้าร้าน (Walk-in)";
                display.style.background = "#34495e";
            }
            const pendingBox = document.getElementById('pending-billing-box');
            if (pendingBox) pendingBox.style.display = 'none';
        }

        // --- 4. แสดงใบเสร็จและล้างข้อมูล ---
        if (typeof showSmartReceipt === "function") {
            showSmartReceipt(receiptData); 
        }

        // เคลียร์ตะกร้าและอัปเดตหน้าจอ
        cart = []; 
        if (typeof renderTableSelection === "function") await renderTableSelection(); 
        updateOrderPreview(); 
        
        // อัปเดตยอดขายวันนี้ทันที
        if (typeof fetchTodaySales === "function") fetchTodaySales();
        if (typeof loadRecentOrders === "function") loadRecentOrders();

    } catch (err) {
        console.error("❌ บันทึกล้มเหลว:", err);
        alert("อุ๊ย! มีปัญหาตอนบันทึกข้อมูลครับคุณยาย ลองดูอีกทีนะครับ");
    }
}

//03-05-2026
async function fetchTodaySales() {
    try {
        const todayStr = new Date().toLocaleDateString('sv-SE');
        const allOrders = await db.orders.toArray();
        let total = 0, cashTotal = 0, qrTotal = 0, countItems = 0;
        const targetSearch = localStorage.getItem('counterLabel') || "ไข่"; 

        allOrders.forEach(o => {
            if (o.created_at && o.created_at.startsWith(todayStr)) {
                // 1. ดึงค่า total_price มาบวก/ลบ ได้เลย (อาหารเป็น + ส่วนลดเป็น -)
                const amount = Number(o.total_price || 0);
                total += amount; 
                
                if (o.payment_method === 'Cash') {
                    cashTotal += amount;
                } else if (o.payment_method === 'QR') {
                    qrTotal += amount;
                }

                // 2. การนับจำนวนสิ่งที่อยากนับ (เช่น ไข่ดาว)
                if (o.options && o.options.includes(targetSearch)) {
                    countItems += Number(o.qty || 0);
                }
            }
        });

        // 3. ป้องกันยอดรวมติดลบ
        const finalTotal = Math.max(0, total);
        const finalCash = Math.max(0, cashTotal);
        const finalQR = Math.max(0, qrTotal);

        // อัปเดตตัวเลขยอดขายขึ้นหน้าจอ
        document.getElementById('total-sales-display').innerText = finalTotal.toLocaleString();
        document.getElementById('cash-display').innerText = finalCash.toLocaleString();
        document.getElementById('qr-display').innerText = finalQR.toLocaleString();
        
        // ตรวจสอบว่ามี id="egg-count" ใน HTML หรือไม่ก่อนอัปเดต
        const eggElem = document.getElementById('egg-count');
        if(eggElem) eggElem.innerText = countItems.toLocaleString();
        
        // --- ✨ [ส่วนที่เพิ่มใหม่: คำนวณกำไรจากฐานข้อมูล] ---
        
        // 4. ดึงข้อมูลสรุปรายวันจาก Dexie (Version 10)
        const summary = await db.dailysummary.get(todayStr);
        const dailyCost = summary ? (summary.daily_investment || 0) : (parseFloat(localStorage.getItem('myDailyCost')) || 0);
        
        // อัปเดตช่อง input "ทุนวันนี้" ให้ตรงกับใน DB
        const costInput = document.getElementById('daily-cost');
        if (costInput) costInput.value = dailyCost;

        // 5. คำนวณกำไรสุทธิ
        const netProfit = finalTotal - dailyCost;
        updateProfitStatusDisplay(netProfit); // เรียกฟังก์ชันแสดงผลกำไร

        // 6. [แถม] อัปเดตยอดขายกลับลง DB ให้เป็นปัจจุบันเสมอ
        await db.dailysummary.put({
            summary_date: todayStr,
            total_sales: finalTotal,
            egg_count: countItems,
            daily_investment: dailyCost,
            net_profit: netProfit
        });

    } catch (err) { 
        console.error("เกิดข้อผิดพลาดในการดึงยอดขายรายวัน:", err); 
    }
}

// ✨ ฟังก์ชันใหม่สำหรับเปลี่ยน "⚠️ รอคำนวณ" เป็น "กำไรสีเขียวๆ"
function updateProfitStatusDisplay(profit) {
    const statusDiv = document.getElementById('profit-status');
    if (!statusDiv) return;

    if (profit > 0) {
        statusDiv.innerHTML = `
            <div style="background: #e8f5e9; color: #2e7d32; padding: 10px 20px; border-radius: 20px; font-weight: bold; display: inline-flex; align-items: center; gap: 8px;">
                🎉 กำไรวันนี้: ${profit.toLocaleString()} บาท
            </div>`;
    } else if (profit < 0) {
        statusDiv.innerHTML = `
            <div style="background: #fff5f5; color: #e74c3c; padding: 10px 20px; border-radius: 20px; font-weight: bold; display: inline-flex; align-items: center; gap: 8px;">
                📉 ยังไม่คืนทุน: อีก ${Math.abs(profit).toLocaleString()} บาท
            </div>`;
    } else {
        statusDiv.innerHTML = `
            <div style="background: #f8f9fa; color: #555; padding: 10px 20px; border-radius: 20px; font-weight: bold; display: inline-flex; align-items: center; gap: 8px;">
                ⚖️ เท่าทุนพอดี
            </div>`;
    }
}

function resetOrder() {
    currentOrder = { name: "", price: 0, qty: 1 };
    document.getElementById('order-detail').innerText = "ยังไม่ได้เลือกเมนู";
    document.getElementById('order-total-price').innerText = "รวม: 0.-";
    document.getElementById('order-qty').innerText = "1";
    document.querySelectorAll('.extra-opt-check').forEach(c => c.checked = false);
    document.querySelectorAll('#Order-menu button').forEach(b => b.classList.remove('selected'));
}

//จัดการโต๊ะ 29-04-2026
// 1. ฟังก์ชันบันทึกจำนวนโต๊ะลงเครื่อง (ทำที่หลังบ้าน)
// จัดการตั้งค่าจำนวนโต๊ะ (อัปเดต 29-04-2026)
async function saveTableSettings() {
    const countInput = document.getElementById('table-count-input');
    if (!countInput) return; // ป้องกัน Error ถ้าหา Input ไม่เจอ

    const count = parseInt(countInput.value);
    
    // ตรวจสอบความถูกต้องของข้อมูล (Validation)
    if (isNaN(count) || count <= 0) {
        alert("⚠️ กรุณาระบุจำนวนโต๊ะเป็นตัวเลขที่มากกว่า 0 ครับ");
        return;
    }

    if (count > 50) { // ข้อแนะนำ: ป้องกันยายกรอกเลขเยอะเกินจนปุ่มเต็มหน้าจอ
        if (!confirm("จำนวนโต๊ะค่อนข้างเยอะ อาจทำให้หน้าจอแสดงผลแน่นเกินไป ยืนยันที่จะบันทึกไหมครับ?")) {
            return;
        }
    }

    try {
        // 1. 🔥 บันทึกลง Dexie (ตาราง settings) 
        // ใช้ .put เพื่อ Update ค่าเดิมที่มี key เป็น 'totalTables'
        await db.settings.put({ key: 'totalTables', value: count });

        // 2. บันทึกลง localStorage (แผนสำรอง)
        localStorage.setItem('totalTables', count);

        // 3. วาดปุ่มโต๊ะใหม่ที่หน้าหลักทันที
        // สั่งให้ปุ่มถูกสร้างใหม่ตามจำนวนที่เพิ่งบันทึกไป
        if (typeof renderTableSelection === "function") {
            await renderTableSelection(); 
        }
        
        // 4. แสดงการแจ้งเตือนที่ชัดเจน
        alert(`✅ บันทึกจำนวนโต๊ะเป็น ${count} โต๊ะเรียบร้อยครับ! \n(ยายสามารถเลือกโต๊ะที่หน้าหลักได้เลย)`);

    } catch (err) {
        console.error("❌ บันทึกจำนวนโต๊ะล้มเหลว:", err);
        // กรณีบันทึกลง DB พลาด อย่างน้อย localStorage ก็ยังทำงานได้
        localStorage.setItem('totalTables', count); 
        alert("⚠️ บันทึกข้อมูลลงฐานข้อมูลหลักไม่สำเร็จ แต่ระบบจำค่าไว้ชั่วคราวให้แล้วครับ");
    }
}

// 2. ฟังก์ชันวาดปุ่มเลือกโต๊ะที่หน้าแรก (หน้าขาย) 29-04-2026
async function renderTableSelection() {
    const container = document.getElementById('table-selection-area'); 
    if (!container) return;

    // --- 1. [ส่วนดึงข้อมูล] ระบบเช็ก 3 ชั้น กันข้อมูลหาย ---
    let total = 0;
    try {
        const tableSetting = await db.settings.get('totalTables');
        if (tableSetting && tableSetting.value) {
            total = parseInt(tableSetting.value);
        } else {
            total = parseInt(localStorage.getItem('totalTables')) || 0;
            if (total > 0) {
                await db.settings.put({ key: 'totalTables', value: total });
                console.log("🛠️ ย้ายข้อมูลจำนวนโต๊ะลง Dexie แล้ว");
            }
        }
    } catch (err) {
        console.error("❌ เข้าถึงฐานข้อมูลไม่ได้:", err);
        total = parseInt(localStorage.getItem('totalTables')) || 0;
    }

    container.innerHTML = ''; // ล้างปุ่มเก่า

    // --- 2. กรณีไม่มีการตั้งค่า ---


    // --- 3. ดึงสถานะบิลค้าง (Active) จาก DB ---
    let activeTableIds = [];
    try {
        const activeTables = await db.active_tables.toArray();
        activeTableIds = activeTables.map(t => t.table_id);
    } catch (err) {
        console.error("❌ ดึงสถานะโต๊ะไม่ได้:", err);
    }

    // --- 4. วนลูปวาดปุ่ม (เพิ่มการเช็ก selectedTable เพื่อแก้บั๊กสีส้มค้าง) ---
    for (let i = 1; i <= total; i++) {
        const btn = document.createElement('button');
        const hasBill = activeTableIds.includes(i); // มีบิลค้างใน DB
        const isSelected = (selectedTable === i);    // เป็นโต๊ะที่ยายกำลังกดดูอยู่

        btn.innerText = "โต๊ะ " + i;
        
        // กำหนดสีตามสถานะ: 
        // 1. ถ้าเลือกอยู่ = สีเขียว (เน้นว่ากำลังคุมโต๊ะนี้)
        // 2. ถ้ามีบิลค้างแต่ไม่ได้เลือก = สีส้ม (เตือนว่ามีเงินค้าง)
        // 3. ถ้าว่าง = สีเทา
        let bgColor = '#ecf0f1';
        let textColor = '#2c3e50';
        let borderColor = '#bdc3c7';
        let shadowColor = '#bdc3c7';

        if (isSelected) {
            bgColor = '#2ecc71'; // สีเขียว: กำลังจัดการโต๊ะนี้
            textColor = 'white';
            borderColor = '#27ae60';
            shadowColor = '#27ae60';
        } else if (hasBill) {
            bgColor = '#e67e22'; // สีส้ม: มีบิลค้าง
            textColor = 'white';
            borderColor = '#d35400';
            shadowColor = '#a04000';
        }

        btn.style.cssText = `
            padding: 20px 10px; 
            margin: 5px; 
            border-radius: 15px; 
            border: 2px solid ${borderColor}; 
            font-size: 1.2rem;
            font-weight: bold;
            background: ${bgColor}; 
            color: ${textColor};
            cursor: pointer;
            box-shadow: 0 5px 0 ${shadowColor};
            transition: all 0.1s;
            position: relative;
        `;

        // เอฟเฟกต์การกด
        btn.onmousedown = () => {
            btn.style.transform = "translateY(3px)";
            btn.style.boxShadow = "none";
        };
        btn.onmouseup = () => {
            btn.style.transform = "translateY(0px)";
            btn.style.boxShadow = `0 5px 0 ${shadowColor}`;
        };

        btn.onclick = () => selectTable(i);
        container.appendChild(btn);
    }
}

// ฟังก์ชันสำหรับเวลากดกลับมาขายหน้าร้าน (Walk-in) 29-04-2026
function selectWalkIn() {
    selectedTable = null;
    const display = document.getElementById('current-table-display');
    if (display) {
        display.innerText = "📍 กำลังขาย: หน้าร้าน (Walk-in)";
        display.style.background = "#34495e";
    }
    const btnToTable = document.getElementById('btn-to-table');
    if (btnToTable) btnToTable.style.display = 'none'; // ซ่อนปุ่มฝากลงโต๊ะ
    
    const billingBox = document.getElementById('pending-billing-box');
    if (billingBox) billingBox.style.display = 'none';

    renderTableSelection(); // วาดปุ่มใหม่เพื่อย้ายไฮไลท์สีส้ม
}

// 3. ฟังก์ชันเมื่อกดเลือกโต๊ะ 30-04-2026
async function selectTable(tableId) {
    // 1. อัปเดตตัวแปรสถานะ
    selectedTable = tableId; 

    // 2. ปรับแต่ง UI ส่วนหัวให้ยายรู้ว่ากำลังคุมโต๊ะไหน
    const display = document.getElementById('current-table-display');
    if (display) {
        display.innerText = "📍 กำลังจัดการ: โต๊ะ " + tableId;
        display.style.background = "#2ecc71"; // สีเขียว (Ready)
        display.style.color = "white";
        display.style.padding = "10px";
        display.style.borderRadius = "10px";
    }

    // ❌ [จุดที่ลบออก]: ลบบรรทัดที่สั่ง btnToTable.style.display = 'block' ตรงนี้ทิ้งไป
    // เพราะเราจะให้ฟังก์ชัน updateOrderPreview เป็นคนตัดสินใจแทนว่า "ควรโชว์ปุ่มไหม" 

    try {
        // 3. ดึงข้อมูลจากฐานข้อมูลมาเช็กสถานะโต๊ะ
        const tableData = await db.active_tables.get(tableId);

        // ล้างตะกร้าในมือทุกครั้งที่เปลี่ยนโต๊ะ (ป้องกันออเดอร์ปนกัน)
        cart = []; 

        if (tableData) {
            // ✅ กรณีโต๊ะนี้มีบิลค้าง
            if (typeof refreshBillingBox === 'function') {
                await refreshBillingBox(tableId); 
            }
            
            const billingBox = document.getElementById('pending-billing-box');
            if (billingBox) billingBox.style.display = 'block';

        } else {
            // ❌ กรณีโต๊ะว่าง
            const billingBox = document.getElementById('pending-billing-box');
            if (billingBox) billingBox.style.display = 'none';
        }

        // 4. 🔥 [จุดสำคัญ]: เรียกใช้ updateOrderPreview เพื่อจัดการปุ่ม "ฝากลงโต๊ะ"
        // พอมันทำงานหลังจาก cart = []; ปุ่ม "ฝากลงโต๊ะ" จะถูกซ่อนไปโดยอัตโนมัติ (ไม่กะพริบแล้ว!)
        if (typeof updateOrderPreview === 'function') {
            updateOrderPreview(); 
        }
        
        if (typeof renderTableSelection === 'function') {
            await renderTableSelection();
        }

    } catch (err) {
        console.error("❌ เกิดข้อผิดพลาดตอนดึงข้อมูลโต๊ะ:", err);
    }
}

// ฟังก์ชันสำหรับ "หย่อนบิล" ลงโต๊ะ (ยังไม่บันทึกเป็นยอดขายจริง) 29-04-2026
async function confirmToTable() {
    // 1. เช็กก่อนว่าเลือกโต๊ะหรือยัง และมีของในตะกร้าไหม
    if (!selectedTable) {
        alert("กรุณาเลือกเลขโต๊ะก่อนหย่อนบิลครับเพื่อน!");
        return;
    }
    if (cart.length === 0) {
        alert("ตะกร้าว่างเปล่า หย่อนบิลไม่ได้นะ!");
        return;
    }

    try {
        // 2. ดึงข้อมูลปัจจุบันของโต๊ะนี้จากฐานข้อมูล (Offline-First)
        const existingTable = await db.active_tables.get(selectedTable);
        
        let updatedItems = [];
        if (existingTable) {
            // ถ้ามีของเก่าอยู่แล้ว ให้เอาของใหม่ (cart) ไปต่อท้าย (Append)
            updatedItems = [...existingTable.order_items, ...cart];
        } else {
            // ถ้าเป็นโต๊ะว่าง ก็เริ่มด้วยของในตะกร้าปัจจุบัน
            updatedItems = [...cart];
        }

        // 3. บันทึกลงตาราง active_tables (พักบิลไว้)
        await db.active_tables.put({
            table_id: selectedTable,
            order_items: updatedItems,
            last_update: new Date().toISOString()
        });

        // 4. เคลียร์ตะกร้าหน้าจอ เพื่อรับออเดอร์ถัดไป
        cart = [];
        updateOrderPreview(); // อัปเดต UI หน้าจอขาย
        renderTableSelection(); // อัปเดตสีปุ่มโต๊ะ (ให้กลายเป็นสีส้มว่ามีคนนั่ง)
        
        console.log(`✅ หย่อนบิลลงโต๊ะ ${selectedTable} สำเร็จ!`);
        alert(`เพิ่มรายการลงโต๊ะ ${selectedTable} เรียบร้อยแล้วครับ`);

    } catch (err) {
        console.error("เกิดข้อผิดพลาดในการหย่อนบิล:", err);
        alert("อุ้ย! บันทึกลงโต๊ะไม่ได้ ตรวจสอบฐานข้อมูลทีครับ");
    }
}

// ฟังก์ชัน: แสดงรายการอาหารที่ค้างอยู่ในโต๊ะ (Pending Billing Box)
// ทำงานเมื่อ: จิ้มเลือกโต๊ะที่มีออเดอร์ค้างอยู่ 29-04-2026
// ==========================================
async function refreshBillingBox(tableId) {
    // ดึง Element ต่างๆ มาเตรียมไว้
    const box = document.getElementById('pending-billing-box');
    const listContainer = document.getElementById('billing-items-list');
    const title = document.getElementById('billing-table-title');
    const totalDisplay = document.getElementById('billing-total-amount');

    // 1. ดึงข้อมูลล่าสุดจากฐานข้อมูล active_tables
    // หาก tableId เป็น null หรือ undefined ฟังก์ชัน get จะส่งค่า undefined กลับมา (ไม่พัง)
    const tableData = await db.active_tables.get(tableId);

    // 🛑 [จุดแก้ไขวิกฤต] เช็กความพร้อมของข้อมูลก่อนทำงานต่อ
    // เพื่อแก้ปัญหา "Cannot read properties of undefined (reading 'length')" ในรูป 73
    if (!tableData || !tableData.order_items || tableData.order_items.length === 0) {
        if (box) box.style.display = 'none'; // ถ้าไม่มีข้อมูลให้ซ่อนกล่องบิลค้างทันที
        return; // จบการทำงานตรงนี้ ไม่ฝืนทำต่อจนพัง
    }

    // 2. ถ้ามีข้อมูล: แสดงกล่องสรุปบิลและอัปเดตหัวข้อโต๊ะ
    if (box) box.style.display = 'block';
    if (title) title.innerText = `📝 รายการค้างชำระ โต๊ะ ${tableId}`;

    // 3. เริ่มกระบวนการวาดรายการอาหารใหม่
    if (listContainer) {
        listContainer.innerHTML = ''; // ล้าง HTML เก่าทิ้ง
        let total = 0;

        // 4. วนลูปวาดรายการจากอาร์เรย์ order_items
        tableData.order_items.forEach((item, index) => {
            const itemRow = document.createElement('div');
            
            // จัดการสไตล์ให้ดูง่าย (ชื่อซ้าย ราคาขวา)
            itemRow.style.display = 'flex';
            itemRow.style.justifyContent = 'space-between'; 
            itemRow.style.padding = '8px 0';
            itemRow.style.borderBottom = '1px solid #eee';
            
            // แสดงข้อมูลเมนูและราคา
            // ใช้ (item.qty || 1) เพื่อกันกรณีลืมใส่จำนวน จะได้ไม่คำนวณเป็น NaN
            itemRow.innerHTML = `
                <div style="text-align: left;">
                    <span style="font-weight: bold;">${item.name}</span>
                    ${item.options ? `<br><small style="color: #666;">- ${item.options}</small>` : ''}
                    <span style="color: #27ae60; margin-left: 10px;">x${item.qty || 1}</span>
                </div>
                <div style="font-weight: bold;">
                    ${(item.price * (item.qty || 1)).toLocaleString()}.-
                </div>
            `;
            
            listContainer.appendChild(itemRow);
            
            // สะสมยอดรวมสุทธิ
            total += item.price * (item.qty || 1);
        });

        // 5. แสดงยอดรวมที่คำนวณได้
        if (totalDisplay) {
            totalDisplay.innerText = `${total.toLocaleString()}.-`;
        }
    }
}

//หย่อนบิลสั่งอาหาร 30-04-2026
async function saveOrderToTable() {
    if (cart.length === 0) return alert("เลือกเมนูก่อนฝากลงโต๊ะครับ!");
    if (!selectedTable) return alert("กรุณาเลือกโต๊ะก่อนครับ!");

    try {
        // --- 1. [ส่วนสำคัญ] ระบบดึงข้อมูลเดิมมาต่อยอด ---
        // เช็กก่อนว่าโต๊ะนี้มีออเดอร์ค้างอยู่แล้วหรือเปล่า
        const existingOrder = await db.active_tables.get(selectedTable);
        
        let finalItems = [];
        
        if (existingOrder && existingOrder.order_items) {
            // กรณีมีของเก่า: เอา "ของเก่า" มากางออก แล้วเติม "ของใหม่จากตะกร้า" ต่อท้ายเข้าไป
            finalItems = [...existingOrder.order_items, ...cart];
            console.log(`➕ โต๊ะ ${selectedTable} สั่งเพิ่ม: รวมเป็น ${finalItems.length} รายการ`);
        } else {
            // กรณีโต๊ะว่าง: ใช้ข้อมูลจากตะกร้าได้เลย
            finalItems = [...cart];
            console.log(`📥 โต๊ะ ${selectedTable} สั่งครั้งแรก: ${finalItems.length} รายการ`);
        }

        // --- 2. บันทึกข้อมูลลงในตาราง active_tables ---
        // ใช้ชื่อ 'order_items' ตามที่เพื่อนกำหนด เพื่อให้ refreshBillingBox ทำงานได้
        await db.active_tables.put({
            table_id: selectedTable,
            order_items: finalItems, // 🔥 ใช้รายการที่รวมกันแล้ว (Array ที่สะสมของเก่า+ใหม่)
            updated_at: new Date().toLocaleString('sv-SE') // รูปแบบ YYYY-MM-DD HH:mm:ss
        });

        alert(`📥 ฝากรายการลงโต๊ะ ${selectedTable} เรียบร้อย!`);
        
        // --- 3. ล้างข้อมูลเพื่อเริ่มออเดอร์ถัดไป ---
        const lastTable = selectedTable; // จำเลขโต๊ะไว้เพื่ออัปเดต UI ก่อนรีเซ็ต
        cart = [];
        selectedTable = null; // รีเซ็ตสถานะกลับเป็น Walk-in (หน้าร้าน)
        
        // --- 4. อัปเดตหน้าจอ (UI) ---
        // วาดปุ่มโต๊ะใหม่ เพื่อให้ปุ่มกลายเป็นสีส้ม (สถานะมีบิลค้าง)
        if (typeof renderTableSelection === "function") await renderTableSelection();
        
        // ล้าง Preview ตะกร้าสินค้าหน้าจอหลัก
        if (typeof updateOrderPreview === "function") updateOrderPreview();

        // อัปเดตกล่องสรุปยอดเงินข้างๆ (ถ้ามี)
        if (typeof refreshBillingBox === "function") {
            refreshBillingBox(lastTable);
        }
        
    } catch (err) {
        console.error("❌ ฝากลงโต๊ะพลาด:", err);
        alert("เกิดข้อผิดพลาดในการฝากข้อมูล! เช็กชื่อตารางใน Dexie อีกครั้งครับ");
    }
}
 
// ฟังก์ชันปิดกล่อง (เมื่อต้องการเคลียร์หน้าจอ) 29-04-2026
function closeBillingBox() {
    document.getElementById('pending-billing-box').style.display = 'none';
    selectedTable = null;
    renderTableSelection(); // รีเฟรชสีปุ่มโต๊ะ
}
//โหมดหน้าร้าน 1-05-2026
async function selectTakeawayMode() {
    // --- ส่วนที่ 1: เคลียร์โต๊ะ "จองทิพย์" (กดเลือกแต่ไม่มีอาหาร) ---
    if (selectedTable) {
        try {
            const tableData = await db.active_tables.get(selectedTable);
            
            // ถ้าเช็กแล้วว่าโต๊ะนี้ว่างจริง (ไม่มีอาหาร) ให้ลบทิ้งจากระบบ "บิลค้าง" ทันที
            if (!tableData || !tableData.order_items || tableData.order_items.length === 0) {
                await db.active_tables.delete(selectedTable);
                console.log(`🧹 เคลียร์โต๊ะ ${selectedTable} ให้กลับเป็นสีเทาเพราะไม่มีอาหาร`);
            }
        } catch (err) {
            console.error("เกิดข้อผิดพลาดในการตรวจสอบโต๊ะก่อนสลับโหมด:", err);
        }
    }

    // --- ส่วนที่ 2: เปลี่ยนสถานะระบบเป็น "ขายหน้าร้าน" ---
    // บอกระบบว่าตอนนี้ออเดอร์ปัจจุบันไม่ผูกกับโต๊ะไหนแล้ว
    selectedTable = null; 

    // --- ส่วนที่ 3: จัดการความสวยงามของปุ่ม (UI) ---
    // 3.1 ล้างไฮไลท์สีเขียวออกจากปุ่มโต๊ะทั้งหมดในทันที
    document.querySelectorAll('.table-btn').forEach(btn => {
        btn.classList.remove('active'); 
    });

    // 3.2 เน้นปุ่ม "ขายหน้าร้าน" ให้เด่นขึ้น (ใช้สีส้มเข้มแบบพรีเมียม)
    const btnTakeaway = document.getElementById('btn-takeaway');
    if (btnTakeaway) {
        btnTakeaway.style.backgroundColor = "#ff9f43"; // สีส้มเข้มเพื่อให้รู้ว่าทำงานโหมดนี้อยู่
        btnTakeaway.style.boxShadow = "0 5px 0 #000000"; // ใส่เงาให้ดูมีมิติ
    }

    // --- ส่วนที่ 4: 🔥 [จุดที่ต้องเพิ่ม] สั่งให้หน้าจอวาดตัวเองใหม่ ---
    // 4.1 เรียก "ช่างทาสี" (renderTableSelection) มาเช็กฐานข้อมูลและระบายสีปุ่มใหม่
    // บรรทัดนี้จะทำให้โต๊ะ 1 ที่เคยเขียว เปลี่ยนเป็นสีเทา (ถ้าไม่มีอาหาร) หรือสีส้ม (ถ้ามีอาหารค้าง)
    if (typeof renderTableSelection === "function") {
        await renderTableSelection(); 
    }

    // 4.2 อัปเดตพรีวิวออเดอร์ (เพื่อให้ปุ่ม "ฝากลงโต๊ะ" หายไป)
    if (typeof updateOrderPreview === "function") {
        updateOrderPreview();
    }

    console.log("🥡 เข้าสู่โหมดขายหน้าร้าน ");
}


// ==========================================
// ฟังก์ชัน: เช็คบิล (ดึงรายการจากโต๊ะกลับมาจ่ายเงิน)
// ทำงานเมื่อ: กดปุ่ม "💰 เช็คบิลเก็บเงิน" ในกล่องเก็บบิล 29-04-2026
// ==========================================
async function checkoutTable() {
    if (!selectedTable) return;

    // 1. ดึงข้อมูลออเดอร์ค้างจากโต๊ะนั้นมา
    const tableData = await db.active_tables.get(selectedTable);
    if (!tableData || tableData.order_items.length === 0) {
        alert("โต๊ะนี้ไม่มีรายการอาหารครับ");
        return;
    }

    // 2. ยืนยันการเช็คบิล
    if (confirm(`เรียกเก็บเงิน โต๊ะ ${selectedTable} ใช่หรือไม่?`)) {
        try {
            // 🔥 หัวใจสำคัญ: ดึงรายการจากโต๊ะ กลับเข้าสู่ "ตะกร้าหลัก" (Cart)
            // เพื่อให้ยายไปกดปุ่ม "เงินสด" หรือ "เงินโอน" ที่หน้าหลักต่อได้เลย
            cart = [...tableData.order_items]; 

            // 3. อัปเดตหน้าจอขายให้แสดงรายการที่ดึงมาจากโต๊ะ
            if (typeof updateOrderPreview === 'function') {
                updateOrderPreview(); 
            }

            // 4. 🔥 แก้บั๊ก box is not defined: ประกาศตัวแปรอ้างอิงให้ถูกต้อง
            const billingBox = document.getElementById('pending-billing-box');
            if (billingBox) {
                billingBox.style.display = 'none'; // ซ่อนกล่องเก็บบิลหลังจากดึงข้อมูลไปแล้ว
            }

            // 5. ปรับสถานะปุ่มโต๊ะ (ยังไม่ลบจาก DB จนกว่าจะจ่ายเงินสำเร็จจริงๆ)
            // หรือจะเลือกให้ลบทันทีที่ดึงมาจ่ายเงินก็ได้ (แนะนำให้ลบตอนบันทึกเงินสำเร็จ)
            
            alert(`ดึงรายการจาก โต๊ะ ${selectedTable} มาแล้วครับ ยายกดรับเงินสดหรือโอนได้เลย!`);

        } catch (err) {
            console.error("เกิดข้อผิดพลาดในการดึงข้อมูลโต๊ะ:", err);
            alert("เช็คบิลไม่ได้ ลองดูที่ Console นะเพื่อน");
        }
    }
}

// ==========================================
// ฟังก์ชันกลาง: สำหรับบันทึกยอดขายและเคลียร์ข้อมูล 29-04-2026
// paymentMethod: 'cash' หรือ 'transfer'
// ==========================================
async function finalizeOrder(paymentMethod) {
    if (cart.length === 0) {
        alert("ไม่มีรายการในตะกร้าครับเพื่อน!");
        return;
    }

    try {
        const orderId = Date.now();
        const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

        // 1. บันทึกรายการลงตาราง orders (ยอดขายจริง)
        for (const item of cart) {
            await db.orders.add({
                order_id: orderId,
                menu_name: item.name,
                total_price: item.price,
                discount: item.discount || 0,
                options: item.options || "",
                created_at: createdAt,
                payment_method: paymentMethod
            });
        }

        // 2. 🔥 ล้างข้อมูลระบบโต๊ะ (ส่วนสำคัญที่ทำให้โต๊ะหายส้ม)
        if (selectedTable) {
            // ลบจากฐานข้อมูล Offline (Dexie)
            await db.active_tables.delete(selectedTable);
            console.log(`🧹 เคลียร์ข้อมูลโต๊ะ ${selectedTable} เรียบร้อย`);
            
            // รีเซ็ตตัวแปรคุมสถานะให้เป็นค่าว่าง
            selectedTable = null; 
        }

        // 3. 🧹 กวาดล้าง UI (ป้องกันปุ่มเก่าโผล่ซ้อน)
        cart = []; // ล้างข้อมูลในตะกร้าหน้าจอ

        // รีเซ็ตตัวหนังสือบอกเลขโต๊ะให้กลับเป็น "หน้าร้าน"
        const display = document.getElementById('current-table-display');
        if (display) {
            display.innerText = "📍 กำลังขาย: หน้าร้าน (Walk-in)";
            display.style.background = "#34495e"; // กลับเป็นสีเข้มปกติ
        }

        // ซ่อนปุ่ม "ฝากลงโต๊ะ" ทันที เพราะเราจบงานแล้ว
        const btnToTable = document.getElementById('btn-to-table');
        if (btnToTable) {
            btnToTable.style.display = 'none';
        }

        // 4. สั่งวาดหน้าจอใหม่ทั้งหมด
        updateOrderPreview();    // ล้างรายการอาหารในตะกร้าที่โชว์อยู่
        renderTableSelection(); // 🌟 สำคัญมาก: เพื่อให้ปุ่มโต๊ะกลับเป็นสีเทา (ว่าง)

        // 5. แสดงผลลัพธ์การชำระเงิน
        if (paymentMethod === 'transfer') {
            if (typeof generateQRCode === 'function') generateQRCode();
        } else {
            alert("✅ บันทึกการขายเงินสดเรียบร้อย!");
        }

        if (typeof loadRecentOrders === 'function') loadRecentOrders();

    } catch (err) {
        console.error("❌ เกิดข้อผิดพลาดในการปิดยอด:", err);
        alert("เกิดข้อผิดพลาดในการบันทึกยอดขาย!");
    }
}

// วิธีเรียกใช้ในปุ่มเดิมของเพื่อน:
// <button onclick="finalizeOrder('cash')">เงินสด</button>
// <button onclick="finalizeOrder('transfer')">เงินโอน</button>

// ==========================================
// กล่องที่ 5: ระบบรายงานและจัดการเมนูทั้งหมด (คลัง)
// ==========================================
function updateProfitStatus(totalSales) {
    const dailyCost = parseFloat(document.getElementById('daily-cost').value) || 0;
    const profitElement = document.getElementById('profit-status');
    if (!profitElement) return;
    const netProfit = totalSales - dailyCost;
    profitElement.innerHTML = netProfit >= 0 ? `✅ กำไรวันนี้: <b>${netProfit.toLocaleString()}</b> .-` : `⚠️ ขาดทุนอยู่: <b>${Math.abs(netProfit).toLocaleString()}</b> .-`;
    profitElement.style.color = netProfit >= 0 ? "#27ae60" : "#e74c3c";
}

async function handleCloseDay() {
    const eggUnitName = localStorage.getItem('counterUnit') || 'รายการ';
    const totalSales = (document.getElementById('total-sales-display').innerText || '0').replace(/,/g, '');
    const eggCount = (document.getElementById('egg-count').innerText || '0').replace(/,/g, '');

    if (confirm(`ยืนยันการปิดยอดวันนี้?\n💰 ยอด: ${totalSales}.-\n📈 ${eggUnitName}: ${eggCount}`)) {
        const today = new Date().toISOString().split('T')[0];
        await db.dailysummary.put({ summary_date: today, total_sales: parseFloat(totalSales), egg_count: parseInt(eggCount) });
        alert("✅ ปิดยอดแล้ว!");
        loadDashboardData();
    }
}

// เพิ่มเมนูใหม่ลง "คลังใหญ่" (Database)
async function addNewMenu() {
    const name = document.getElementById('new-menu-name').value;
    const price = document.getElementById('new-menu-price').value;
    if (name && price) {
        await db.menus.add({ name: name, price: parseFloat(price) });
        document.getElementById('new-menu-name').value = '';
        document.getElementById('new-menu-price').value = '';
        renderMenuList();
        alert("บันทึกเข้าคลังเรียบร้อย!");
    } else { alert("กรุณากรอกข้อมูลให้ครบ"); }
}

// --- ส่วนของคลังเมนูทั้งหมด --- 25-04-2026
async function renderMenuList() {
    const allMenus = await db.menus.toArray();
    const listContainer = document.getElementById('menu-list-items');
    if(!listContainer) return;
    listContainer.innerHTML = ''; 
    
    allMenus.forEach(menu => {
        const li = document.createElement('li');
        // ปรับ CSS ให้ยืดหยุ่นขึ้นเพื่อให้รองรับปุ่มที่เพิ่มมา
        li.style.cssText = "display:flex; flex-direction:column; gap:8px; padding:12px; border-bottom:1px solid #eee; background:#fff;";
        
        li.innerHTML = `
            <div style="display:flex; gap:5px;">
                <input type="text" value="${menu.name}" disabled id="full-edit-name-${menu.id}" 
                    style="flex:2; padding:8px; border:1px solid #ddd; border-radius:5px; background:#f9f9f9;">
                <input type="number" value="${menu.price}" disabled id="full-edit-price-${menu.id}" 
                    style="width:70px; padding:8px; border:1px solid #ddd; border-radius:5px; background:#f9f9f9;">
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <button onclick="toggleEditFullDb(this, ${menu.id})" 
                        style="background:#3498db; color:white; border:none; padding:5px 12px; border-radius:5px; margin-right:5px;">📝 แก้ไข</button>
                    <button onclick="deleteFullMenu(${menu.id})" 
                        style="background:none; border:none; color:#ff4757; cursor:pointer; font-size:0.9rem;">ลบจากคลัง</button>
                </div>
                <button onclick="addFromStorageToQuick('${menu.name}', ${menu.price})" 
                    style="background:#00acc1; color:white; border:none; padding:8px 15px; border-radius:20px; font-weight:bold; font-size:0.85rem;">
                    + หน้าแรก
                </button>
            </div>
        `;
        listContainer.appendChild(li);
    });
}

// ฟังก์ชันใหม่: ใช้ชื่อ toggleEditFullDb เพื่อไม่ให้สับสนกับ toggleEditRow 25-04-2026
async function toggleEditFullDb(btn, id) {
    const nameInput = document.getElementById(`full-edit-name-${id}`);
    const priceInput = document.getElementById(`full-edit-price-${id}`);
    const isLocked = nameInput.disabled;

    if (isLocked) {
        nameInput.disabled = false;
        priceInput.disabled = false;
        nameInput.style.background = "#fff";
        priceInput.style.background = "#fff";
        nameInput.style.border = "1px solid #00acc1";
        btn.innerText = "✅ บันทึก";
        btn.style.background = "#2ecc71";
    } else {
        const newName = nameInput.value;
        const newPrice = parseFloat(priceInput.value);
        if (newName && !isNaN(newPrice)) {
            await db.menus.update(id, { name: newName, price: newPrice });
            nameInput.disabled = true;
            priceInput.disabled = true;
            nameInput.style.background = "#f9f9f9";
            priceInput.style.background = "#f9f9f9";
            nameInput.style.border = "1px solid #ddd";
            btn.innerText = "📝 แก้ไข";
            btn.style.background = "#3498db";
            // สั่งอัปเดตปุ่มหน้าแรกเผื่อข้อมูลเปลี่ยน
            renderOrderButtons(); 
        }
    }
}

// ฟังก์ชันทางลัด: ดึงจากคลังไปโชว์ในหน้าตั้งค่าเมนูขายทันที
function addFromStorageToQuick(name, price) {
    const container = document.getElementById('menu-settings-list');
    const div = document.createElement('div');
    div.className = 'menu-setting-row';
    div.style.display = "flex"; div.style.gap = "5px"; div.style.marginBottom = "8px";
    div.innerHTML = `
        <input type="text" value="${name}" style="flex: 2; padding: 8px;">
        <input type="number" value="${price}" style="width: 70px; padding: 8px;">
        <button onclick="this.parentElement.remove()" style="background: #ff4757; color: white; border: none; padding: 5px 10px; border-radius: 5px;">🗑️</button>
    `;
    container.appendChild(div);
    alert(`เพิ่ม ${name} ลงในรายการขายแล้ว (อย่าลืมกดบันทึกด้านล่าง)`);
}

async function deleteFullMenu(id) {
    if (confirm("จะลบเมนูนี้ออกจากคลังถาวรเลยใช่ไหม?")) {
        await db.menus.delete(id);
        renderMenuList();
    }
}

// ค้นหาจากคลัง (หน้าแรก)
async function searchSmartMenu(query) {
    const resultArea = document.getElementById('search-results-area');
    if (!query || query.length < 1) { resultArea.innerHTML = ''; return; }
    const matches = await db.menus.filter(m => m.name.toLowerCase().includes(query.toLowerCase())).toArray();
    resultArea.innerHTML = '';
    matches.forEach(menu => {
        const btn = document.createElement('button');
        btn.innerText = `➕ ${menu.name} (${menu.price}.-)`;
        btn.style.cssText = "margin:5px; padding:10px; background:#ff9f43; border-radius:12px; border:1px solid #ff9f43;";
        btn.onclick = () => {
            orderMenu(menu.name, menu.price); 
            resultArea.innerHTML = '';
            document.getElementById('smart-search-input').value = '';
        };
        resultArea.appendChild(btn);
    });
}

function openMenuManager() { document.getElementById('menu-manager-section').style.display = 'block'; renderMenuList(); }
function closeMenuManager() { document.getElementById('menu-manager-section').style.display = 'none'; }

async function loadDashboardData() {
    const tableBody = document.getElementById('dashboard-table-body');
    if (!tableBody) return;
    // 🔥 เพิ่ม Logic ดึงชื่อจาก localStorage มาเปลี่ยนหัวตารางก่อนโหลดข้อมูล 26-04-2026
    const savedLabel = localStorage.getItem('counterLabel') || "สิ่งที่นับ";
    const savedUnit = localStorage.getItem('counterUnit') || "หน่วยนับ";
    
    if(document.getElementById('dashboard-unit-header'))
        document.getElementById('dashboard-unit-header').innerText = savedLabel;
    if(document.getElementById('dashboard-unit-name'))
        document.getElementById('dashboard-unit-name').innerText = savedUnit;

    const data = await db.dailysummary.orderBy('summary_date').reverse().limit(7).toArray();

    tableBody.innerHTML = data.length ? '' : '<tr><td colspan="3">ยังไม่มีประวัติ</td></tr>';
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${new Date(row.summary_date).toLocaleDateString('th-TH')}</td>
                        <td><b>${Number(row.total_sales).toLocaleString()}</b></td>
                        <td>${Number(row.egg_count).toLocaleString()}</td>`;
        tableBody.appendChild(tr);
    });
}

async function clearOldOrders() {
    if (confirm("⚠️ ลบออเดอร์ทั้งหมด?")) {
        if (confirm("ยืนยันอีกครั้ง?")) {
            await db.orders.clear();
            alert("✅ ล้างข้อมูลเรียบร้อย!");
            location.reload();
        }
    }
}

// เริ่มระบบ
window.onload = async function() {
    // 1. ดึงข้อมูลชื่อร้านและหัวข้อเมนู (จาก LocalStorage)
    const keys = [{ k: 'shopName', i: 'name-main' }, { k: 'shopMenu', i: 'menu-name' }];
    keys.forEach(item => {
        let val = localStorage.getItem(item.k);
        if (val && document.getElementById(item.i)) {
            document.getElementById(item.i).innerText = val;
        }
    });

    // 2. ตั้งค่าระบบนับ (ไข่ดาว/ฟอง)
    const savedLabel = localStorage.getItem('counterLabel') || "ไข่ดาว";
    const savedUnit = localStorage.getItem('counterUnit') || "ฟอง";

    if (document.getElementById('display-label')) document.getElementById('display-label').innerText = "📊 วันนี้ใช้ " + savedLabel + " ไปแล้ว";
    if (document.getElementById('display-unit')) document.getElementById('display-unit').innerText = savedUnit;
    
    if(document.getElementById('dashboard-unit-header')) document.getElementById('dashboard-unit-header').innerText = savedLabel;
    if(document.getElementById('dashboard-unit-name')) document.getElementById('dashboard-unit-name').innerText = savedUnit;

    if (document.getElementById('counter-label-input')) document.getElementById('counter-label-input').value = savedLabel;
    if (document.getElementById('counter-unit-input')) document.getElementById('counter-unit-input').value = savedUnit;

    // 3. ดึงค่าส่วนลดพื้นฐานมาแสดง
    const savedDiscount = localStorage.getItem('default_discount') || 0;
    if (document.getElementById('set_discount')) {
        document.getElementById('set_discount').value = savedDiscount;
    }

    // 4. 🔥 วาดปุ่มโต๊ะทั้งหมดทันที
    if (typeof renderTableSelection === 'function') {
        await renderTableSelection();
    }

    // 5. โหลดข้อมูลการขายและเมนูอาหาร
    loadDailyCost();      // โหลดทุนวันนี้
    fetchTodaySales();    // คำนวณยอดขาย/กำไร
    renderOrderButtons(); // วาดปุ่มเมนูอาหาร
    renderExtraOptions(); // วาดปุ่มตัวเลือกเสริม
    loadRecentOrders();   // โหลดประวัติออเดอร์ล่าสุด

    // 6. ✨ [จุดที่เพิ่มใหม่]: โหลดระบบจดของและประวัติการซื้อ ✨
    // สั่งให้วาด "รายการที่กำลังจด" (สถานะ pending)
    if (typeof renderShoppingList === 'function') {
        renderShoppingList(); 
    }

    // สั่งให้วาด "ประวัติการซื้อทั้งหมด" (สถานะ completed) 
    // เพื่อให้ประวัติเก่าโผล่มาทันทีที่เปิดแอป
    if (typeof renderFullHistory === 'function') {
        await renderFullHistory(); 
    }

    // เพิ่มบรรทัดนี้ลงไปครับ ✨
    updateDashboardPriceInsight();
    
    
    console.log("🚀 Smart POS พร้อมดูแลร้านยายแล้วจ้า! (Version 11: ระบบประวัติพร้อมใช้งาน)");
};

// ==========================================
// สรุปภาพรวมธุรกิจ (มุมหลานรัก) chart  04-05--2026
// ==========================================
async function openGrandmaDashboard() {
    // --- ส่วนที่ 1: การจัดการหน้าจอและประวัติการเข้าชม ---
    
    // แสดงหน้าต่าง Modal "มุมหลานรักของยาย"
    document.getElementById('dashboard-modal').style.display = 'block';
    
    /**
     * 🚩 จุดเพิ่มใหม่: สร้าง "ประวัติจำลอง" (Push State)
     * เมื่อยายกดเปิดหน้าหนี้ แอปจะหลอกเบราว์เซอร์ว่า "มีการขยับไปอีกหน้าหนึ่ง" 
     * เพื่อให้เวลาเรากดปุ่มย้อนกลับ (Back) ที่ตัวเครื่องมือถือ หรือ Tablet 
     * มันจะย้อนกลับมาที่ 'state' เดิม (ปิด Modal) แทนที่จะปิดแอปทิ้งไปเลย
     */
    history.pushState({ modalOpen: true }, 'GrandmaDashboard'); 

    // --- ส่วนที่ 2: การเตรียมข้อมูลจากฐานข้อมูล ---

    // ดึงข้อมูลสรุปรายวันทั้งหมด เรียงตามวันที่
    const historyData = await db.dailysummary.orderBy('summary_date').toArray();
    
    let labels = [];
    let salesData = [];
    let investmentData = [];
    let accumSales = 0;
    let accumInvest = 0;

    // คำนวณค่าสะสม (Cumulative) เพื่อสร้างกราฟเส้นหัวใจ
    historyData.forEach(day => {
        // จัดรูปแบบวันที่จาก 2026-05-04 เป็น 05/04 เพื่อความสวยงามบนกราฟ
        labels.push(day.summary_date.split('-').slice(1).join('/')); 
        
        accumSales += (day.total_sales || 0);
        accumInvest += (day.daily_investment || 0);
        
        salesData.push(accumSales);
        investmentData.push(accumInvest);
    });

    // --- ส่วนที่ 3: การแสดงผลกราฟและตัวเลข ---

    // วาดกราฟเส้นหัวใจธุรกิจ (Chart.js)
    const ctx = document.getElementById('businessHeartChart').getContext('2d');
    if (window.myChart) window.myChart.destroy(); // เคลียร์กราฟเก่าทิ้งก่อนวาดใหม่ป้องกันข้อมูลซ้อน
    
    window.myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'ยอดขายสะสม', data: salesData, borderColor: '#2ecc71', backgroundColor: 'rgba(46, 204, 113, 0.1)', fill: true, tension: 0.3 },
                { label: 'ทุนสะสม', data: investmentData, borderColor: '#e74c3c', borderDash: [5, 5], tension: 0.1 }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false 
        }
    });

    // อัปเดตตัวเลขยอดรวมและการ์ดข้อความให้กำลังใจในหน้าจอหลักของ Modal
    updateDashboardUI(accumSales, accumInvest);

    // --- ส่วนที่ 4: การคำนวณขั้นสูง (ฟังก์ชันย่อย) ---

    // 🚩 สั่งวาดคะแนน "ความเป็นเนื้อเป็นตัว" (Efficiency Score) ลงในกรอบสีฟ้า
    // ส่งค่าสะสมที่คำนวณได้ไปประมวลผลเป็นคะแนน 0-10
    await renderEfficiencyDashboard(accumSales, accumInvest);

    /**
     * 🚩 จุดแก้ไข: วิเคราะห์ "ช่วงเวลาทำเงิน"
     * สั่งรันกราฟแท่งเพื่อดูว่าช่วงเวลาไหนของวันที่ยายขายดีที่สุด
     * (ต้องมั่นใจว่าในฐานข้อมูลมีการเก็บเวลาที่ทำรายการขายไว้ด้วย)
     */
    if (typeof renderPeakSalesChart === "function") {
        renderPeakSalesChart();
    }
}

function updateDashboardUI(totalSales, totalInvest) {
    const net = totalSales - totalInvest;
    const statsDiv = document.getElementById('dashboard-stats');
    const msgDiv = document.getElementById('grandma-message');

    statsDiv.innerHTML = `
        <div style="background:#e8f5e9; padding:10px; border-radius:10px; text-align:center;">
            <small>ยอดขายรวม</small><br><strong>${totalSales.toLocaleString()}</strong>
        </div>
        <div style="background:#ffebee; padding:10px; border-radius:10px; text-align:center;">
            <small>ทุนสะสม</small><br><strong>${totalInvest.toLocaleString()}</strong>
        </div>
    `;

    if (net >= 0) {
        msgDiv.innerText = `ยายครับ! ตอนนี้เรากำไรสะสมแล้ว ${net.toLocaleString()} บาท หลานภูมิใจในตัวยายที่สุดเลยครับ!`;
    } else {
        msgDiv.innerText = `สู้ๆ ครับยาย อีกแค่ ${Math.abs(net).toLocaleString()} บาท เราก็จะคืนทุนทั้งหมดแล้วครับ!`;
    }
}

function closeDashboard() {
    document.getElementById('dashboard-modal').style.display = 'none';
}

// ==========================================
// ระบบจดบันทึกวัตถุดิบ 3-05-2026
// ==========================================
// ฟังก์ชันเปิด/ปิดหน้าจัดการ
function openShoppingManager() {
    document.getElementById('shopping-manager-page').style.display = 'block';
    renderShoppingList(); // วาดรายการทันทีที่เปิดหน้า
}

// 1. ฟังก์ชันจดของ (เน้นจดอย่างเดียวให้เร็วที่สุด)
async function addShoppingItem() {
    const input = document.getElementById('shopping-input');
    const name = input.value.trim();
    
    if (name) {
        // [ปรับปรุง] ค้นหาประวัติเพื่อเอามาโชว์ใน UI เท่านั้น ไม่บันทึกข้อความเตือนลง DB
        const history = await db.price_history.get(name);
        
        // [บันทึก] ลงรายการจดของ (เน้นชื่อเพียวๆ เพื่อให้ Database สะอาด)
        await db.shopping_list.add({ 
            name: name, 
            price: 0, 
            status: 'pending', 
            date: new Date().toLocaleDateString(),
            last_recorded_price: history ? history.last_price : null // เก็บประวัติแยก field ไว้ดูเทียบ
        });

        input.value = ''; // ล้างช่องพิมพ์
        renderShoppingList(); // สั่งวาดรายการใหม่ทันที
    }
}

async function renderShoppingList() {
    const container = document.getElementById('shopping-list-display');
    if (!container) return; 

    // 1. ดึงรายการซื้อของที่ "ยังไม่ได้บันทึกราคา" (pending)
    // เรียงจากใหม่ไปเก่า รายการล่าสุดอยู่บนสุดเสมอ
    const items = await db.shopping_list.where('status').equals('pending').reverse().toArray();

    // 2. กรณีไม่มีรายการจด
    if (items.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 40px 20px; color: #bdc3c7;">
                <i class="fas fa- clipboard-list" style="font-size: 3rem; margin-bottom: 10px;"></i>
                <p>ยายยังไม่ได้จดอะไรเพิ่มเลยครับ<br><small>ลองพิมพ์ชื่อวัตถุดิบข้างบนดูนะ</small></p>
            </div>
        `;
        return;
    }

    // 3. สร้าง HTML สำหรับแต่ละรายการ
    container.innerHTML = items.map(item => {
        const cleanName = item.name.split(' (')[0];

        return `
        <div style="background: white; padding: 15px; margin-bottom: 12px; border-radius: 15px; 
                    box-shadow: 0 4px 10px rgba(0,0,0,0.05); border: 1px solid #eee;">
            
            <!-- ส่วนที่ 1: ข้อมูลวัตถุดิบและปุ่มจัดการ -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <strong style="font-size: 1.2rem; color: #2c3e50;">${item.name}</strong>
                        
                        <span onclick="showPriceHistory('${cleanName}')" 
                              style="cursor: pointer; background: #fff4e6; padding: 2px 8px; border-radius: 8px; font-size: 0.9rem; border: 1px solid #e67e22; color: #e67e22; font-weight: bold;">
                            🔍 ประวัติ
                        </span>
                    </div>
                    <!-- ✨ ปรับปรุงจุดนี้: ใส่ Icon นาฬิกา และจัดรูปแบบให้อ่านง่าย -->
                    <div style="font-size: 0.85rem; color: #95a5a6; margin-top: 5px; display: flex; align-items: center; gap: 4px;">
                        <span>🕒 จดเมื่อ: ${item.date || 'ไม่ระบุวันที่'}</span>
                    </div>
                </div>
                
                <div style="display: flex; gap: 8px; margin-left: 10px;">
                    <button onclick="editShoppingItem(${item.id}, '${item.name}')" 
                            style="background: #3498db; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer;">
                        📝
                    </button>
                    <button onclick="deleteShoppingItem(${item.id})" 
                            style="background: #e74c3c; color: white; border: none; padding: 10px; border-radius: 8px; cursor: pointer;">
                        🗑️
                    </button>
                </div>
            </div>

            <!-- ส่วนที่ 2: 💰 ช่องใส่ราคาซื้อจริง -->
            <div style="display: flex; align-items: center; gap: 10px; padding-top: 10px; border-top: 1px dashed #ddd;">
                <span style="font-size: 0.95rem; font-weight: bold; color: #27ae60;">ซื้อมาจริง:</span>
                
                <input type="number" id="real-price-${item.id}" 
                       value="${item.price > 0 ? item.price : ''}" 
                       placeholder="บาท" 
                       style="width: 100px; padding: 8px; border-radius: 8px; border: 2px solid #27ae60; font-size: 1.1rem; text-align: center; font-weight: bold;">
                
                <button onclick="updateActualPrice(${item.id}, '${cleanName}')" 
                        style="flex: 1; background: #27ae60; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: bold; font-size: 1rem; cursor: pointer; box-shadow: 0 3px 0 #219150;">
                    ✅ บันทึก
                </button>
            </div>
        </div>
        `;
    }).join('');
}

async function editShoppingItem(id, currentName) {
    const cleanName = currentName.split(' (')[0]; 
    const input = document.getElementById('shopping-input');
    input.value = cleanName;
    input.focus();
    currentEditId = id; // ✅ ใช้งานได้ทันทีเพราะประกาศไว้ข้างบนแล้ว
    console.log("✏️ เตรียมแก้ไขรายการ ID:", id);
}

// 4. ฟังก์ชันบันทึกที่สมบูรณ์ (ใช้กับปุ่มบันทึกของพี่)
async function saveShoppingItem() {
    const input = document.getElementById('shopping-input');
    const name = input.value.trim();
    
    if (!name) {
        alert("กรุณากรอกชื่อวัตถุดิบก่อนบันทึกครับคุณยาย");
        return;
    }

    try {
        // สร้างรูปแบบวันที่และเวลาที่อ่านง่ายสำหรับยาย
        const nowWithTime = new Date().toLocaleString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        if (currentEditId) {
            // 1. กรณีแก้ไข: อัปเดตข้อมูลเดิม
            await db.shopping_list.update(currentEditId, {
                name: name,
                // ใช้สถานะเดิม หรือถ้าซื้อเสร็จแล้วค่อยเป็น completed
                confirmed_date: nowWithTime // ✨ เปลี่ยนมาเก็บเวลาด้วย
            });
            console.log("✅ อัปเดตข้อมูลเรียบร้อย");
            currentEditId = null;
        } else {
            // 2. กรณีเพิ่มใหม่: สร้างข้อมูลใหม่
            await db.shopping_list.add({
                name: name,
                price: 0,
                status: 'pending', // ให้ค้างไว้ที่หน้ารายการซื้อก่อน
                date: nowWithTime // ✨ เก็บเวลาตั้งแต่วินาทีที่ยายกดจด
            });
            console.log("✅ บันทึกรายการใหม่เรียบร้อย");
        }

        // เคลียร์ช่อง Input และวาดหน้าจอใหม่
        input.value = '';
        renderShoppingList(); // อัปเดตรายการที่หน้าจอทันที
        
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการบันทึก:", error);
    }
}

// 3. ฟังก์ชันใหม่: ยืนยันราคาและจำประวัติ (จุดสำคัญของระบบ)
async function confirmPrice(id, name) {
    const priceInput = document.getElementById(`actual-price-${id}`);
    const price = parseFloat(priceInput.value);

    if (price > 0) {
        // อัปเดตสถานะใน shopping_list ว่าซื้อแล้ว
        await db.shopping_list.update(id, { price: price, status: 'completed' });

        // อัปเดตประวัติราคาใน price_history (เพื่อให้ระบบจำไปใช้ครั้งหน้า)
        await db.price_history.put({
            name: name,
            last_price: price,
            update_at: new Date().toLocaleDateString()
        });

        alert(`บันทึก ${name} ราคา ${price} บาท เรียบร้อย!`);
        renderShoppingList(); // วาดใหม่ รายการที่ซื้อแล้วจะหายไปจากหน้าจดของ
    } else {
        alert("กรุณาใส่ราคาที่ซื้อมาจริงด้วยครับยาย");
    }
}

// เพิ่มฟังก์ชันลบรายการด้วยครับ
async function deleteShoppingItem(id) {
    if (confirm("คุณยายต้องการลบรายการนี้ใช่ไหมครับ?")) {
        await db.shopping_list.delete(id);
        renderShoppingList();
    }
}

async function updateActualPrice(id, cleanName) {
    const priceInput = document.getElementById(`real-price-${id}`);
    const actualPrice = parseFloat(priceInput.value);

    if (isNaN(actualPrice) || actualPrice <= 0) {
        alert("คุณยายอย่าลืมใส่ราคาที่ซื้อจริงเป็นตัวเลขด้วยนะครับ");
        return;
    }

    try {
        // สร้างรูปแบบ วันที่ + เวลา สำหรับแสดงผลให้ยายอ่านง่าย
        // ผลลัพธ์จะเป็นประมาณ: "3 พฤษภาคม 2569 18:15"
        const nowWithTime = new Date().toLocaleString('th-TH', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        // 1. ดึงข้อมูลประวัติเดิมมา "เทียบ" เพื่อวิเคราะห์ราคา
        const history = await db.price_history.get(cleanName);
        let compliment = ""; 

        if (history) {
            const priceDiff = history.last_price - actualPrice;

            if (actualPrice < history.best_price) {
                compliment = `\n🏆 ทุบสถิติ! นี่คือราคาที่ถูกที่สุดที่ยายเคยซื้อเลยครับ (เดิม ${history.best_price}.-)`;
            } else if (priceDiff > 0) {
                compliment = `\n✨ ยายซื้อถูกลงกว่ารอบก่อน ${priceDiff} บาทแน่ะ!`;
            } else if (priceDiff < 0) {
                compliment = `\n📦 รอบนี้ของแพงขึ้นนิดหน่อยนะครับยาย (เพิ่มขึ้น ${Math.abs(priceDiff)}.-)`;
            }

            // อัปเดตตาราง price_history พร้อมบันทึกเวลาอัปเดตล่าสุด
            await db.price_history.put({
                name: cleanName,
                last_price: actualPrice,
                best_price: Math.min(history.best_price, actualPrice),
                last_updated: nowWithTime // เปลี่ยนจากแค่ Date เป็น DateTime
            });
        } else {
            compliment = "\n🌟 บันทึกราคาครั้งแรกเรียบร้อย ต่อไปหลานจะช่วยจำให้นะครับ";
            await db.price_history.put({
                name: cleanName,
                last_price: actualPrice,
                best_price: actualPrice,
                last_updated: nowWithTime
            });
        }

        // 2. เปลี่ยนสถานะใน shopping_list เป็น 'completed' 
        // บันทึกเวลาที่ซื้อสำเร็จลงไปที่นี่ เพื่อให้หน้าประวัติโชว์เวลาได้
        await db.shopping_list.update(id, { 
            price: actualPrice, 
            status: 'completed',
            confirmed_date: nowWithTime // ยายจะเห็นเวลาในหน้าประวัติซื้อของ
        });

        // 3. เชื่อมโยงข้อมูลไปที่ระบบบัญชีร้านค้า
        await syncPurchaseToInvestment(actualPrice);

        // [ผลลัพธ์]: แจ้งเตือนพร้อมคำวิเคราะห์
        alert(`บันทึกราคา ${cleanName} เรียบร้อย!${compliment}`);
        
        // 4. ✨ อัปเดตการแสดงผลหน้าจอให้ทันสมัยที่สุด
        renderShoppingList(); // ลบของที่เพิ่งซื้อออกจากรายการจด
        
        if (typeof renderFullHistory === "function") {
            await renderFullHistory(); // วาดประวัติใหม่พร้อมเวลาล่าสุด
        }

        if (typeof updateDashboardPriceInsight === "function") {
            updateDashboardPriceInsight(); // อัปเดตกล่องสีเหลืองใน Dashboard
        }

        if (typeof runSmartAnalysis === "function") {
            runSmartAnalysis(); 
        }

    } catch (err) {
        console.error("เกิดข้อผิดพลาดในการบันทึกราคา:", err);
        alert("อุ๊ย! เกิดข้อผิดพลาดนิดหน่อยครับคุณยาย ลองใหม่อีกครั้งนะ");
    }
}

// ฟังก์ชันช่วยส่งยอดซื้อไปรวมกับทุนรายวัน (เพื่อให้ Dashboard ขยับ)
async function syncPurchaseToInvestment(amount) {
    const today = new Date().toLocaleDateString();
    const summary = await db.dailysummary.get(today);
    
    if (summary) {
        // เพิ่มยอดเงินลงทุนสะสมตามราคาที่เพิ่งบันทึกจริงเข้าไป
        await db.dailysummary.update(today, {
            daily_investment: (summary.daily_investment || 0) + amount
        });
    }
}

async function runSmartAnalysis() {
    // 1. วิเคราะห์ดัชนีราคา (ดึงราคาจากตาราง price_history)
    const history = await db.price_history.orderBy('best_price').limit(3).toArray();
    
    // ✨ ชี้ไปที่ ID "price-content" ตามที่อยู่ใน HTML ของพี่เป๊ะๆ
    const priceDiv = document.getElementById('price-content'); 
    
    if (history.length > 0) {
        // [แก้ไข]: ใส่ข้อมูลเข้าไปใน price-content และใช้แว่นขยาย 🔍
        priceDiv.innerHTML = history.map(item => 
            `<div onclick="showPriceHistory(\`${item.name}\`)" 
                  style="cursor:pointer; padding:8px; border-bottom:1px solid #eee; margin-bottom:5px; color: #5d4037;"
                  title="คลิกดูประวัติราคา">
                • <b>${item.name}</b> ถูกสุด <b>${item.best_price}.-</b> 🔍
             </div>`).join('');
    } else {
        priceDiv.innerText = "ยายจดของบ่อยๆ นะ แล้วหลานจะจำราคาที่ถูกที่สุดให้ครับ!";
    }

    // 2. คำนวณ Efficiency Score (ยอดขาย / ต้นทุน)
    // [คงเดิม]: แสดงผลคะแนนความเก่งในการบริหารทุน
    const today = new Date().toLocaleDateString();
    const summary = await db.dailysummary.get(today);
    const scoreContent = document.getElementById('score-content');
    const scoreMsg = document.getElementById('score-message');

    if (summary && summary.daily_investment > 0) {
        const ratio = summary.total_sales / summary.daily_investment;
        let score = (ratio * 2).toFixed(1); 
        score = Math.min(score, 10); 
        
        scoreContent.innerText = `${score}/10`;
        scoreMsg.innerText = score >= 7 ? "วันนี้ยายบริหารทุนเก่งมากครับ!" : "วันนี้คนอาจจะน้อยหน่อย พรุ่งนี้สู้ใหม่นะยาย!";
    }

    // 3. ระบบพยากรณ์ของที่ต้องซื้อ
    // [คงเดิม]: กรองเฉพาะรายการ 'pending' เพื่อแจ้งเตือนของที่ยังไม่ได้ซื้อ
    const pendingList = await db.shopping_list.where('status').equals('pending').toArray();
    const suggestDiv = document.getElementById('suggestion-content');
    
    if (pendingList.length > 0) {
        suggestDiv.innerHTML = `ยายมีของค้างในใจ <b>${pendingList.length} อย่าง</b> อย่าลืมซื้อนะครับ!`;
    } else {
        suggestDiv.innerText = "ตอนนี้ของครบแล้ว ยายพักผ่อนให้สบายนะครับ";
    }
}

async function showPriceHistory(itemName) {
    try {
        // 1. ดึงข้อมูลจากฐานข้อมูล shopping_list โดยตรง
        // ใช้ชื่อวัตถุดิบเป็นตัวกรอง
        const allRecords = await db.shopping_list
            .where('name')
            .equals(itemName)
            .toArray();

        // 2. กรองเฉพาะรายการที่ซื้อสำเร็จ (completed) และมีราคาที่เป็นตัวเลขจริงๆ
        // [สิ่งที่ปรับ]: ใช้ parseFloat เพื่อป้องกันกรณีราคาถูกเก็บเป็น String แล้วคำนวณผิด
        const history = allRecords
            .filter(item => item.status === 'completed' && !isNaN(parseFloat(item.price)))
            .sort((a, b) => {
                // [จุดสำคัญ]: JavaScript มักจะงงกับวันที่ภาษาไทย (4 พฤษภาคม 2569)
                // เราจึงใช้ ID (Primary Key) ในการเรียงแทน เพราะรายการที่มาทีหลัง ID จะมากกว่าเสมอ
                return b.id - a.id; 
            });

        const tableContent = document.getElementById('history-table-content');
        const titleElement = document.getElementById('history-title');
        
        titleElement.innerText = `📊 ประวัติราคา: ${itemName}`;
        
        if (history.length > 0) {
            // 3. คำนวณราคา (ใช้ parseFloat เพื่อความแม่นยำ)
            const minPrice = Math.min(...history.map(item => parseFloat(item.price)));
            const latestPrice = parseFloat(history[0].price);

            let html = `
                <div style="background: #fff8f0; padding: 10px; border-radius: 8px; margin-bottom: 15px; border-left: 5px solid #e67e22;">
                    <small style="color: #7f8c8d;">สรุปราคาล่าสุด:</small>
                    <div style="display: flex; justify-content: space-between; margin-top: 5px;">
                        <span>💰 ล่าสุด: <b>${latestPrice.toLocaleString()}.-</b></span>
                        <span style="color: #27ae60;">📉 ถูกสุด: <b>${minPrice.toLocaleString()}.-</b></span>
                    </div>
                </div>
                <table style="width:100%; border-collapse:collapse; font-size: 0.95rem;">
                <thead style="background:#fdf2f2; color:#e67e22;">
                    <tr>
                        <th style="padding:12px 8px; border-bottom:2px solid #eee; text-align:left;">วันที่ซื้อ</th>
                        <th style="padding:12px 8px; border-bottom:2px solid #eee; text-align:right;">ราคา (บาท)</th>
                    </tr>
                </thead>
                <tbody>`;
            
            // 4. แสดงผล 5 รายการล่าสุด (ใช้ slice เพื่อไม่ให้ตารางยาวเกินไป)
            history.slice(0, 5).forEach(h => {
                const currentPrice = parseFloat(h.price);
                const isMinPrice = currentPrice === minPrice;
                
                // [สิ่งที่ปรับ]: ใส่สีเขียวเข้มและตัวหนาเฉพาะแถวที่เป็นราคาถูกที่สุด
                const priceStyle = isMinPrice ? 'color: #27ae60; font-weight: bold;' : 'color: #2c3e50;';
                
                html += `
                <tr style="border-bottom: 1px solid #f9f9f9;">
                    <td style="padding:12px 8px; color: #7f8c8d;">
                        ${h.confirmed_date || h.date || 'ไม่ระบุวันที่'} 
                    </td>
                    <td style="padding:12px 8px; text-align:right; ${priceStyle}">
                        ${currentPrice.toLocaleString()}.- ${isMinPrice ? '✨' : ''}
                    </td>
                </tr>`;
            });
            
            html += `</tbody></table>`;
            tableContent.innerHTML = html;
        } else {
            // กรณีไม่มีข้อมูลประวัติการซื้อที่สำเร็จ
            tableContent.innerHTML = `
                <div style="text-align:center; padding:30px 10px; color:#999;">
                    <p style="font-size: 3rem; margin:0;">📝</p>
                    <p>ยังไม่มีประวัติการซื้อ "${itemName}"<br>
                    <small>ยายต้องกด "จ่ายเงิน/ปิดยอด" ในเมนูจดของก่อนนะครับ</small></p>
                </div>`;
        }

        // 5. แสดง Modal (ต้องมั่นใจว่า ID นี้มีอยู่ใน HTML)
        document.getElementById('price-history-modal').style.display = 'flex';

    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการดึงประวัติ:", error);
        alert("ไม่สามารถโหลดประวัติได้ครับพี่ ลองเช็ค console ดูนะ");
    }
}

async function renderFullHistory() {
    const historyContainer = document.getElementById('full-history-display'); 
    if (!historyContainer) return;

    try {
        // 1. [การดึงข้อมูล]: ดึงเฉพาะรายการที่ซื้อสำเร็จ (completed)
        // ใช้ .reverse() เพื่อให้รายการที่เพิ่งซื้อล่าสุด (รวมถึงเวลาล่าสุด) อยู่บนสุดเสมอ
        const allHistory = await db.shopping_list
            .where('status')
            .equals('completed')
            .reverse()
            .toArray();

        // 2. [กรณีไม่มีข้อมูล]: แสดงสถานะว่างเปล่า
        if (allHistory.length === 0) {
            historyContainer.innerHTML = `
                <div style="text-align:center; padding: 30px; color:#95a5a6;">
                    <i class="fas fa-shopping-basket" style="font-size: 2rem; margin-bottom: 10px;"></i>
                    <p>ยังไม่มีประวัติการซื้อครับยาย<br><small>พอยายกด "บันทึกราคา" ประวัติจะมาโชว์ตรงนี้ครับ</small></p>
                </div>
            `;
            return;
        }

        // 3. [การแสดงผล]: วาดรายการประวัติพร้อมรายละเอียด "เวลา"
        historyContainer.innerHTML = allHistory.map(item => {
            // แยกวันที่กับเวลาออกจากกัน (ถ้ามี) เพื่อจัดรูปแบบให้สวยขึ้น
            // สมมติ confirmed_date คือ "3 พฤษภาคม 2569 18:15"
            const fullDate = item.confirmed_date || item.date;
            
            return `
                <div id="history-item-${item.id}" style="display: flex; justify-content: space-between; align-items: center; padding: 15px 12px; border-bottom: 1px solid #f8f9fa;">
                    <div style="flex: 1;">
                        <div style="color: #2c3e50; font-weight: bold; font-size: 1.05rem; margin-bottom: 3px;">
                            <!-- สำคัญมาก: ต้องมี id="name-display-${item.id}" -->
                            <span id="name-display-${item.id}">${item.name.split(' (')[0]}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px; color: #7f8c8d; font-size: 0.85rem;">
                            <span>📅 ${fullDate}</span>
                        </div>
                    </div>
                    
                    <div style="text-align: right; min-width: 100px; display: flex; flex-direction: column; align-items: flex-end; gap: 5px;">
                        <div style="color: #27ae60; font-weight: 800; font-size: 1.2rem;">
                            <!-- สำคัญมาก: ต้องมี id="price-display-${item.id}" -->
                            <span id="price-display-${item.id}">${Number(item.price).toLocaleString()}</span>.-
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <small style="color: #bdc3c7; font-size: 0.7rem;">บันทึกแล้ว</small>
                            <!-- ปุ่มแก้ไข -->
                            <button onclick="editHistoryItem(${item.id})" 
                                    style="border: none; background: #f1f2f6; border-radius: 4px; cursor: pointer; padding: 2px 5px; font-size: 0.9rem;">
                                ✏️
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Error rendering history:", err);
        historyContainer.innerHTML = `<div style="text-align:center; color:red; padding:10px;">เกิดข้อผิดพลาดในการโหลดประวัติครับ</div>`;
    }
}

//แก้ไขรายละเอียดประวัติการซื้อวัตถุดิบ 04-05-2026
function editHistoryItem(id) {
    // [จุดที่ต้องแก้]: เปลี่ยนจาก -text- เป็น -display- ให้ตรงกับ HTML
    const nameSpan = document.getElementById(`name-display-${id}`);
    const priceSpan = document.getElementById(`price-display-${id}`);
    
    // ตรวจสอบความปลอดภัยกัน Error อีกรอบ
    if (!nameSpan || !priceSpan) {
        console.error("หาไอดีไม่เจอครับพี่! เช็คสะกดใน HTML อีกทีนะ");
        return;
    }

    // เก็บค่าเดิม (ลบลูกน้ำออกด้วยเพื่อให้แก้ราคาที่เป็นตัวเลขได้เลย)
    const oldName = nameSpan.innerText;
    const oldPrice = priceSpan.innerText.replace(/,/g, '').replace('.-', '');

    // เปลี่ยนเป็น Input ให้พี่พิมพ์แก้ไขได้
    nameSpan.innerHTML = `<input type="text" id="edit-name-${id}" value="${oldName}" style="width: 100%; max-width: 150px; padding: 4px; border: 1px solid #ddd; border-radius: 4px;">`;
    
    priceSpan.innerHTML = `
        <input type="number" id="edit-price-${id}" value="${oldPrice}" style="width: 70px; padding: 4px; border: 1px solid #ddd; border-radius: 4px;"> 
        <button onclick="saveEdit(${id})" style="background: #27ae60; color: white; border: none; border-radius: 4px; padding: 5px 12px; margin-left: 5px; cursor: pointer;">ตกลง</button>
    `;
}

async function saveEdit(id) {
    const nameInput = document.getElementById(`edit-name-${id}`);
    const priceInput = document.getElementById(`edit-price-${id}`);

    if (!nameInput || !priceInput) return;

    const newName = nameInput.value;
    const newPrice = priceInput.value;

    try {
        // 1. อัปเดตข้อมูลในฐานข้อมูล Dexie
        await db.shopping_list.update(id, {
            name: newName,
            price: Number(newPrice)
        });

        console.log("✅ แก้ไขข้อมูลสำเร็จ");

        // 2. [จุดสำคัญ]: เรียกฟังก์ชันวาดหน้าจอใหม่ (ตามชื่อที่เจอในรูป)
        renderFullHistory(); 
        
        // 3. อัปเดตข้อมูลวิเคราะห์ราคาบน Dashboard (ถ้ามี)
        if (typeof updateDashboardPriceInsight === "function") {
            updateDashboardPriceInsight();
        }
        
    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดในการแก้ไข:", error);
        alert("ไม่สามารถบันทึกการแก้ไขได้ครับ");
    }
}

// คนส่งข้อมูล ประวัติวัตถุดิบ โชว์ Dashboard
async function updateDashboardPriceInsight() {
    const priceDisplay = document.getElementById('price-content');
    if (!priceDisplay) return;

    try {
        // 1. [การดึงข้อมูล]: ดึงรายการล่าสุดที่สถานะเป็น 'completed'
        // ใช้ .reverse().first() เพื่อหยิบเอา "ชิ้นล่าสุด" ที่เพิ่งบันทึกไปมาโชว์ทันที
        const lastItem = await db.shopping_list
            .where('status').equals('completed')
            .reverse()
            .first(); 

        if (lastItem) {
            // 2. [การจัดการชื่อ]: ตัดส่วนที่เป็นหน่วยหรือรายละเอียดในวงเล็บออก เพื่อให้ประหยัดพื้นที่บน Dashboard
            const shortName = lastItem.name ? lastItem.name.split(' (')[0] : "ไม่ระบุชื่อ";
            
            // 3. [การแสดงผล]: เน้นราคาให้ชัดเจน และโชว์ "วันที่+เวลา" ที่เราเพิ่งอัปเกรดเข้าไป
            priceDisplay.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 5px;">
                    <div style="color: #856404; font-weight: bold;">
                        ${shortName} ล่าสุด <span style="color: #e67e22; font-size: 1.1rem;">${Number(lastItem.price).toLocaleString()}.-</span>
                    </div>
                    <!-- เพิ่มปุ่มแว่นขยายตรงนี้ -->
                    <button onclick="showPriceHistory('${lastItem.name}')" 
                            style="background: #f39c12; color: white; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        🔍
                    </button>
                </div>
                <div style="color: #997404; font-size: 0.85rem; display: flex; align-items: center; gap: 4px;">
                    🕒 <small>ซื้อเมื่อ: ${lastItem.confirmed_date || lastItem.date || 'ไม่ระบุเวลา'}</small>
                </div>
            `;
        } else {
            // 4. [กรณีหน้าใหม่]: ถ้าเปิดแอปครั้งแรกแล้วยังไม่มีประวัติ
            priceDisplay.innerHTML = `
                <div style="color: #95a5a6; font-style: italic; padding: 5px;">
                    ยังไม่มีประวัติการซื้อครับยาย... <br>
                    <small>พอยายบันทึกราคา ข้อมูลจะมาโชว์ที่นี่ครับ</small>
                </div>
            `;
        }
    } catch (err) {
        console.error("Dashboard Insight Error:", err);
        priceDisplay.innerText = "รอข้อมูลสักครู่นะครับ...";
    }
}

function closeShoppingManager() {
    document.getElementById('shopping-manager-page').style.display = 'none';
}
// ==========================================
// วิเคราะห์ "ช่วงเวลาทำเงิน" 4-05-2026
// ==========================================

//นับว่าในแต่ละชั่วโมง (0-23) มีออเดอร์เข้าเท่าไหร่
async function getPeakSalesData() {
    const orders = await db.orders.toArray();
    // สร้าง Array 24 ช่อง (แทน 24 ชั่วโมง) เริ่มต้นที่ 0
    const hourlySales = new Array(24).fill(0);

    orders.forEach(order => {
        if (order.created_at) {
            const date = new Date(order.created_at);
            const hour = date.getHours(); // ดึงชั่วโมง (0-23)
            hourlySales[hour]++;
        }
    });

    return hourlySales;
}

//2. ส่วนการแสดงผล (UI)
async function renderPeakSalesChart() {
    const data = await getPeakSalesData();
    const maxSales = Math.max(...data); // หาชั่วโมงที่ขายดีที่สุดเพื่อตั้งเป็นเกณฑ์
    const chartContainer = document.getElementById('peak-sales-chart');
    
    if (!chartContainer) return;

    let html = `
        <div style="display: flex; align-items: flex-end; gap: 4px; height: 100px; padding: 10px 0; border-bottom: 2px solid #eee;">
    `;

    data.forEach((count, hour) => {
        // คำนวณความสูง (คิดเป็น %)
        const height = maxSales > 0 ? (count / maxSales) * 100 : 0;
        // ไฮไลท์สีส้มเข้มถ้าเป็นชั่วโมงที่ขายดีที่สุด
        const barColor = count === maxSales && maxSales > 0 ? '#e67e22' : '#bdc3c7';
        
        // แสดงเฉพาะชั่วโมงหลักๆ เพื่อไม่ให้แน่นเกินไป (เช่น 06, 12, 18)
        const label = [6, 12, 18, 21].includes(hour) ? `<span style="font-size: 8px;">${hour}</span>` : '';

        html += `
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;">
                <div style="width: 100%; height: ${height}%; background: ${barColor}; border-radius: 2px 2px 0 0;" title="${hour}:00 - ${count} ออเดอร์"></div>
                ${label}
            </div>
        `;
    });

    html += `</div>
        <div style="margin-top: 8px; font-size: 0.85rem; color: #7f8c8d; text-align: center;">
            🕒 ช่วงที่ยายขายดีที่สุดคือ: <b>${data.indexOf(maxSales)}:00 น.</b>
        </div>
    `;

    chartContainer.innerHTML = html;
}

// ==========================================
// ระบบ ความคุ่มค่า เห็นกำไร (Efficiency Score)  4-05-2026
// ==========================================

//Logic การคำนวณ
async function calculateEfficiencyScore() {
    // 1. ดึงยอดขายทั้งหมด
    const allOrders = await db.orders.toArray();
    const totalSales = allOrders.reduce((sum, order) => sum + (Number(order.total_price) || 0), 0);

    // 2. ดึงต้นทุนวัตถุดิบทั้งหมด (ที่บันทึกแล้ว)
    const allPurchases = await db.shopping_list.where('status').equals('completed').toArray();
    const totalInvest = allPurchases.reduce((sum, item) => sum + (Number(item.price) || 0), 0);

    if (totalInvest === 0) return 0; // ป้องกันการหารด้วยศูนย์

    // 3. คำนวณ Score (เป้าหมายคือยอดขายควรเป็น 3 เท่าของต้นทุนวัตถุดิบตามหลักร้านอาหาร)
    // สูตร: (ยอดขาย / (ต้นทุน * 3)) * 100
    let score = (totalSales / (totalInvest * 3)) * 100;
    
    return Math.min(Math.round(score), 100); // ไม่ให้เกิน 100 คะแนน
}

//ส่วนการแสดงผลบน Dashboard (UI)
async function renderEfficiencyDashboard(totalSales, totalInvest) {
    // เลือกจุดที่จะวาดข้อมูล (เปลี่ยนให้ตรงกับ ID ใหม่ที่เราตั้ง)
    const container = document.getElementById('efficiency-content-area');
    if (!container) return;

    if (totalInvest === 0) return;

    // คำนวณคะแนนเต็ม 10 ตามที่พี่เขียนไว้ในรูป
    let rawScore = (totalSales / (totalInvest * 3)) * 10;
    let scoreForShow = Math.min(Math.round(rawScore * 10) / 10, 10); // เช่น 3.5/10

    let statusText = "";
    let statusColor = scoreForShow >= 8 ? "#27ae60" : (scoreForShow >= 5 ? "#f1c40f" : "#e74c3c");

    if (scoreForShow >= 8) statusText = "สุดยอดครับยาย! บริหารเงินได้กริบมาก";
    else if (scoreForShow >= 5) statusText = "พอใช้ได้ครับยาย แต่ยังลดต้นทุนได้อีกนะ";
    else statusText = "ต้องระวังครับ! ช่วงนี้รายจ่ายสูงกว่ายอดขายนะ";

    // วาดข้อมูลใหม่ลงไปในกรอบเดิมที่พี่ทำไว้
    container.innerHTML = `
        <div style="text-align: center; font-size: 1.8rem; font-weight: 800; color: ${statusColor}; margin: 5px 0;">
            ${scoreForShow}/10
        </div>
        <div style="background: #eee; height: 8px; border-radius: 4px; margin-bottom: 10px;">
            <div style="background: ${statusColor}; width: ${scoreForShow * 10}%; height: 100%; border-radius: 4px; transition: width 0.8s;"></div>
        </div>
        <div style="font-size: 0.85rem; color: #555; font-style: italic; text-align: center;">
            ${statusText}
        </div>
    `;
}

// ==========================================
// [เพิ่มเติม] ระบบแสดงประวัติการขายล่าสุด (ฝังส่วนลด) 28-04-2026
// ==========================================
async function loadRecentOrders() {
    // 1. ตรวจสอบ ID ส่วนแสดงผล (ป้องกัน Error ถ้าหา Element ไม่เจอ)
    const historyContainer = document.getElementById('recent-orders-list'); 
    if (!historyContainer) return;

    try {
        // 2. ดึงข้อมูลจากฐานข้อมูล (ดึง 20 แถวเพื่อให้ครอบคลุมกรณี 1 ออเดอร์มีหลายรายการ)
        const rawOrders = await db.orders.orderBy('id').reverse().limit(20).toArray();
        
        // ถ้าไม่มีข้อมูล ให้โชว์ข้อความบอกผู้ใช้
        if (rawOrders.length === 0) {
            historyContainer.innerHTML = '<p style="text-align:center; color:#888; padding:20px;">ยังไม่มีประวัติการขายวันนี้</p>';
            return;
        }

        // 3. [ขั้นตอนการจัดกลุ่ม] รวมรายการที่ขายพร้อมกัน (order_id เดียวกัน) ให้อยู่ในกล่องเดียว
        const grouped = {};
        rawOrders.forEach(o => {
            if (!grouped[o.order_id]) {
                grouped[o.order_id] = {
                    time: new Date(o.created_at).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'}),
                    method: o.payment_method === 'Cash' ? 'เงินสด' : 'โอน',
                    items: [],      // เก็บรายชื่อเมนู
                    totalRaw: 0,   // เก็บราคารวมก่อนหักส่วนลด
                    discount: 0,   // เก็บค่าส่วนลดที่บันทึกไว้
                    fullData: o    // เก็บข้อมูลไว้อ้างอิงตอนสั่งพิมพ์ใหม่
                };
            }
            // สะสมชื่อเมนู และ ยอดรวมราคาเต็ม
            grouped[o.order_id].items.push(`${o.menu_name} x${o.qty}`);
            grouped[o.order_id].totalRaw += Number(o.total_price || 0);
            
            // 🔥 [จุดสำคัญ] ดึงค่าส่วนลดที่ Snapshot ไว้ใน Database มาใช้
            const d = Number(o.discount || 0);
            if (d > 0) {
                grouped[o.order_id].discount = d;
            }
        });

        // 4. แปลงจาก Object เป็น Array และตัดเอาเฉพาะ 10 ออเดอร์ล่าสุดมาโชว์
        const displayData = Object.values(grouped).slice(0, 10);

        // 5. [ส่วนการสร้างหน้าจอ] ปรับแต่ง HTML และใส่สีแยกประเภท
        historyContainer.innerHTML = `
            <h3 style="margin: 15px 0 10px 0; color: #2c3e50; font-size: 1.1rem;">รายการออเดอร์ล่าสุด</h3>
            ${displayData.map(order => {
                // คำนวณยอดที่ยายได้รับจริง (ราคาเต็ม - ส่วนลด)
                const discountValue = Number(order.discount || 0);
                const actualPaid = order.totalRaw - discountValue; 
                
                // ตรวจสอบเงื่อนไข: ออเดอร์นี้มีการลดราคามั้ย? (เพื่อใช้เลือกสี)
                const hasDiscount = discountValue > 0; 

                return `
                    <div style="background: white; padding: 12px; border-radius: 12px; margin-bottom: 10px; 
                                /* ถ้าลดให้ขอบสีส้ม ถ้าปกติให้ขอบสีเทา */
                                border: 2px solid ${hasDiscount ? '#e67e22' : '#eee'}; 
                                display: flex; justify-content: space-between; align-items: center; 
                                box-shadow: 0 2px 4px rgba(0,0,0,0.05); position: relative; overflow: hidden;">
                        
                        <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 8px; 
                                    background: ${hasDiscount ? '#e67e22' : '#27ae60'}; z-index: 1;"></div>

                        <div style="flex: 1; margin-left: 15px;">
                            <div style="font-weight: bold; color: #2c3e50; font-size: 1rem;">
                                ${order.items.join(', ')}
                            </div>
                            <small style="color: #888;">
                                🕒 ${order.time} | 💳 ${order.method} 
                                /* ถ้าลดราคา ให้ขึ้นป้ายกำกับบอกชัดๆ */
                                ${hasDiscount ? `<span style="color: #e67e22; font-weight: bold; margin-left: 5px;">[🔥 ลดราคา]</span>` : ''}
                            </small>
                        </div>
                        
                        <div style="text-align: right; min-width: 95px;">
                            <div style="font-size: 1.2rem; font-weight: bold; color: #27ae60;">
                                ${actualPaid.toLocaleString()}.-
                            </div>
                            
                            /* ส่วนที่แสดงเฉพาะเมื่อมีการลดราคา (ราคาเดิมขีดฆ่า) */
                            ${hasDiscount ? `
                                <div style="font-size: 0.8rem; color: #e67e22; line-height: 1.2; font-weight: bold;">
                                    <span style="text-decoration: line-through; color: #bbb; font-weight: normal;">${order.totalRaw}</span> 
                                    <br>
                                    ลดไป ${discountValue}.-
                                </div>
                            ` : `
                                <div style="font-size: 0.75rem; color: #ccc;">ราคาปกติ</div>
                            `}
                        </div>
                        
                        <button onclick='reprintByGroupId(${order.fullData.order_id})' 
                                style="margin-left: 15px; background: #f8f9fa; border: 1px solid #ddd; padding: 8px; border-radius: 8px; cursor: pointer; font-size: 1.2rem; z-index: 2;">
                            🧾
                        </button>
                    </div>
                `;
            }).join('')}
        `;

    } catch (err) {
        console.error("โหลดประวัติพลาด:", err);
        historyContainer.innerHTML = '<p style="color:red; text-align:center;">เกิดข้อผิดพลาดในการดึงข้อมูล</p>';
    }
}


// ฟังก์ชันเสริมสำหรับกดดูบิลเก่าจากหน้าประวัติ
function reprintReceipt(orderData) {
    // ส่งข้อมูลให้ showSmartReceipt ทำงาน
    // หมายเหตุ: orderData ในประวัติจะเป็นรายบรรทัด แต่ showSmartReceipt รับแบบกลุ่ม 
    // ถ้าอยากให้โชว์สวยๆ ต้องปรับข้อมูลนิดหน่อยครับ
    showSmartReceipt({
        order_id: orderData.order_id,
        items: [{ name: orderData.menu_name, price: orderData.total_price / orderData.qty, qty: orderData.qty, options: orderData.options }],
        total_price: orderData.total_price,
        discount: orderData.discount,
        payment_method: orderData.payment_method,
        created_at: orderData.created_at
    });
}

// ========================================================================
//ระบบความปลอดภัยเฉพาะจุด (PromptPay Focused Security)  30-04-2026
// ========================================================================
// ฟังก์ชันสำหรับบันทึกเลข PromptPay (ใช้ในหน้าตั้งค่า)
async function secureSavePromptPay() {
    const pp1 = document.getElementById('promptpay-input').value.trim();
    const pp2 = document.getElementById('promptpay-confirm').value.trim();

    // ตรวจสอบความถูกต้องเบื้องต้น
    if (pp1.length !== 10 && pp1.length !== 13) {
        alert("❌ เลข PromptPay ต้องมี 10 หรือ 13 หลักเท่านั้นครับ");
        return;
    }
    if (pp1 !== pp2) {
        alert("❌ เลขทั้งสองช่องไม่ตรงกัน ตรวจสอบอีกทีนะ");
        return;
    }

    // ด่านตรวจ PIN
    const adminSettings = await db.settings.get('admin_pin');
    
    // กรณีตั้งค่าครั้งแรก (ยังไม่มี PIN ในระบบ)
    if (!adminSettings) {
        const firstPin = prompt("🆕 ตั้งรหัส PIN 6 หลักเพื่อความปลอดภัยในการรับเงิน:");
        if (firstPin && firstPin.length === 6) {
            await db.settings.put({ key: 'admin_pin', value: firstPin });
            await performUpdate(pp1);
        } else {
            alert("❌ ต้องตั้งรหัส 6 หลักก่อนครับ");
        }
        return;
    }

    // กรณีมี PIN อยู่แล้ว
    const enteredPin = prompt("🔐 ใส่รหัส PIN 6 หลักเพื่อยืนยันการเปลี่ยนที่อยู่เงิน:");
    if (enteredPin === adminSettings.value) {
        await performUpdate(pp1);
    } else {
        // บันทึก Log กรณีใส่รหัสผิด (เจ้าของไปสืบต่อได้)
        await logSecurityEvent("FAILED_ATTEMPT", "มีคนพยายามเปลี่ยนเลขรับเงินแต่ใส่รหัสผิด");
        alert("❌ รหัสผิด! ไม่สามารถแก้ไขได้");
    }
}
//การจดจำบันทึกเลข promptpay 2-05-2026 
async function performUpdate(newNumber) {
    try {
        // --- 🛠️ จุดแก้ไขสำคัญ (Critical Fix) ---
        // เปลี่ยนจาก id เป็น key เพื่อให้ตรงกับ Schema: settings: 'key' ใน Version 9
        // และใช้ค่า 'promptpay' เพื่อให้หน้าใบเสร็จดึงไปใช้งานได้ถูกบ้าน
        await db.settings.put({ key: 'promptpay', value: newNumber });

        // บันทึก Log ความปลอดภัยแบบไม่มี Emoji (ป้องกันภาษาต่างดาวใน CSV)
        await logSecurityEvent("CHANGE_PROMPTPAY", "PromptPay updated to: " + newNumber);

        // แจ้งเตือนยืนยันกับคุณยาย
        alert("✅ บันทึกเลขรับเงิน (" + newNumber + ") เรียบร้อยแล้วครับ");

        // ปิดหน้าต่าง Modal อัตโนมัติ
        if (typeof closePromptPayModal === 'function') {
            closePromptPayModal();
        }

    } catch (err) {
        // ดักจับ Error หากมีการบันทึกพลาด (จะเห็น Error สีแดงน้อยลงแล้วครับ)
        console.error("จุดที่บันทึกพลาด:", err);
        alert("❌ บันทึกไม่สำเร็จ: " + err.message);
    }
}

// ฟังก์ชันบันทึกเหตุการณ์ความปลอดภัย (ลง Dexie) 30-04-2026
/**
 * ฟังก์ชันบันทึกเหตุการณ์ด้านความปลอดภัย
 * @param {string} event - ชื่อเหตุการณ์ (เช่น 'CHANGE_PROMPTPAY', 'FAILED_PIN')
 * @param {string} note - ข้อความแจ้งเตือนที่จะไปโชว์ใน CSV
 */
async function logSecurityEvent(event, note) {
    try {
        // 1. ตรวจสอบว่าตาราง security_logs พร้อมใช้งานหรือไม่
        // ป้องกัน Error "reading 'add' of undefined" ที่เจอในรูป 75.jpg
        if (!db.security_logs) {
            console.error("❌ ระบบฐานข้อมูล Log ยังไม่พร้อมใช้งาน");
            return;
        }

        // 2. บันทึกข้อมูลลง Dexie
        await db.security_logs.add({
            timestamp: new Date().toISOString(), // เวลามาตรฐาน (ISO) สำหรับจัดเรียง
            dateOnly: new Date().toLocaleDateString('th-TH'), // วันที่แบบไทย สำหรับฟิลเตอร์ลง CSV รายวัน
            event: event,
            note: note
        });

        // 3. (Optional) Log ลง Console เพื่อให้เพื่อนตรวจสอบตอน Dev ได้ง่าย
        console.log(`🔒 [Security Log]: ${event} - ${note}`);

    } catch (err) {
        // 4. ดักจับข้อผิดพลาดกรณีฐานข้อมูลมีปัญหา เพื่อไม่ให้แอป "ค้าง"
        console.error("❌ ไม่สามารถบันทึก Log ความปลอดภัยได้:", err);
    }
}

// เปิด Modal
function openPromptPayModal() {
    document.getElementById('ppModal').style.display = 'block';
}

// ปิด Modal
function closePromptPayModal() {
    document.getElementById('ppModal').style.display = 'none';
    // ล้างค่าที่กรอกค้างไว้เพื่อความปลอดภัย
    document.getElementById('promptpay-input').value = '';
    document.getElementById('promptpay-confirm').value = '';
    checkMatch(); 
}

// ตรวจสอบความถูกต้องแบบ Real-time (เหมือนที่คุยกันไว้)
function checkMatch() {
    const p1 = document.getElementById('promptpay-input').value.trim();
    const p2 = document.getElementById('promptpay-confirm').value.trim();
    const btn = document.getElementById('save-btn');
    
    // เงื่อนไข: ต้องตรงกัน และมีความยาว 10 หรือ 13 เท่านั้น
    const isValidLength = (p1.length === 10 || p1.length === 13);
    
    if (p1 === p2 && isValidLength) {
        btn.style.backgroundColor = "#27ae60"; // สีเขียว
        btn.disabled = false;
    } else {
        btn.style.backgroundColor = "#ccc"; // สีเทา
        btn.disabled = true;
    }
}

//ระบบ ยกเลิกตั้งค่า  Promptpay 30-04-2026
async function clearSecurityData() {
    try {
        const adminSettings = await db.settings.get('admin_pin');

        if (!adminSettings || !adminSettings.value) {
            alert("⚠️ ระบบยังไม่ได้ตั้งรหัส PIN อยู่แล้วครับ");
            return;
        }

        const enteredPin = prompt("🔐 กรุณาใส่รหัส PIN 6 หลักเพื่อยืนยันการล้างระบบความปลอดภัย:");

        if (enteredPin === adminSettings.value) {
            const finalConfirm = confirm("⚠️ รหัสถูกต้อง! คุณแน่ใจนะว่าจะล้างเลข PromptPay และ PIN ให้เป็นค่าว่าง?");
            
            if (finalConfirm) {
                await db.settings.delete('admin_pin');
                await db.settings.delete('promptpay_no');

                // บันทึก Log ไว้เป็นหลักฐาน
                await logSecurityEvent("MANUAL_RESET_WITH_PIN", "ผู้ใช้ยืนยันด้วย PIN เพื่อล้างระบบความปลอดภัยทั้งหมด");

                alert("✅ ล้างข้อมูลสำเร็จ! ระบบกลับสู่ค่าเริ่มต้นเรียบร้อยครับ");
                location.reload(); 
            }
        } else {
            alert("❌ รหัส PIN ไม่ถูกต้อง!");
            await logSecurityEvent("FAILED_RESET_ATTEMPT", "มีการพยายามล้างระบบแต่ใส่ PIN ผิด");
        }
    } catch (err) {
        console.error("❌ Reset Error:", err);
    }
}



// ==========================================
// กล่องที่ 6: ระบบจัดการฐานข้อมูล (Backup, Restore, Export)  ปรับแก้ 25-04-2026
// ==========================================

// 1. ฟังก์ชันสำรองข้อมูล (Backup) - ออกมาเป็นไฟล์ .json
async function backupDatabase() {
    try {
        const orders = await db.orders.toArray();
        const dailysummary = await db.dailysummary.toArray();
        const menus = await db.menus.toArray();
        const extra_options = await db.extra_options.toArray();
        const settings = {
            shopName: localStorage.getItem('shopName'),
            shopMenu: localStorage.getItem('shopMenu'),
            quickMenus: localStorage.getItem('quickMenus'),
            counterLabel: localStorage.getItem('counterLabel'),
            counterUnit: localStorage.getItem('counterUnit'),
            myDailyCost: localStorage.getItem('myDailyCost')
        };

        const backupData = {
            orders,
            dailysummary,
            menus,
            extra_options,
            settings,
            backup_date: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Backup_GrandmaPOS_${new Date().toLocaleDateString('th-TH')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (err) {
        alert("❌ สำรองข้อมูลไม่สำเร็จ: " + err.message);
    }
}

// 2. ฟังก์ชันนำเข้าข้อมูล (Restore) - ฉบับปรับปรุงดัก Error รายส่วน 04-05-2026
async function restoreDatabase(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (confirm("⚠️ การนำเข้าข้อมูลจะเขียนทับข้อมูลปัจจุบันทั้งหมด ยืนยันไหมครับยาย?")) {
                
                // --- ขั้นตอนที่ 1: ล้างข้อมูลเก่าออกให้หมด ---
                try {
                    await Promise.all([
                        db.orders.clear(),
                        db.dailysummary.clear(),
                        db.menus.clear(),
                        db.extra_options.clear()
                    ]);
                } catch (err) {
                    throw new Error("ล้างข้อมูลเก่าไม่สำเร็จ: " + err.message);
                }

                // --- ขั้นตอนที่ 2: ทยอยนำเข้าข้อมูลใหม่ทีละส่วน (พร้อมดัก Error) ---
                
                // นำเข้าข้อมูลออเดอร์
                if (data.orders && data.orders.length > 0) {
                    try {
                        await db.orders.bulkAdd(data.orders);
                    } catch (err) {
                        console.error("Error Restore Orders:", err);
                        alert("❌ พบปัญหาที่ข้อมูล 'รายการขาย': " + err.message);
                    }
                }

                // นำเข้าข้อมูลสรุปรายวัน
                if (data.dailysummary && data.dailysummary.length > 0) {
                    try {
                        await db.dailysummary.bulkAdd(data.dailysummary);
                    } catch (err) {
                        alert("❌ พบปัญหาที่ข้อมูล 'สรุปรายวัน': " + err.message);
                    }
                }

                // นำเข้าข้อมูลเมนู
                if (data.menus && data.menus.length > 0) {
                    try {
                        await db.menus.bulkAdd(data.menus);
                    } catch (err) {
                        alert("❌ พบปัญหาที่ข้อมูล 'เมนูอาหาร': " + err.message);
                    }
                }

                // นำเข้าตัวเลือกเสริม
                if (data.extra_options && data.extra_options.length > 0) {
                    try {
                        await db.extra_options.bulkAdd(data.extra_options);
                    } catch (err) {
                        alert("❌ พบปัญหาที่ข้อมูล 'ตัวเลือกเสริม': " + err.message);
                    }
                }

                // --- ขั้นตอนที่ 3: คืนค่าการตั้งค่า (LocalStorage) ---
                if (data.settings) {
                    try {
                        Object.keys(data.settings).forEach(key => {
                            if (data.settings[key] !== null) {
                                localStorage.setItem(key, data.settings[key]);
                            }
                        });
                    } catch (err) {
                        alert("❌ พบปัญหาการตั้งค่าชื่อร้าน/ต้นทุน: " + err.message);
                    }
                }

                alert("✅ นำเข้าข้อมูลเสร็จสิ้น! ระบบจะเริ่มการทำงานใหม่ครับ");
                location.reload();
            }
        } catch (err) {
            alert("❌ รูปแบบไฟล์ไม่ถูกต้อง: " + err.message);
        }
    };
    reader.readAsText(file);
}

// 3. ฟังก์ชันส่งออกยอดขายเป็น CSV (สำหรับเปิดใน Excel) 30-04-2026
async function exportToCSV() {
    try {
        const orders = await db.orders.toArray();
        if (orders.length === 0) return alert("ไม่มีข้อมูลยอดขายให้ส่งออก");

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const todayLocale = now.toLocaleDateString('th-TH');
        
        let securityLogs = [];
        if (db.security_logs) {
            securityLogs = await db.security_logs
                .where('dateOnly').equals(todayLocale).toArray();
        }

        // --- 1. การคำนวณสรุปยอด (คงเดิมของคุณยาย) ---
        // ... (ส่วนคำนวณยอด summary วัน/สัปดาห์/เดือน/ปี คงไว้ตามเดิม) ...
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const startOfWeek = new Date(now);
        const day = now.getDay();
        const diff = now.getDate() - (day === 0 ? 6 : day - 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);

        let summary = {
            today: { total: 0, cash: 0, transfer: 0 },
            week: { total: 0, cash: 0, transfer: 0 },
            month: { total: 0, cash: 0, transfer: 0 },
            year: { total: 0, cash: 0, transfer: 0 }
        };

        orders.forEach(o => {
            const rawPrice = parseFloat(o.total_price) || 0;
            const discount = parseFloat(o.discount) || 0;
            const actualPrice = rawPrice - discount;
            const method = (o.payment_method || "").toString().trim().toLowerCase();
            const isCash = method === "cash" || method.includes("เงินสด");
            const datePart = (o.created_at || "").split(' ')[0];
            const oDate = new Date(datePart);

            if (!isNaN(oDate.getTime())) {
                if (datePart === todayStr) {
                    summary.today.total += actualPrice;
                    isCash ? summary.today.cash += actualPrice : summary.today.transfer += actualPrice;
                }
                if (oDate.getFullYear() === currentYear) {
                    summary.year.total += actualPrice;
                    isCash ? summary.year.cash += actualPrice : summary.year.transfer += actualPrice;
                    if (oDate.getMonth() === currentMonth) {
                        summary.month.total += actualPrice;
                        isCash ? summary.month.cash += actualPrice : summary.month.transfer += actualPrice;
                    }
                }
                if (oDate >= startOfWeek && oDate <= now) {
                    summary.week.total += actualPrice;
                    isCash ? summary.week.cash += actualPrice : summary.week.transfer += actualPrice;
                }
            }
        });

        // --- 2. การสร้างเนื้อหา CSV (หัวใจสำคัญคือ \ufeff) ---
        // เราจะเก็บข้อมูลไว้ในตัวแปรแบบข้อความธรรมดาก่อน
        let csvContent = ""; 

     // 2.1: รายงานความปลอดภัย (ปรับให้มือถืออ่านง่ายขึ้น)
        if (securityLogs.length > 0) {
            // ตัด Emoji ออก หรือใช้คำว่า [!] แทน เพื่อลดความเสี่ยงภาษาเพี้ยนในมือถือ
            csvContent += "!!! [SECURITY REPORT] !!!,,,,,,,\n"; 
            securityLogs.forEach(log => {
                // 1. ล้างตัวอักษรพิเศษใน log.note (ถ้ามี)
                const safeNote = (log.note || '').replace(/[\r\n",]/g, " ").trim();
                
                // 2. ใช้เวลาแบบมาตรฐาน (ISO) หรือจัดการ String ให้สะอาด
                const logTime = new Date(log.timestamp).toLocaleTimeString('th-TH').replace(/ /g, "");
                
                // 3. จัดโครงสร้างให้เรียบง่ายที่สุด
                csvContent += `ALERT,${log.event},"${safeNote}",Time: ${logTime},,,,\n`;
            });
            csvContent += ",,,,,,,\n"; 
        }

        // 2.2: สรุปยอด
        csvContent += "รายการสรุปยอด (คำนวณจากยอดรับสุทธิ),,,,,,,\n";
        csvContent += "ช่วงเวลา,ยอดสุทธิ (บาท),เงินสด,เงินโอน,,,,\n";
        csvContent += `วันนี้,${summary.today.total.toFixed(2)},${summary.today.cash.toFixed(2)},${summary.today.transfer.toFixed(2)},,,,\n`;
        csvContent += `สัปดาห์นี้,${summary.week.total.toFixed(2)},${summary.week.cash.toFixed(2)},${summary.week.transfer.toFixed(2)},,,,\n`;
        csvContent += `เดือนนี้,${summary.month.total.toFixed(2)},${summary.month.cash.toFixed(2)},${summary.month.transfer.toFixed(2)},,,,\n`;
        csvContent += `ปีนี้,${summary.year.total.toFixed(2)},${summary.year.cash.toFixed(2)},${summary.year.transfer.toFixed(2)},,,,\n\n`;

        // 2.3: รายละเอียดออเดอร์
        csvContent += "รายละเอียดออเดอร์,,,,,,,\n";
        csvContent += "วัน-เวลา,ชื่อเมนู,ส่วนเพิ่มเติม,จำนวน,ราคาเต็ม,ส่วนลด,ยอดรับจริง,วิธีชำระเงิน\n";

        let lastDateSeen = "";
        orders.forEach(o => {
            const datePart = (o.created_at || "").split(' ')[0];
            if (lastDateSeen !== "" && lastDateSeen !== datePart) {
                csvContent += "\n"; 
            }
            const rawPrice = parseFloat(o.total_price) || 0;
            const discount = parseFloat(o.discount) || 0;
            const netPaid = rawPrice - discount;
            csvContent += `${o.created_at},"${o.menu_name}","${o.options || ''}",${o.qty || 1},${rawPrice},${discount},${netPaid},"${o.payment_method}"\n`;
            lastDateSeen = datePart;
        });

// --- 3. 🔥 จุดที่แก้ไขเพื่อให้เปิดในมือถือ/แท็บเล็ตได้ทันที ---
        
        // 3.1 สร้างรหัส BOM (รหัสลับระบุภาษาไทย UTF-8)
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);

        // 3.2 แปลงข้อความ csvContent ทั้งหมดให้เป็น "รหัสตัวเลข" (Uint8Array)
        // ขั้นตอนนี้สำคัญมาก เพราะจะทำให้ข้อมูลไม่ถูกบิดเบือนโดยเบราว์เซอร์
        const encoder = new TextEncoder();
        const csvUint8 = encoder.encode(csvContent);

        // 3.3 นำ BOM และ ข้อมูลที่แปลงแล้ว มา "ต่อกาว" รวมกันเป็นก้อนเดียว
        // เราจะสร้างอาเรย์ใหม่ที่มีขนาดเท่ากับ (BOM + เนื้อหา)
        const combinedArray = new Uint8Array(bom.length + csvUint8.length);
        combinedArray.set(bom); // ใส่รหัสลับไว้หน้าสุด
        combinedArray.set(csvUint8, bom.length); // ต่อท้ายด้วยเนื้อหาภาษาไทย

        // 3.4 สร้างไฟล์ Blob จาก "ก้อนข้อมูลตัวเลข" ที่รวมกันแล้ว
        // เราจะไม่ใช้ csvContent (ที่เป็นข้อความ) อีกต่อไป แต่จะใช้ combinedArray แทน
        const blob = new Blob([combinedArray], { type: "text/csv;charset=utf-8" });
        
        // --- 4. สั่งดาวน์โหลด (ส่วนนี้เหมือนเดิมของคุณยายครับ) ---
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `รายงานยอดขาย_${todayStr}.csv`;
        document.body.appendChild(a); 
        a.click();
        document.body.removeChild(a); 
        URL.revokeObjectURL(url);

    } catch (err) {
        console.error("CSV Export Error:", err);
        alert("❌ ข้อผิดพลาดในการส่งออก: " + err.message);
    }
}

//******************************************************************************************************************************************************************************************* */
// ฟังก์ชันปิดหน้าใบเสร็จ 26-04-2026
function closeReceipt() {
    document.getElementById('receipt-modal').style.display = 'none';
    document.getElementById('qrcode').innerHTML = ''; // ล้าง QR เก่า
}

// ฟังก์ชัน "วาด" ใบเสร็จ (ใช้ทั้งตอนขายเสร็จ และตอนดึงย้อนหลัง) 27-04-2026
// --- วางแทนฟังก์ชันเดิมที่มีซ้ำกันทั้งหมด ---


// ฟังก์ชันดึงข้อมูลย้อนหลัง (เรียกจากหน้า Dashboard หรือหน้าประวัติ)
async function getOrderAndShowReceipt(orderId) {
    const order = await db.orders.get(orderId);
    if(order) {
        showSmartReceipt(order);
    } else {
        alert("ไม่พบข้อมูลออเดอร์นี้");
    }
}

//ฟังก์ชันนี้จะดึงออเดอร์จาก db.orders (Dexie) มาโชว์แบบเรียงตามเวลาล่าสุด 28-04-2026
async function loadRecentOrders() {
    const tableBody = document.getElementById('recent-orders-body');
    if (!tableBody) return;

    try {
        const todayStr = new Date().toLocaleDateString('sv-SE');
        
        // 1. ดึงข้อมูลของวันนี้ทั้งหมด
        const allOrders = await db.orders
            .where('created_at')
            .startsWith(todayStr)
            .toArray();

        // 2. รวมร่างรายการที่ order_id เดียวกัน (Logic ใหม่: ป้องกันส่วนลดซ้ำซ้อน)
        const groupedOrders = {};
        allOrders.forEach(order => {
            const gid = order.order_id || order.id; 
            if (!groupedOrders[gid]) {
                groupedOrders[gid] = {
                    order_id: gid,
                    time: order.created_at.includes(' ') ? order.created_at.split(' ')[1].substring(0, 5) : "00:00",
                    itemList: [],
                    totalNet: 0,       // ยอดสุทธิ (รวมบวกและลบมาแล้ว)
                    totalDiscount: 0 
                };
            }

            // ถ้าไม่ใช่บรรทัดส่วนลด (ราคาเป็นบวก) ให้เพิ่มชื่อเมนู
            if (order.total_price > 0) {
                groupedOrders[gid].itemList.push(`${order.menu_name}${order.qty > 1 ? ' x' + order.qty : ''}`);
            }
            
            // รวมยอดเงิน (60 บวกกับ -10 จะได้ 50 ทันที)
            groupedOrders[gid].totalNet += Number(order.total_price || 0);
            
            // เก็บยอดส่วนลดไว้โชว์สวยๆ เท่านั้น
            if (order.discount > 0) {
                groupedOrders[gid].totalDiscount += Number(order.discount || 0);
            }
        });

        // 🚩 3. บรรทัดที่พี่ขาดไปจนทำให้ Error: เรียงจากใหม่ไปเก่า (10 บิลล่าสุด)
        const displayOrders = Object.values(groupedOrders).reverse().slice(0, 10);

        // 4. วาดตารางแสดงผล
        tableBody.innerHTML = displayOrders.length ? '' : '<tr><td colspan="4" style="text-align:center; padding:20px;">ยังไม่มีรายการของวันนี้</td></tr>';

        displayOrders.forEach(group => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = "1px solid #eee";
            tr.innerHTML = `
                <td style="padding:10px;">${group.time}</td>
                <td style="padding:10px; font-size:0.9rem;">
                    ${group.itemList.join(', ')}
                    ${group.totalDiscount > 0 ? `<br><small style="color:#e67e22;">(ส่วนลด ${group.totalDiscount}.-)</small>` : ''}
                </td>
                <td style="padding:10px; text-align:right;">
                    <b>${group.totalNet.toLocaleString()}.-</b>
                </td>
                <td style="padding:10px; text-align:center;">
                    <button onclick="reprintByGroupId(${group.order_id})" style="border:none; background:none; cursor:pointer; font-size:1.2rem;">🧾</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    } catch (err) {
        console.error("โหลดประวัติพลาด:", err);
    }
}

//ดึง "ทั้งชุด" มาโชว์ในใบเสร็จ 27-04-2026
async function reprintByGroupId(orderId) {
    // 1. ดึงทุกรายการที่มี order_id เดียวกันออกมา
    const orders = await db.orders.where('order_id').equals(orderId).toArray();
    
    if (orders.length > 0) {
        // --- [จุดสำคัญ: ดึงส่วนลดที่ฝังไว้] ---
        // เราหาดูว่าในกลุ่มนี้ มีบรรทัดไหนที่มี discount (ปกติจะอยู่ที่รายการแรก)
        const discountEntry = orders.find(o => o.discount > 0);
        const savedDiscount = discountEntry ? Number(discountEntry.discount) : 0;

        const data = {
            order_id: orderId, // ใส่ ID ไว้ด้วยเพื่อความชัดเจน
            items: orders.map(o => ({ 
                name: o.menu_name, 
                price: o.total_price / o.qty, 
                qty: o.qty, 
                options: o.options 
            })),
            // 2. คำนวณยอดรวมราคาเต็ม
            total_price: orders.reduce((sum, o) => sum + Number(o.total_price), 0),
            
            // 3. 🔥 ส่งส่วนลดที่หาเจอลงไปใน data ด้วย เพื่อให้ showSmartReceipt เอาไปหักลบ
            discount: savedDiscount, 
            
            payment_method: orders[0].payment_method,
            created_at: orders[0].created_at
        };

        // 4. ส่งข้อมูลที่ "หักลบเลขถูกต้องแล้ว" ไปโชว์ใบเสร็จ
        showSmartReceipt(data);
    }
}

// ฟังก์ชันเสริมสำหรับกดดูใบเสร็จย้อนหลัง 26-04-2026
function reprintReceipt(order) {
    const receiptData = {
        items: [{name: order.menu_name, price: order.total_price/order.qty, qty: order.qty, options: order.options}],
        total_price: order.total_price,
        payment_method: order.payment_method,
        created_at: order.created_at
    };
    showSmartReceipt(receiptData);
}

// ฟังก์ชันปิดใบเสร็จ (นายเขียนไว้แล้ว เอามาวางคู่กัน)
function closeReceipt() {
    document.getElementById('receipt-modal').style.display = 'none';
    const qrArea = document.getElementById('qrcode');
    if (qrArea) qrArea.innerHTML = ''; 
}

// ==========================================
// กล่องที่ 7: ระบบใบเสร็จฉลาด (Smart Receipt & QR) - เติม 2-05-2026
// ==========================================
async function showSmartReceipt(data) {
    const modal = document.getElementById('receipt-modal');
    if (!modal) return;

    // --- 1. เตรียมข้อมูลราคา (ยึดตามที่บันทึกจริง) ---
    const discountAmount = parseFloat(data.discount) || 0;
    
    // 🚩 หัวใจสำคัญ: ถ้าเป็นออเดอร์ย้อนหลัง ให้ดึง total_price ที่บันทึกไว้มาเลย (ไม่ต้องคำนวณใหม่ให้เสี่ยงพลาด)
    let finalTotal = parseFloat(data.total_price) || 0;

    // ถ้าบังเอิญยอดที่ดึงมามันยังไม่ได้หักส่วนลด (กรณีออเดอร์เก่ามาก) 
    // เราจะเช็กจาก log console ของพี่ ถ้าบันทึก 50 คือจบ แต่ถ้าบันทึก 60 เราถึงค่อยสั่งลบ
    if (data.items && data.items.length > 0) {
        const hasDiscountInItems = data.items.some(item => (parseFloat(item.total_price) || 0) < 0);
        // ถ้าใน items ไม่มีบรรทัดติดลบ แต่มีค่า discount ในหัวบิล ค่อยเอามาลบออก
        if (!hasDiscountInItems && finalTotal === (data.items[0].price * data.items[0].qty)) {
             finalTotal = finalTotal - discountAmount;
        }
    }

    if (finalTotal < 0) finalTotal = 0;

    const storeData = await db.settings.get('store_name');
    const ppData = await db.settings.get('promptpay');
    const shopName = storeData ? storeData.value : (localStorage.getItem('shopName') || "ร้านยายขายทุกอย่าง");
    
    // --- 2. ใส่หัวใบเสร็จ ---
    document.getElementById('r-shop-name').innerText = shopName;
    document.getElementById('r-date').innerText = "วันที่: " + new Date(data.created_at).toLocaleString('th-TH');
    
    // --- 3. รายการอาหาร (กรองเอาเฉพาะของกิน ไม่เอาบรรทัดส่วนลดมาโชว์ซ้ำ) ---
    const itemsContainer = document.getElementById('r-items');
    const foodItems = data.items.filter(item => {
        const p = parseFloat(item.total_price) || parseFloat(item.price) || 0;
        return p > 0; // เอาเฉพาะรายการที่ราคาเป็นบวก
    });

    itemsContainer.innerHTML = foodItems.map(item => {
        const displayName = item.menu_name || item.name || "รายการอาหาร";
        const displayPrice = parseFloat(item.total_price) || (parseFloat(item.price) * (item.qty || 1)) || 0;
        return `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px dashed #eee; padding-bottom: 5px;">
                <span>${displayName} ${item.options ? '<br><small style="color:gray;">('+item.options+')</small>' : ''}</span>
                <span>x${item.qty || 1} ${displayPrice.toLocaleString()}.-</span>
            </div>
        `;
    }).join('');
    
    // ยอดรวมสุทธิต้องเด่นและถูกต้อง
    document.getElementById('r-total').innerText = `รวมทั้งสิ้น: ${finalTotal.toLocaleString()}.-`;
    
    // --- 4. วิธีชำระเงินและส่วนลด (โชว์เพื่อให้รู้ว่าหักอะไรไป) ---
    const method = String(data.payment_method || "").toLowerCase();
    let isQR = (method === 'qr' || method === 'transfer'); 
    let paymentHTML = "วิธีชำระ: " + (isQR ? '📱 เงินโอน/QR' : '💵 เงินสด');
    
    if (discountAmount > 0) {
        paymentHTML = `<div style="color:#e67e22; font-weight:bold; margin-bottom:4px;">🔥 ส่วนลดท้ายบิล: -${discountAmount.toLocaleString()}.-</div>` + paymentHTML;
    }
    document.getElementById('r-payment').innerHTML = paymentHTML;
    
    // --- 5. จัดการส่วน QR Code (รองรับโหมด Offline แบบสมบูรณ์ 05-05-2026) ---
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = ""; // ล้างหน้าจอดก่อนวาดใหม่

    if (isQR) {
        const promptpayNumber = ppData ? ppData.value : null;
        if (promptpayNumber) {
            const cleanNumber = promptpayNumber.replace(/[^0-9]/g, "").trim();
            const qrAmount = finalTotal;

            // 🚩 ตรวจสอบสถานะ Online/Offline
            if (navigator.onLine) {
                // [โหมดออนไลน์] ดึงรูปจาก API (เร็วและชัวร์ถ้ามีเน็ต)
                qrContainer.innerHTML = `
                <div style="background: white; padding: 10px; border-radius: 10px; display: inline-block; border: 1px solid #eee;">
                    <img src="https://promptpay.io/${cleanNumber}/${qrAmount}.png"
                        style="width:200px; height:200px; display:block;">
                    <p style="margin-top:8px; font-size:0.85rem; color:#1a237e; font-weight:bold;">
                    ${cleanNumber}<br>
                    <span style="color:#27ae60;">ยอดเงิน: ${qrAmount.toLocaleString()}บาท</span>
                    </p>    
                </div>`;
            } else {
                // [โหมดออฟไลน์] 🚩 เรียกใช้ไฟล์ Local ที่พี่เตรียมไว้
                // ตรวจสอบว่าไฟล์ qrcode.min.js (QRCode) และ promptpay-qr-local.js (promptpayQr) โหลดมาหรือยัง
                if (typeof QRCode !== 'undefined' && window.promptpayQr) {
                    try {
                        // 1. ใช้ promptpay-qr-local.js สร้างรหัส Payload
                        const payload = window.promptpayQr.generatePayload(cleanNumber,{ amount: qrAmount });

                        // 2. สร้าง Element สำหรับวาง QR
                        const qrBox = document.createElement('div');
                        qrBox.style.cssText = "background: white; padding: 10px; border-radius: 10px; display: inline-block;";
                        qrContainer.appendChild(qrBox);

                        // 3. ใช้ qrcode.min.js วาดรูป QR Code จาก Payload
                        new QRCode(qrBox, {
                            text: payload,
                            width: 200,
                            height: 200,
                            colorDark: "#000000",
                            colorLight: "#ffffff",
                            correctLevel: QRCode.correctLevel.M 
                        });

                        // เพิ่มคำแนะนำใต้ QR
                        qrContainer.innerHTML += `
                        <p style="margin-top:8px; font-size:0.85rem; color:#e67e22; font-weight:bold;">
                            ⚠️ โหมด Offline (สแกนได้ปกติ)<br>
                            <span style="color:#1a237e;">${cleanNumber}</span>
                        </p>`;
                    } catch (err) {
                        console.error("QR Local Error:", err);
                        showOfflineText(qrContainer, cleanNumber, qrAmount);
                    }
                } else {
                    // 🚩 ถ้าไฟล์ .js ไม่โหลด หรือไม่มี Library ให้โชว์ข้อความกรอบส้มที่พี่ต้องการ
                    showOfflineText(qrContainer, cleanNumber, qrAmount);
                }
            }
        } else {
                qrContainer.innerHTML = "<p style='color:red;'>ยังไม่ได้ตั้งค่าเลข PromptPay</p>";
            }
        } else {
            qrContainer.innerHTML = `<div style="font-size: 3rem; color: #2ecc71; margin: 10px 0;">✅</div><p>ขอบคุณที่ชำระเงินสดครับ</p>`;
        }

     modal.style.display = 'flex';
 }
    

// 🚩 อย่าลืมก๊อปปี้ฟังก์ชันเสริมนี้ไปวางไว้ "นอก" ฟังก์ชันหลักด้วยนะครับ 04-05-2026
function showOfflineText(container, number, amount) {
    container.innerHTML = `
        <div style="background: #fff9f0; padding: 15px; border: 2px dashed #e67e22; border-radius: 10px;">
            <p style="color: #d35400; font-weight: bold; margin-bottom: 10px;">⚠️ ตอนนี้ระบบ Offline</p>
            <p style="font-size: 0.9rem; margin-bottom: 5px;">โอนเงิน PromptPay ตามเลขนี้ได้เลยครับ:</p>
            <h2 style="color: #1a237e; letter-spacing: 2px; margin: 10px 0;">${number}</h2>
            <p style="font-size: 1.1rem; color: #27ae60; font-weight: bold;">ยอดโอน: ${amount.toLocaleString()} บาท</p>
            <p style="font-size: 0.7rem; color: #999; margin-top: 10px;">*สแกน QR ไม่ได้เนื่องจากไม่ได้โหลดไฟล์เสริม</p>
        </div>
    `;
}

function closeReceipt() {
    document.getElementById('receipt-modal').style.display = 'none';
}

// ฟังก์ชันดูใบเสร็จย้อนหลัง
async function reprintReceipt(id) {
    const order = await db.orders.get(id);
    if (order) {
        // แปลงข้อมูลให้เข้ากับรูปแบบ showSmartReceipt
        const data = {
            items: [{ 
                name: order.menu_name, 
                price: order.total_price / order.qty, 
                qty: order.qty, 
                options: order.options 
            }],
            total_price: order.total_price,
            payment_method: order.payment_method,
            created_at: order.created_at
        };
        showSmartReceipt(data);
    }
}

// ฟังก์ชันดึงข้อมูลจากปุ่มประวัติมาโชว์ใบเสร็จ
async function getOrderAndShowReceipt(id) {
    const order = await db.orders.get(id);
    if (order) {
        showSmartReceipt(order);
    }
}
// คำสั่ง ตั้งค่า เงินโอนเข้าบัญชี ผ่าน QR 30-04-2026
async function saveSettings() {
    // --- 1. สแกนและดึงค่าจากหน้าจอ (ดักจับทุก Element) ---
    const elPromptPay = document.getElementById('set_promptpay');
    const elDiscountInput = document.getElementById('set_discount');
    const elTypeSelect = document.getElementById('discount_type'); // Dropdown เจ้าปัญหา

    const pp = elPromptPay.value.trim();
    const rawValue = elDiscountInput.value.trim();
    const selectedMode = elTypeSelect.value; // 'percent' หรือ 'amount'

    try {
        // --- 2. ส่วนบันทึก PromptPay ---
        if (pp !== "") {
            await db.settings.put({ key: 'promptpay', value: pp });
            localStorage.setItem('promptpay_number', pp);
        }

        // --- 3. ส่วนบันทึกส่วนลด (จุดที่ต้องแก้ให้ตาสว่าง) ---
        let finalDiscountToSave = "0";
        let numValue = parseFloat(rawValue) || 0;

        if (numValue > 0) {
            // 🔥 บังคับเช็ค: ถ้า Dropdown เป็น percent ต้องใส่ % ต่อท้ายเท่านั้น!
            if (selectedMode === 'percent') {
                finalDiscountToSave = numValue.toString() + "%";
            } else {
                finalDiscountToSave = numValue.toString();
            }
        }

        // บันทึกลงระบบ
        await db.settings.put({ key: 'default_discount', value: finalDiscountToSave });
        localStorage.setItem('default_discount', finalDiscountToSave);
        
        // แจ้งเตือนใน Console (เช็ค % ให้เห็นกับตา)
        const isPercent = finalDiscountToSave.includes('%');
        console.log(`🎯 บันทึกส่วนลดสำเร็จ: ${finalDiscountToSave} (${isPercent ? 'โหมดเปอร์เซ็นต์' : 'โหมดบาท'})`);

        // --- 4. ปิดหน้าตั้งค่าและจัดการ Navigation ---
        if (window.location.hash === '#settings') {
            history.back(); 
        }
        document.getElementById('front-page').style.display = 'block';
        document.getElementById('back-page').style.display = 'none';
        
        // --- 5. อัปเดตหน้าจอขายให้เป็นปัจจุบัน ---
        renderOrderButtons();  
        renderExtraOptions();  
        
        // สั่งอัปเดตยอดเงินทันที
        if (typeof updateOrderPreview === "function") {
            updateOrderPreview();
        }

        alert("💾 บันทึกการตั้งค่าเรียบร้อยแล้วจ้า!");

    } catch (error) {
        console.error("❌ สแกนพบความผิดพลาดขณะบันทึก:", error);
    }
}

// เรียกตัวเลขมาโชว์ตอนเปิดหน้าตั้งค่า
async function openSettings() {
    // 1. ดึงข้อมูลจาก Dexie (ตาราง settings)
    const ppData = await db.settings.get('promptpay');
    const storeData = await db.settings.get('store_name');

    // 2. นำเลข PromptPay มาใส่ในช่อง input (ถ้ามี)
    const ppInput = document.getElementById('set_promptpay');
    if (ppData) {
        ppInput.value = ppData.value;
    } else {
        ppInput.value = ""; // ล้างค่าว่างถ้ายังไม่เคยตั้ง
    }

    // 3. นำชื่อร้านมาใส่ในช่อง input (ดึงจาก Dexie ก่อน ถ้าไม่มีให้เช็ก localStorage)
    const nameInput = document.getElementById('name-input');
    if (storeData) {
        nameInput.value = storeData.value;
    } else {
        // กรณีเพิ่งอัปเกรดระบบ ให้ดึงจากของเดิมที่นายเคยเก็บไว้ใน localStorage
        nameInput.value = localStorage.getItem('shopName') || "";
    }

    // 4. โชว์ Modal ตั้งค่าขึ้นมา
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal) {
        settingsModal.style.display = 'block';
    }
}



// iOS & Popstate
window.addEventListener('load', () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isIOS && !isStandalone && document.getElementById('ios-install-guide')) {
        document.getElementById('ios-install-guide').style.display = 'block';
    }
});

/**
 * 🚩 ดักจับการกดย้อนกลับ (Back Button) บนมือถือหรือแท็บเล็ต 04-05-2026
 * ฟังก์ชันนี้จะทำงานเมื่อเบราว์เซอร์ตรวจพบว่ามีการ "ย้อนกลับ" ในประวัติการเข้าชม (History)
 */
window.onpopstate = function(event) {
    // 1. ดึงหน้าต่าง Modal "มุมหลานรักของยาย" มาเช็ค
    const dashboardModal = document.getElementById('dashboard-modal');

    // 2. ถ้าปัจจุบันยายเปิดหน้า Dashboard ค้างไว้อยู่
    if (dashboardModal && dashboardModal.style.display === 'block') {
        // ให้สั่งปิดหน้า Dashboard แทนการออกจากแอป
        dashboardModal.style.display = 'none';
        
        // (ออปชันเสริม) พี่สามารถใส่คำสั่งเพื่อให้ยายรู้ว่ากลับมาหน้าหลักแล้วได้ที่นี่
        console.log("ปิดหน้าแดชบอร์ดและกลับสู่หน้าหลักเรียบร้อย");
        return; // จบการทำงาน ไม่ต้องไปทำคำสั่งอื่น
    }

    /**
     * 3. จุดที่พี่เคยเขียนไว้: ถ้าอยู่หน้า 'back-page' ให้บันทึกและออก
     * ส่วนนี้ยังคงรักษาไว้ได้ถ้าพี่มีการใช้หน้า 'back-page' ในส่วนอื่นของแอป
     */
    const backPage = document.getElementById('back-page');
    if (backPage && backPage.style.display === 'block') {
        if (typeof saveAndExit === "function") {
            saveAndExit();
        }
    }
};