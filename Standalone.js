let selectedTable = null;
let cart = [];

// ==========================================
// 1. หัวใจระบบ: ฐานข้อมูล Dexie (Version 15: รองรับระบบตรวจบิลค้างส่ง P2P)
// ==========================================
const db = new Dexie("StandaloneDatabase");

/**
 * 🚩 การปรับปรุง Version 15 (30-05-2026):
 * 1. เพิ่มฟิลด์ 'sync_status' เข้าไปเป็น Index ในตาราง orders เพื่อใช้กรองหาบิลค้างส่ง (.where('sync_status').equals('pending'))
 * 2. การขยับเบอร์เวอร์ชันจาก 14 เป็น 15 จะสั่งให้เบราเซอร์อัปเกรดโครงสร้างตารางออเดอร์เดิมของคุณยายทันที
 * 3. 🛡️ ข้อมูลประวัติการขาย, ยอดนับวัตถุดิบ (total_count) และตารางอื่น ๆ ทั้งหมดยังอยู่ครบถ้วน ปลอดภัย 100%
 */
db.version(15).stores({
    settings: 'key', 
    
    // ✅ [ติดอาวุธ]: เพิ่ม , sync_status ต่อท้ายสุด เพื่อให้ระบบใช้ทำสารบัญในการสแกนหาข้อมูลตกค้างช่วงหน้าจอดับ
    orders: '++id, order_id, menu_name, total_price, discount, created_at, options, payment_method, sync_status',
    
    active_tables: 'table_id, last_update', 
    dailysummary: 'summary_date, total_sales, total_count, daily_investment, net_profit',
    menus: '++id, name, price',
    extra_options: '++id, name, price',
    security_logs: '++id, dateOnly, event',
    shopping_list: '++id, name, price, status, date, confirmed_date',
    price_history: 'name, last_price, best_price, last_updated' 
});

// เปิดประตูเชื่อมต่อฐานข้อมูลเวอร์ชันใหม่
db.open().then(() => {
    console.log("✅ [DB Ready] อัปเกรดเป็น Version 15 (เพิ่มฟิลด์ sync_status ป้องกัน P2P หลุด) เรียบร้อยแล้วครับเพื่อน!");
}).catch(err => {
    console.error("❌ [DB Error]: " + err.stack);
});

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

    // --- 4. บันทึกค่าการนับและอัปเดตป้ายแจ้งสถานะสากล (ปรับปรุง 29-05-2026) ---
    if (counterLabel.trim() !== "") {
        localStorage.setItem('counterLabel', counterLabel);
        // 🎯 หยอดชื่อวัตถุดิบลงไปในป้ายแสดงผลให้สวยงาม ไม่พ่นคำว่า "ไปแล้ว" เบียดบังช่องอื่น
        if (document.getElementById('display-label')) {
            document.getElementById('display-label').innerText = "📊 วันนี้ใช้ " + counterLabel + " ไปแล้ว";
        }
    }
    
    if (counterUnit.trim() !== "") {
        localStorage.setItem('counterUnit', counterUnit);
        // 🎯 [อุดรอยรั่วเดิม]: สั่งให้หน่วยบนหน้าจอหลักอัปเดตตามที่ยายตั้งค่าทันที ไม่ค้างคำว่าฟองตลอดกาล
        if (document.getElementById('display-unit')) {
            document.getElementById('display-unit').innerText = counterUnit;
        }
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

/**
 * ฟังก์ชัน: loadDailyCost (ฉบับหลานรักดูแลยาย)
 * หน้าที่: ดึงทุนล่าสุดที่เคยจดไว้ในเก๊ะ (localStorage) มาวางที่หน้าจอตอนเปิดแอป 06-05-2026
 */
function loadDailyCost() {
    // 1. ไปรื้อเก๊ะดูว่าหลานเคยจด "ทุนล่าสุด" (myDailyCost) ทิ้งไว้ไหม
    const savedCost = localStorage.getItem('myDailyCost');
    
    // 2. ตรวจสอบว่าในหน้าจอมีช่องกรอก "daily-cost" อยู่จริงหรือไม่ (ป้องกันแอปพังถ้าหาช่องไม่เจอ)
    const costInput = document.getElementById('daily-cost');

    if (costInput) {
        if (savedCost !== null) {
            // 🌟 กรณีเจอข้อมูลเดิม: เอาทุนที่ยายเคยกรอกไว้ล่าสุดมาโชว์ให้เลย
            costInput.value = savedCost;
            console.log(`📂 หลานรักดึงทุนเดิม (${savedCost} บาท) มาเตรียมไว้ให้ยายแล้วจ้า`);
        } else {
            // 🌟 กรณีเป็นครั้งแรกของแอป: ตั้งค่าเริ่มต้นเป็น 0 บาทไว้ก่อน
            costInput.value = 0;
            console.log("📂 ยายยังไม่เคยจดทุนไว้เลย หลานตั้งค่าเป็น 0 ให้ก่อนนะครับ");
        }
    }
}

//ทุนวันนี้ 06-05-2026
async function saveCostAndRefresh() {
    // 1. ดึงค่าจากช่อง "ทุนวันนี้" ใน HTML
    const costInput = document.getElementById('daily-cost');
    const newCost = parseFloat(costInput.value) || 0;
    
    // 2. เก็บใน localStorage ไว้เหมือนเดิม (เพื่อให้ระบบจำทุนล่าสุดไว้ใช้ในวันถัดไปได้)
    localStorage.setItem('myDailyCost', newCost);

    // 3. เตรียมข้อมูลวันที่ (ใช้รูปแบบ YYYY-MM-DD เพื่อเป็น Key หลัก)
    const today = new Date().toISOString().split('T')[0];

    try {
        // 4. ดึงข้อมูลเดิมของวันนี้มาดูก่อน (ถ้ามี)
        const existingData = await db.dailysummary.get(today);

        if (existingData) {
            // 🌟 จุดปรับปรุง: ถ้าวันนี้มีข้อมูลอยู่แล้ว (เช่น มีการขายไปแล้ว) 
            // เราจะใช้การ update เพื่อ "เปลี่ยนแค่ทุนกับกำไร" โดยไม่ไปยุ่งกับยอดขายหรือจำนวนไข่ที่จดไว้ก่อนหน้า
            const newProfit = existingData.total_sales - newCost;
            
            await db.dailysummary.update(today, {
                daily_investment: newCost,
                net_profit: newProfit
            });
            
            console.log(`✅ หลานรักอัปเดตทุนให้ยายแล้ว: ทุนใหม่ ${newCost} บาท, กำไรขยับเป็น ${newProfit} บาท`);
        } else {
            // 🌟 จุดเพิ่มเติม: ถ้าเปิดแอปมาแล้วกรอกทุนเป็นอย่างแรกของวัน (ยังไม่มีข้อมูลใน DB)
            // เราจะสร้างบันทึกใหม่ให้ยายทันที โดยตั้งค่ายอดขายเริ่มต้นเป็น 0
            await db.dailysummary.put({
                summary_date: today,
                total_sales: 0,
                total_count: 0,
                daily_investment: newCost,
                net_profit: -newCost // เริ่มวันด้วยทุน กำไรจึงติดลบตามระเบียบครับ
            });
            
            console.log(`✅ หลานรักจดบันทึกเริ่มต้นวันให้ยายแล้ว: ลงทุนไป ${newCost} บาทจ้า`);
        }

    } catch (error) {
        // แจ้งเตือนเมื่อเกิดเหตุขัดข้องในการเขียนข้อมูล
        console.error("❌ หลานรักจดบันทึกลงฐานข้อมูลไม่ได้:", error);
        alert("อุ๊ย! บันทึกทุนไม่ได้ครับยาย ลองเช็คระบบอีกทีนะ");
    }

    // 5. เรียกฟังก์ชันเดิมเพื่ออัปเดตตัวเลขบนหน้าจอให้เป็นปัจจุบัน
    if (typeof fetchTodaySales === 'function') {
        fetchTodaySales();
    }
}

// ==========================================
// กล่องที่ 3: ระบบ Dynamic Menu & Options (แยกส่วนหน้าขายและคลัง)
// ==========================================

// วาดปุ่มกดสั่งอาหาร (หน้าแรก) - ดึงจาก localStorage เท่านั้น 09-06-2026
async function renderOrderButtons() {
    const menuContainer = document.getElementById('Order-menu');
    if (!menuContainer) return;

    const savedQuickMenus = JSON.parse(localStorage.getItem('quickMenus')) || [];

    menuContainer.innerHTML = savedQuickMenus.length ? '' : 
        '<p class="menu-empty-hint">ยังไม่มีเมนูด่วน... ตั้งค่าที่ "บันทึกรายการเมนูขาย" ⚙️</p>';

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

// วาดรายการ "บันทึกรายการเมนูขาย" ในหน้าตั้งค่า - ดึงจาก localStorage 09-06-2026
function renderMenuSettings() {
    const container = document.getElementById('menu-settings-list');
    if (!container) return;
    const quickMenus = JSON.parse(localStorage.getItem('quickMenus')) || [];
    container.innerHTML = '';
    
    quickMenus.forEach((menu, index) => {
        const div = document.createElement('div');
        div.className = 'menu-setting-row'; // 🔒 ใช้คลาสใหม่ในการคุม Layout แทนการเขียน .style ใน JS
        
        // ชำระล้างเอาสไตล์ตกแต่งอินไลน์ออกทั้งหมด แล้วสวมป้ายคลาสที่เราสร้างเตรียมไว้ใน CSS แทน
        div.innerHTML = `
            <input type="text" value="${menu.name}" disabled class="stg-input-name">
            <input type="number" value="${menu.price}" disabled class="stg-input-price">
            <button type="button" class="stg-row-btn btn-row-edit" onclick="toggleEditRow(this)">📝</button>
            <button type="button" class="stg-row-btn btn-row-delete" onclick="this.parentElement.remove()">🗑️</button>
        `;
        container.appendChild(div);
    });
}

// ฟังก์ชันสำหรับสลับโหมด แก้ไข/ล็อก (Toggle Edit) 09-06-2026
function toggleEditRow(btn) {
    const row = btn.parentElement;
    const inputs = row.querySelectorAll('input');
    const isCurrentlyDisabled = inputs[0].disabled;

    inputs.forEach(input => {
        // 🔒 ตรรกะหลัก: สลับสถานะเปิด/ปิดอินพุต คงไว้เหมือนเดิมร้อยเปอร์เซ็นต์
        input.disabled = !isCurrentlyDisabled;
        
        // 🟢 เปลี่ยนจากการยัดสีอินไลน์ มาเป็นการดึง-ถอดคลาสจาก CSS แทน ปลอดภัยและคลีนสุดๆ
        if (isCurrentlyDisabled) {
            input.classList.add('is-editing');
        } else {
            input.classList.remove('is-editing');
        }
    });

    // เปลี่ยนไอคอนปุ่ม และสลับคลาสสีของปุ่มระหว่าง สีฟ้า(แก้ไข) กับ สีเขียว(บันทึก)
    if (isCurrentlyDisabled) {
        btn.innerText = "✅";
        btn.classList.remove('btn-row-edit');
        btn.classList.add('btn-row-save');
    } else {
        btn.innerText = "📝";
        btn.classList.remove('btn-row-save');
        btn.classList.add('btn-row-edit');
    }
}

// ปรับส่วนเพิ่มแถวใหม่ ให้พร้อมพิมพ์ได้ทันที (ไม่ต้องกดแก้) 09-06-2026
function addMenuField() {
    const container = document.getElementById('menu-settings-list');
    if (!container) return; // 🔒 ใส่ระบบความปลอดภัยดักจับไว้ เผื่อหน้าจอนี้ยังไม่ถูกโหลด ระบบจะได้ไม่พัง
    
    const div = document.createElement('div');
    div.className = 'menu-setting-row'; // 🟢 ใช้ Layout ความพรีเมียมจาก CSS ที่เราจัดระเบียบไว้แล้ว
    
    // ชำระล้างสไตล์อินไลน์ออกทั้งหมด แล้วใช้คลาสสากลระดับพรีเมียมมาสวมแทน
    div.innerHTML = `
        <input type="text" placeholder="ชื่อเมนู" class="stg-input-name is-editing">
        <input type="number" placeholder="ราคา" class="stg-input-price is-editing">
        <button type="button" class="stg-row-btn btn-row-delete" onclick="this.parentElement.remove()">🗑️</button>
    `;
    container.appendChild(div);
}

// วาดส่วนเพิ่มเติม (Options) 09-06-2026
async function renderExtraOptions() {
    const container = document.getElementById('dynamic-options-list');
    if (!container) return; // 🔒 เกราะป้องกันดักจับตัวแปรว่าง ระบบหน้าบ้านจะได้ไม่พังกลางคัน
    
    const allOptions = await db.extra_options.toArray();
    container.innerHTML = '';

    allOptions.forEach(opt => {
        const label = document.createElement('label');
        label.className = 'extra-opt-label'; // 🟢 ดึงโครงสร้างระเบียบแถวพรีเมียมและนุ่มนิ้วมาจาก CSS ทันที
        
        // ชำระล้างเอาสไตล์อินไลน์ออกหมดจด แล้วครอบด้วยคลาสที่เราเตรียมไว้เรียบร้อย
        label.innerHTML = `
            <input type="checkbox" class="extra-opt-check"
                   data-name="${opt.name}" 
                   data-price="${opt.price}"
                   onchange="syncOptions()"> <span>+ ${opt.name} (${opt.price}.-)</span>
        `;
        container.appendChild(label);
    });
}
// 04-06-2026 
function syncOptions() {
    // 1. ถ้าในตะกร้ายังไม่มีของเลย ก็ไม่ต้องทำอะไร
    if (cart.length === 0) return;

    // 2. ดึงค่า Options ที่ถูกติ๊กอยู่ในปัจจุบันทั้งหมด
    let extraPrice = 0;
    let extraNames = [];
    
    // ดึง Element ของกลุ่ม Checkbox ออปชันทั้งหมดบนหน้าจอ (รวมทั้งที่ติ๊กและไม่ได้ติ๊ก) เพื่อใช้ตรวจสอบสถานะ DOM
    const allOptionCheckboxes = document.querySelectorAll('.extra-opt-check');
    
    // กรองเอาเฉพาะตัวที่ถูกติ๊กเลือกอยู่ในปัจจุบัน
    const checkedCheckboxes = document.querySelectorAll('.extra-opt-check:checked');
    
    checkedCheckboxes.forEach(checkbox => {
        extraPrice += parseFloat(checkbox.getAttribute('data-price')) || 0;
        extraNames.push(checkbox.getAttribute('data-name'));
    });

    // 3. เข้าไปแก้ไข "รายการล่าสุด" ในตะกร้า
    let lastItem = cart[cart.length - 1];
    
    // --- 🚩 จุดที่แก้ไขเดิม: ตรวจสอบและบันทึกราคาพื้นฐาน (Base Price) ---
    if (lastItem.basePrice === undefined || lastItem.basePrice === null) {
        lastItem.basePrice = parseFloat(lastItem.price) || 0;
    }

    // =========================================================================
    // 🛡️ [เกราะป้องกันระดับวิกฤต - ป้องกันสัญญาณผีล้างข้อมูลตะกร้า]
    // =========================================================================
    // 🧠 สิ่งที่จะเกิดขึ้น: 
    // เราจะยอมให้อัปเดตราคาและล้างข้อความออปชันในตะกร้าได้ก็ต่อเมื่อ "หน้าจอวาด Element เสร็จสมบูรณ์แล้วเท่านั้น"
    // (ตรวจสอบจาก allOptionCheckboxes.length > 0 คือต้องมีกล่อง Checkbox ปรากฏตัวอยู่บนจอจริง ๆ)
    //
    // ❌ ถ้าเกิดอาการหน้าจอกระพริบ/โหลดไม่ทัน จนป้าย Checkbox บนจอหายไปชั่วคราว (length === 0)
    // โค้ดบล็อกนี้จะ "บล็อก" ไม่ให้ลอจิกวิ่งไปเคลียร์ค่าว่างทับข้อมูลเดิม ข้อมูล 'พิเศษ' ดั้งเดิมจึงปลอดภัย 100%
    //
    // 🟢 แต่ถ้ายายตั้งใจกด "เอาติ๊กออก" เองจริง ๆ (Checkbox ยังอยู่บนจอ แต่ไม่มีตัวไหนโดนติ๊กเลย)
    // ระบบจะยอมให้เคลียร์ค่าเป็นว่างเปล่า และหักลบราคาเหลือเพียงราคาฐานตามธรรมชาติของตะกร้าสินค้าปกติครับ
    // =========================================================================
    if (allOptionCheckboxes.length > 0) {
        
        // อัปเดตราคาที่ถูกต้อง (ราคาพื้นฐานที่จำไว้ + ราคาตัวเลือกเสริมที่เพิ่งติ๊กจริงบนจอ)
        lastItem.price = lastItem.basePrice + extraPrice;
        
        // อัปเดตชื่อตัวเลือกเสริม (ถ้าไม่มีการติ๊กเลย จะกลายเป็นค่าว่าง "" ซึ่งถูกต้องตามเจตนายาย)
        lastItem.options = extraNames.join(', ');
        
        console.log(`🎯 [syncOptions] อัปเดตออปชันสำเร็จจริงตาม UI: "${lastItem.options}" ราคาบวกเพิ่ม: +${extraPrice}.-`);
    } else {
        // 🚨 กรณีหลุดเข้าสภาวะ Race Condition (หน้าจอยังวาดไม่เสร็จ แต่อลาร์มฟังก์ชันทำงานย้อนศร)
        console.warn("🛑 [Safety Blocked] ตรวจพบการสั่งงานย้อนศรขณะ DOM ยังวาดไม่เสร็จ ระบบสั่งระงับการล้างข้อมูลเพื่อเซฟตะกร้าสินค้า");
    }

    // 4. สั่งวาดหน้าจอใหม่
    if (typeof updateOrderPreview === "function") {
        updateOrderPreview();
    }
}

// วาดส่วนเพิ่มเติม (Options) ในหน้าตั้งค่า - ถอนสไตล์ออกจาก JS ปลอดภัยระยะยาว 25-04-2026
async function renderOptionsSettings() {
    const container = document.getElementById('options-settings-list');
    if (!container) return; // 🔒 ระบบเกราะป้องกันดักจับตัวแปรว่าง แอปจะได้ไม่พังกลางคัน
    
    const allOptions = await db.extra_options.toArray();
    container.innerHTML = '';
    
    allOptions.forEach(opt => {
        const div = document.createElement('div');
        div.className = 'opt-setting-row'; // 🟢 ใช้คลาสจัด Layout จาก CSS แทนการยัด .style ตรงๆ
        
        // ชำระล้างเอาสไตล์ตกแต่งอินไลน์ออกเกลี้ยง แล้วสวมคลาสพรีเมียมที่เราจัดระเบียบไว้ใน CSS แทน
        div.innerHTML = `
            <input type="text" value="${opt.name}" class="opt-input-name" onchange="updateExtra(${opt.id}, 'name', this.value)">
            <input type="number" value="${opt.price}" class="opt-input-price" onchange="updateExtra(${opt.id}, 'price', this.value)">
            <button type="button" class="opt-btn-delete" onclick="deleteExtra(${opt.id})">🗑️</button>
        `;
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
//28-05-2026
/**
 * 🛒 [Cart Adder] ฟังก์ชันหยิบอาหารและตัวเลือกเสริมใส่ตะกร้าสินค้า
 * ปรับปรุงความรอบคอบ: ขยายการรับพารามิเตอร์เพิ่ม 'options' และ 'optionPrice' เพื่ออุดรอยรั่วราคาสูญหาย
 */
function addItemToOrder(name, price, options = "", optionPrice = 0) {
    
    // แปลงค่าความปลอดภัยป้องกันระบบคำนวณเงินเอ๋อ
    const basePrice = parseFloat(price) || 0;
    const optPrice = parseFloat(optionPrice) || 0;
    const optText = String(options || "").trim();

    // 1. 🔍 ค้นหาในตะกร้า (cart) ว่ามีเมนูชื่อนี้ "ที่มีออปชันแบบเดียวกัน" อยู่แล้วหรือไม่
    // 🚩 เงื่อนไข Single Codebase: ต้องชื่อตรงกัน, ออปชันเหมือนกัน และไม่ใช่ของเก่าจากเบส (fromDB)
    let existingNewItem = cart.find(item => 
        item.name === name && 
        (item.options || "") === optText && 
        !item.fromDB
    );

    if (existingNewItem) {
        // --- ➕ กรณีเจอของใหม่ที่เหมือนกันเป๊ะในตะกร้าแล้ว ---
        existingNewItem.qty = (existingNewItem.qty || 0) + 1;
        console.log(`➕ เพิ่มจำนวน [${name}] (${optText}) เป็น ${existingNewItem.qty} จาน`);
    } else {
        // --- 🆕 กรณีเป็นเมนูใหม่ หรือสั่งออปชันไม่ซ้ำกับอันเดิม ---
        // สิ่งที่จะเกิดขึ้น: นำค่าตัวอักษรออปชัน และราคาออปชันเสริม ผูกติดเข้าวัตถุตะกร้าทันที!
        cart.push({
            name: name,
            price: basePrice,
            qty: 1,
            fromDB: false, 
            options: optText,             // 🌟 บันทึกคำว่า "พิเศษ" หรือตัวเลือกเสริมลงไปจริง
            optionPrice: optPrice,        // 💰 [คีย์วิกฤต]: เซฟราคาพิเศษเข้าตะกร้า (CamelCase)
            option_price: optPrice        // เซฟเผื่อเหนียวในรูปแบบตัวหนอนป้องกันบั๊กเรียกสลับคีย์
        });
        console.log(`🆕 เพิ่มรายการใหม่: [${name}] ออปชัน: [${optText}] (+${optPrice}.-) ลงในตะกร้า`);
    }

    // 2. 🎨 จัดการ UI: ล้างสถานะการเลือกที่ปุ่มเมนู
    document.querySelectorAll('#Order-menu button').forEach(b => {
        b.classList.remove('selected');
    });

    // 3. 🚩 อัปเดตการแสดงผลหน้าจอให้ยายเห็นเมนูและยอดเงินใหม่ทันที
    if (typeof updateOrderPreview === 'function') {
        updateOrderPreview();
    }
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

/**
 * ฟังก์ชันวาดหน้าจอตะกร้า (ปรับปรุงล่าสุด: 27-05-2026)
 * หน้าที่: แสดงรายการอาหาร, คำนวณเงิน, และควบคุมการโชว์ปุ่ม "ฝากลงโต๊ะ"
 */
/**
 * ฟังก์ชันวาดหน้าจอสรุปออเดอร์ (ตะกร้าสินค้า):
 * ปรับปรุงให้แยกแยะรายการเก่า/ใหม่ และบล็อกการลบรายการที่สั่งไปแล้ว
 */
function updateOrderPreview() {
    console.log("🔄 [จับไต๋บั๊ก] updateOrderPreview() กำลังพยายามวาดรายการอาหารขึ้นจอ...");

    // --- 1. ดึง Element สำคัญ ---
    const detailBox = document.getElementById('order-detail');
    const totalBox = document.getElementById('order-total-price');
    const qtyBox = document.getElementById('order-qty'); 
    const btnToTable = document.getElementById('btn-to-table');     
    const btnPayNow = document.getElementById('btn-pay-now');      
    const btnCash = document.getElementById('btn-pay-cash');        
    const btnTransfer = document.getElementById('btn-pay-transfer'); 

    if(btnPayNow) btnPayNow.style.display = 'block'; 

    // เปลี่ยนจากการยัดสไตล์สด มาเป็นการสวมคลาสล็อกสถานะจาก CSS แทน ปลอดภัยสูงสุด
    const disablePayButtons = () => {
        [btnCash, btnTransfer].forEach(btn => {
            
        });
    };

    const rawDiscount = localStorage.getItem('default_discount') || "0";
    const isPercent = rawDiscount.toString().includes('%'); 
    const discountConfigValue = parseFloat(rawDiscount) || 0; 

    // --- ส่วนที่ 3: คำนวณรายการอาหาร ---
    let grandTotal = 0;
    
    let detailHTML = cart.map((item, index) => {
        const opPrice = parseFloat(item.optionPrice || item.option_price || item.extraPrice || item.extra_price || 0);
        const basePrice = parseFloat(item.price) || 0;
        const finalQty = parseInt(item.qty) || 1;

        const itemTotal = (basePrice + opPrice) * finalQty;
        grandTotal += itemTotal;

        const isLocked = item.fromDB === true; 
        const itemStatus = item.status || 'pending';
        const statusBadge = itemStatus === 'done' ? `<span class="badge-serve-done">[เสิร์ฟแล้ว]</span>` : '';

        let cleanedOptions = String(item.options || "").trim();
        if (cleanedOptions.includes("พิเศษ")) {
            cleanedOptions = "พิเศษ";
        }

        const optionTextTag = cleanedOptions 
            ? `<small class="cart-item-option">🔹 ${cleanedOptions}${opPrice > 0 ? ` (+${opPrice.toLocaleString()}.-)` : ''}</small>` 
            : '';

        return `
            <div data-item-id="${item.itemId || ''}" class="cart-item-row ${isLocked ? 'is-locked-row' : ''}">
                <div class="cart-item-info">
                    <div class="cart-item-title">
                        ${isLocked ? '<span style="color:#27ae60;">✅</span> ' : '<span style="color:#3498db;">🆕</span> '}${item.name} ${statusBadge}
                    </div>
                    ${optionTextTag}
                    ${isLocked ? '<small class="cart-item-notice">(สั่งแล้ว แก้ไขไม่ได้)</small>' : ''}
                </div>
                <div class="cart-item-pricing">
                    <span class="cart-item-qty">x${finalQty}</span><br>
                    <span class="cart-item-total">${itemTotal.toLocaleString()}.-</span>
                </div>

                ${isLocked ? `
                    <div class="icon-cart-lock">
                        <i class="fas fa-lock" title="รายการนี้ส่งเข้าครัวแล้ว"></i>
                    </div>
                ` : `
                    <button type="button" class="btn-cart-delete" onclick="deleteSpecificItem(${index})">
                        🗑️
                    </button>
                `}
            </div>
        `;
    }).join('');

    // --- ส่วนที่ 4: คำนวณส่วนลด ---
    let actualDiscountAmount = 0;
    if (isPercent) {
        actualDiscountAmount = (grandTotal * discountConfigValue) / 100;
    } else {
        actualDiscountAmount = discountConfigValue;
    }

    const netTotal = Math.max(0, grandTotal - actualDiscountAmount);
    
    if (actualDiscountAmount > 0) {
        const label = isPercent ? `ส่วนลด (${discountConfigValue}%)` : `ส่วนลดเงินสด`;
        detailHTML += `
            <div class="cart-discount-row">
                <span><i class="fas fa-tag"></i> ${label}:</span>
                <span>-${actualDiscountAmount.toLocaleString()}.-</span>
            </div>
        `;
    }

    if(detailBox) detailBox.innerHTML = detailHTML;

    // --- ส่วนที่ 5: แสดงยอดรวมสุทธิ ---
    if(totalBox) {
        const strikeThroughHTML = (actualDiscountAmount > 0) 
            ? `<small>ยอดรวม: ${grandTotal.toLocaleString()}.-</small>` 
            : '';

        totalBox.innerHTML = `
            <div class="cart-net-total-box">
                ${strikeThroughHTML}
                <span class="text-label">ยอดสุทธิ:</span> 
                <span class="text-price">${netTotal.toLocaleString()}.-</span>
            </div>
        `;
    }

    // --- ส่วนที่ 6: จัดการปุ่มและการแสดงผลจำนวน ---
    if(qtyBox) {
        if(cart && cart.length > 0) {
            const lastItem = cart[cart.length - 1];
            qtyBox.innerText = lastItem.qty || "1";
        } else {
            qtyBox.innerText = "0"; // ถ้าว่างให้โชว์ 0
        }
    }

    // 2. [สำคัญมาก] บังคับแสดงปุ่มชำระเงินเสมอ (ย้ายออกมานอกเงื่อนไขตะกร้า)
    [btnCash, btnTransfer].forEach(btn => {
        if(btn) {
            btn.style.display = 'inline-block'; 
            btn.classList.remove('btn-payment-disabled');
        }
    });

    const hasTable = (typeof selectedTable !== 'undefined' && selectedTable !== null && selectedTable !== "null" && selectedTable !== "");
    // 3. บังคับแสดงปุ่มฝากโต๊ะเสมอ
    if(btnToTable) {
        btnToTable.style.display = 'block'; 
    }
}

/**
 * 🚩 [ฟังก์ชันเสริม]: ป้องกันการลบผ่าน Code
 */
function deleteSpecificItem(index) {
    if (cart[index] && cart[index].fromDB) {
        console.warn("🚫 ปฏิเสธการลบ: รายการนี้ถูกสั่งไปแล้ว");
        return;
    }
    cart.splice(index, 1);
    updateOrderPreview();
}

// ฟังก์ชันลบเฉพาะบางรายการ 25-04-2026
function deleteSpecificItem(index) {
    cart.splice(index, 1); // ลบข้อมูลใน Array ตามตำแหน่งที่กด
    updateOrderPreview();  // วาดหน้าจอใหม่
}



/**
 * 🚀 ฟังก์ชันยืนยันออเดอร์ (Single Codebase Version)
 * [หน้าที่]: บันทึก DB, ส่งข้อมูลวาร์ป P2P, และจัดการหน้าจอตามร่างของเครื่อง
 * แก้ไขล่าสุด: 18-05-2026 (ป้องกันปัญหา Items เป็น 0 และตั๋วหาย)
 */

// 🚩 เพิ่มตัวแปรล็อคไว้ด้านบนสุดของไฟล์ (นอกฟังก์ชัน)
let isConfirmingOrder = false; 

/**
 * 🧠 ฟังก์ชันจัดระเบียบและแปลงชื่อโต๊ะให้เป็นมาตรฐานเดียวกัน (Table Normalization)
 * ช่วยให้คำว่า "1", "โต๊ะ1", "ต.1" กลายเป็น "โต๊ะ 1" และค่าว่างกลายเป็น "กลับบ้าน"
 */
function normalizeTableName(rawTable) {
    if (!rawTable || rawTable === "null" || rawTable === "undefined") {
        return "กลับบ้าน";
    }
    let tableStr = String(rawTable).trim();
    if (['กลับบ้าน', 'หน้าร้าน', 'ทั่วไป', 'TAKEAWAY', 'Takeaway'].includes(tableStr)) {
        return "กลับบ้าน";
    }
    // ใช้ Regex ดึงเฉพาะตัวเลขออกมา เช่น "โต๊ะ 1" หรือเลข "1" โดดๆ จะได้เลข 1
    let matchNumber = tableStr.match(/\d+/);
    if (matchNumber) {
        return `โต๊ะ ${matchNumber[0]}`; // บังคับเซ็ตเป็นโครงสร้างคำมาตรฐาน
    }
    return "กลับบ้าน";
}

/**
 * 🚀 ฟังก์ชันบอสใหญ่จัดการยืนยันออเดอร์ บันทึกยอดขาย และสั่งงานห้องครัว/ระบบไร้สาย
 * แก้ไขล่าสุด: อัปเกรดระบบจัดกลุ่มเลขโต๊ะ และแยกสมองตั๋วคิวครัว 28-05-2026
 */
async function confirmOrder(payment_method, isFromWarp = false, warpData = null) {
    // 1. [ดักเบิ้ลระดับที่ 1]: ป้องกันกระแสลูปและปัญหาพนักงานกดย้ำปุ่มคิดเงิน
    if (isConfirmingOrder && !isFromWarp) return;

    // --- 🚨 [จุดเพิ่มความปลอดภัย]: ดักตะกร้าว่างก่อนเริ่มลอจิกอื่น ---
    if (!isFromWarp && (!cart || cart.length === 0)) {
        alert("⚠️ ยายจ๋า! ตะกร้ายังว่างอยู่เลย เลือกของก่อนนะ");
        return;
    }

    if (!isFromWarp) isConfirmingOrder = true;

    // --- ด่านย้ำสติก่อนชำระเงิน ---
    if (!isFromWarp) {
        let checkTable = window.isCheckingOutTable || selectedTable || null;
        const normalizedCheckTable = normalizeTableName(checkTable);
        const alertMsg = normalizedCheckTable === "กลับบ้าน"
            ? `🛍️ ยายจ๋า! ออเดอร์นี้เป็นแบบ [ สั่งกลับบ้าน ] และกำลังจะคิดเงินใช่ไหมครับ?`
            : `💰 ยายจ๋า! ตรวจสอบอีกครั้งเพื่อความชัวร์\n\n📌 กำลังจะชำระเงินปิดบิลของ: "${normalizedCheckTable}"\n\nแน่ใจใช่ไหมว่าไม่ผิดโต๊ะ?`;

        const isConscious = confirm(alertMsg);
        if (!isConscious) {
            console.log("🛑 [Cancel] พนักงานกดยกเลิกการคิดเงิน");
            isConfirmingOrder = false;
            return;
        }
    }

    const identity = typeof getCurrentIdentity === 'function' ? getCurrentIdentity() : 'none';
    
    // 🎯 [ปรับปรุงจุดตรวจสอบ]: เช็กสถานะให้แม่นยำว่านี่คือกระบวนการ "ชำระเงินเพื่อปิดบิล" ใช่หรือไม่
    const isPayingNow = (payment_method !== null && payment_method !== undefined) || (warpData && warpData.isPayment === true);

    // =========================================================================
    // 🧠 [จุดอัปเกรด Phase 3]: แช่แข็งข้อมูลพร้อมฉีดฝังโครงสร้างรายจาน (Item-Level Status)
    // =========================================================================
    let rawItems = isFromWarp ? (warpData.items || []) : JSON.parse(JSON.stringify(cart));
    const orderId = isFromWarp ? (warpData.orderId) : Date.now();

    // วนลูปฉีดตรวจสอบโครงสร้างข้อมูลรายจาน
    const targetItems = rawItems.map((item, index) => {
        return {
            ...item,
            itemId: item.itemId || `item_${orderId}_${index}_${Math.floor(Math.random() * 1000)}`,
            status: item.status || 'pending'
        };
    });
    
    let currentTableState = window.isCheckingOutTable || selectedTable || null;
    let rawTable = isFromWarp ? (warpData.table || null) : currentTableState;
    const targetTable = normalizeTableName(rawTable);

    // =========================================================================
    // 🏷️ ✨ [จุดเพิ่มอัปเกรดวิกฤต: ลอจิกจัดการคำนวณส่วนลดก่อนบันทึกบิล] ✨
    // =========================================================================
    let finalDiscountAmount = 0; // ตัวแปรหลักสำหรับเก็บมูลค่าส่วนลดที่เป็น "บาท" เพื่อใช้กระจายส่งต่อ
    
    if (isFromWarp && warpData.discount !== undefined) {
        // [กรณีข้อมูลวาร์ปมาจากเครื่องอื่น]: ให้ดึงค่าส่วนลดที่เครื่องต้นทางคำนวณไว้มาใช้เลยโดยตรงเพื่อความแม่นยำ
        finalDiscountAmount = parseFloat(warpData.discount) || 0;
    } else {
        // [กรณีบิลสดที่กดขายหน้าคอมเครื่องนี้]: ทำการคำนวณหาส่วนลดตามสูตรหน้าจอขายจริง
        // 1. หาราคารวมดิบของสินค้าทั้งหมดในตะกร้าก่อนหักส่วนลด
        let grandTotal = targetItems.reduce((s, i) => s + ((parseFloat(i.price) || 0) * (parseInt(i.qty) || 1)), 0);
        
        // 2. ดึงการตั้งค่าส่วนลดเริ่มต้นจากเครื่อง
        const rawDiscount = localStorage.getItem('default_discount') || "0";
        const isPercent = rawDiscount.toString().includes('%');
        const discountConfigValue = parseFloat(rawDiscount) || 0;

        // 3. จำแนกสายการคำนวณว่าลดเป็นเปอร์เซ็นต์ หรือ ลดเป็นเงินสดบาทดื้อ ๆ
        if (isPercent) {
            finalDiscountAmount = (grandTotal * discountConfigValue) / 100;
        } else {
            finalDiscountAmount = discountConfigValue;
        }
    }

    try {
        // --- 3. การจัดการฐานข้อมูล (Database) ---
        if (!isFromWarp || identity === 'hub') {
            const exists = await db.orders.where('order_id').equals(orderId).first();
            if (!exists && targetItems.length > 0) {
                const orderEntries = targetItems.map(item => ({
                    order_id: orderId, 
                    menu_name: item.name, 
                    qty: item.qty || 1,
                    options: item.options || "", 
                    total_price: item.price * (item.qty || 1),
                    discount: finalDiscountAmount, // ✨ [อุดรอยรั่วจุดที่ 1]: ฝังข้อมูลมูลค่าส่วนลดลงตาราง เพื่อให้บิลย้อนหลังจำได้ว่าลดไปเท่าไหร่
                    payment_method: String(payment_method || 'CASH').toUpperCase().trim(), 
                    created_at: new Date().toLocaleString('sv-SE'),
                    item_id: item.itemId,      
                    item_status: item.status   
                }));
                await db.orders.bulkAdd(orderEntries);
                console.log(`💾 [${identity}] บันทึกออเดอร์รายจานพร้อมข้อมูลส่วนลดลง DB เรียบร้อย`);
            }
        }

        // =========================================================================
        // --- ส่วนที่ 4: การจัดการเครื่องครัวอัจฉริยะ (Kitchen Identity) ---
        // =========================================================================
        if (identity === 'kitchen') {
            if (isPayingNow && targetTable !== "กลับบ้าน") {
                console.log(`💰 [Kitchen Skip] ชำระเงินปิดบิลของ [โต๊ะ ${targetTable}] -> ข้ามการออกตั๋วซ้ำสำเร็จ (เพราะเคยทำอาหารไปแล้ว)`);
                return; 
            }

            if (typeof addKitchenTicket === 'function' && targetItems.length > 0) {
                console.log(`🍳 [Kitchen Queue] ส่งโครงสร้างออเดอร์เข้าคิวจอครัวเรียบร้อย: ${targetTable}`);
                addKitchenTicket({ orderId, items: targetItems, table: String(targetTable) });
            }
            return; 
        }

        // =========================================================================
        // --- ส่วนที่ 5: การวาร์ปข้อมูลข้ามเครือข่าย (Warp System) ---
        // =========================================================================
        if (!isFromWarp || identity === 'hub') {
            if (typeof executeOrderSent === "function") {
                // 🎯 [อุดรอยรั่วจุดที่ 2 - ซิงค์ข้อมูลส่วนลดผ่านระบบเครือข่าย]:
                // แนบฟีลด์ `discount: finalDiscountAmount` ลงใน Object Payload 
                // เพื่อส่งสัญญาณข้ามเครือข่ายแจ้งให้เครื่อง Hub หรือเครื่อง Client ปลายทางรับรู้ยอดส่วนลดเท่ากัน
                executeOrderSent(isPayingNow, {
                    orderId, 
                    items: targetItems, 
                    table: String(targetTable), 
                    isPayment: isPayingNow, 
                    discount: finalDiscountAmount, // ✨ ฉีดแนบข้อมูลส่วนลดวาร์ปข้ามเครือข่ายไปด้วย
                    payment_method: (payment_method || 'Cash')
                }); 
            }
        }

        // --- 6. เคลียร์สถานะหน้าจอ (เฉพาะเครื่องที่กดขายเองหน้าร้าน) ---
        if (!isFromWarp) {
            if (typeof showSmartReceipt === "function") {
                // คำนวณยอดเงินรวมดิบของรายการอาหารในตะกร้าอีกครั้ง
                let calculatedGrandTotal = targetItems.reduce((s,i) => s + (i.price * i.qty), 0);
                // 🎯 [อุดรอยรั่วจุดที่ 3 - คำนวณราคาสุทธิที่หักลดราคาส่งให้บิลใบเสร็จ]:
                // เอาค่าราคาเต็มมาลบยอดส่วนลดบาท และใช้ Math.max ป้องกันราคาติดลบต่ำกว่า 0 บาทกรณีกดส่วนลดเกินราคาสินค้า
                let finalNetTotal = Math.max(0, calculatedGrandTotal - finalDiscountAmount);

                showSmartReceipt({
                    order_id: orderId, 
                    items: targetItems, 
                    discount: finalDiscountAmount, // ✨ ส่งมูลค่าส่วนลดไปให้ฟังก์ชันใบเสร็จดึงขึ้นป้ายส้มเน้นหนา
                    total_price: finalNetTotal,    // ✨ ส่งราคาสุทธิที่ถูกต้องไปเจนรูป QR Code และสรุปท้ายบิล
                    payment_method: payment_method, 
                    created_at: new Date().toLocaleString('sv-SE')
                });

            }

            if (targetTable && targetTable !== 'กลับบ้าน') {
                const matchNumber = targetTable.match(/\d+/);
                const cleanTableKey = matchNumber ? String(matchNumber[0]) : String(targetTable);
                await db.active_tables.delete(cleanTableKey);
            }

            cart = []; 
            selectedTable = null; 
            window.isCheckingOutTable = null;

            if (typeof updateOrderPreview === "function") updateOrderPreview();
            
            if (typeof renderTableSelection === "function") await renderTableSelection();
            if (typeof renderRecentOrdersUI === "function") renderRecentOrdersUI();
        }

        if (identity !== 'kitchen' && typeof fetchTodaySales === "function") {
            fetchTodaySales();
        }

    } catch (err) {
        console.error("❌ บั๊กระบบที่ confirmOrder:", err);
    } finally {
        if (!isFromWarp) isConfirmingOrder = false; 
    }
}


//29-05-2026
async function fetchTodaySales() {
    try {
        const todayStr = new Date().toLocaleDateString('sv-SE');
        const allOrders = await db.orders.toArray();
        
        // 1. จัดกลุ่มยอดขายตาม Order ID เพื่อแก้ปัญหาการนับส่วนลดซ้ำซ้อน
        const orderSummary = {}; 
        let countItems = 0;
        const targetSearch = localStorage.getItem('counterLabel') || "ไข่";

        allOrders.forEach(o => {
            if (o.created_at && o.created_at.startsWith(todayStr)) {
                // ถ้ายังไม่มี Order นี้ในระบบ ให้เริ่มนับ
                if (!orderSummary[o.order_id]) {
                    orderSummary[o.order_id] = {
                        total: 0,
                        method: String(o.payment_method || 'CASH').toUpperCase().trim(),
                        hasProcessed: true
                    };
                }
                
                // นำยอดรวมของแต่ละแถว (total_price) มารวมใน Order ID นั้นๆ
                orderSummary[o.order_id].total += Number(o.total_price || 0);
                
                // หักส่วนลดออก (สมมติว่าส่วนลดถูกบันทึกไว้ในฟิลด์ discount ของแต่ละแถวแล้ว)
                orderSummary[o.order_id].total -= Number(o.discount || 0);

                // นับวัตถุดิบ (นับเฉพาะเมื่อมี options ตรงกับเป้าหมาย)
                if (o.options && o.options.includes(targetSearch)) {
                    countItems += Number(o.qty || 1);
                }
            }
        });

        // 2. คำนวณผลรวมจากยอดที่กรุ๊ปไว้
        let total = 0, cashTotal = 0, qrTotal = 0;
        Object.values(orderSummary).forEach(s => {
            const finalOrderTotal = Math.max(0, s.total);
            total += finalOrderTotal;
            if (s.method === 'CASH') {
                cashTotal += finalOrderTotal;
            } else {
                qrTotal += finalOrderTotal;
            }
        });

        // 3. อัปเดตหน้าจอ (DOM)
        if (document.getElementById('total-sales-display')) 
            document.getElementById('total-sales-display').innerText = total.toLocaleString() + ".-";
        if (document.getElementById('cash-display')) 
            document.getElementById('cash-display').innerText = cashTotal.toLocaleString();
        if (document.getElementById('qr-display')) 
            document.getElementById('qr-display').innerText = qrTotal.toLocaleString();
        if (document.getElementById('total-count')) 
            document.getElementById('total-count').innerText = countItems.toLocaleString();

        // 4. จัดการต้นทุนและกำไร
        const costInput = document.getElementById('daily-cost');
        const summary = await db.dailysummary.get(todayStr);
        let dailyCost = parseFloat(costInput?.value) || summary?.daily_investment || parseFloat(localStorage.getItem('myDailyCost')) || 0;
        
        if (costInput && costInput.value === "") costInput.value = dailyCost;
        
        const netProfit = total - dailyCost;
        if (typeof updateProfitStatusDisplay === 'function') updateProfitStatusDisplay(netProfit);

        // 5. บันทึกข้อมูลสรุปประจำวัน
        const summaryData = {
            summary_date: todayStr,
            total_sales: total,
            total_count: countItems,
            daily_investment: dailyCost,
            net_profit: netProfit
        };

        summary ? await db.dailysummary.update(todayStr, summaryData) : await db.dailysummary.put(summaryData);

        console.log(`🚀 [Dashboard Sync] สำเร็จ: ยอดรวม ${total} | ไข่ ${countItems}`);

    } catch (err) { 
        console.error("❌ เกิดข้อผิดพลาดในการดึงยอดขาย:", err); 
    }
}

// ✨ ฟังก์ชันใหม่สำหรับเปลี่ยน "⚠️ รอคำนวณ" เป็น "กำไรสีเขียวๆ" - ถอนสไตล์ออกจาก JS ปลอดภัยระยะยาว
function updateProfitStatusDisplay(profit) {
    const statusDiv = document.getElementById('profit-status');
    if (!statusDiv) return; // 🔒 เกราะป้องกันระบบเผื่อ Element ตัวนี้ยังไม่พร้อมทำงาน

    if (profit > 0) {
        statusDiv.innerHTML = `
            <div class="profit-badge is-surplus">
                🎉 กำไรวันนี้: ${profit.toLocaleString()} บาท
            </div>`;
    } else if (profit < 0) {
        statusDiv.innerHTML = `
            <div class="profit-badge is-deficit">
                📉 ยังไม่คืนทุน: อีก ${Math.abs(profit).toLocaleString()} บาท
            </div>`;
    } else {
        statusDiv.innerHTML = `
            <div class="profit-badge is-break-even">
                ⚖️ เท่าทุนพอดี
            </div>`;
    }
}

function resetOrder() {
    // 🚩 แปะเพิ่มตรงนี้เพื่อดักจับตัวการซ่อนแอบ
    console.warn("⚠️ [จับไต๋บั๊ก] resetOrder() ถูกสั่งให้ทำงานซ้อนขึ้นมา!");
    console.trace();

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
        // 1. บันทึกลง Dexie (ตาราง settings) 
        await db.settings.put({ key: 'totalTables', value: count });

        // 2. บันทึกลง localStorage (แผนสำรอง - จุดนี้แหละที่ฟังก์ชัน 2 เอาไปใช้ดักความปลอดภัย!)
        localStorage.setItem('totalTables', count);

        // 3. วาดปุ่มโต๊ะใหม่ที่หน้าหลักทันที
        if (typeof renderTableSelection === "function") {
            await renderTableSelection(); 
        }
        
        // 4. แสดงการแจ้งเตือนที่ชัดเจน
        alert(`✅ บันทึกจำนวนโต๊ะเป็น ${count} โต๊ะเรียบร้อยครับ! \n(ยายสามารถเลือกโต๊ะที่หน้าหลักได้เลย)`);

    } catch (err) {
        console.error("❌ บันทึกจำนวนโต๊ะล้มเหลว:", err);
        localStorage.setItem('totalTables', count); 
        alert("⚠️ บันทึกข้อมูลลงฐานข้อมูลหลักไม่สำเร็จ แต่ระบบจำค่าไว้ชั่วคราวให้แล้วครับ");
    }
}

// 2. ฟังก์ชันวาดปุ่มเลือกโต๊ะที่หน้าแรก (หน้าขาย) - แยกดีไซน์ออกจาก JS ถาวร 09-06-2026
async function renderTableSelection() {
    const container = document.getElementById('table-selection-area'); 
    if (!container) return;

    // --- 1. [ส่วนดึงข้อมูล] ดึงจำนวนโต๊ะจากจุดที่ปลอดภัยที่สุด ---
    let total = 0;
    try {
        const tableSetting = await db.settings.get('totalTables');
        if (tableSetting && tableSetting.value) {
            total = parseInt(tableSetting.value);
        } else {
            total = parseInt(localStorage.getItem('totalTables')) || 0;
            if (total > 0) {
                await db.settings.put({ key: 'totalTables', value: total });
            }
        }
    } catch (err) {
        console.error("❌ เข้าถึงฐานข้อมูลไม่ได้:", err);
        total = parseInt(localStorage.getItem('totalTables')) || 0;
    }

    container.innerHTML = ''; // ล้างปุ่มเก่าเพื่อวาดใหม่ตามสถานะล่าสุด

    // --- 2. [ดึงสถานะบิลค้าง] ตรวจสอบจากฐานข้อมูลจริง ---
    let activeTableIds = [];
    try {
        const activeTables = await db.active_tables.toArray();
        activeTableIds = activeTables.map(t => String(t.table_id));
    } catch (err) {
        console.error("❌ ดึงสถานะโต๊ะไม่ได้:", err);
    }

    // --- 3. [วนลูปวาดปุ่ม] กำหนดป้ายคลาสตามเงื่อนไขชีวิตจริง (ขาว/ส้ม/เขียว) ---
    for (let i = 1; i <= total; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        const currentIdStr = String(i); 
        
        const hasBill = activeTableIds.includes(currentIdStr); 
        const isSelected = (String(selectedTable) === currentIdStr); 

        btn.innerText = "โต๊ะ " + i;
        
        // 🟢 เริ่มต้นสวมคลาสปุ่มโต๊ะมาตรฐานสากลจาก CSS
        btn.className = 'table-btn';
        
        // แปะคลาสสถานะย่อยตามเงื่อนไข โดยตัวไอคอนและสีจะดีดเปลี่ยนตามพลังของ CSS ทันที
        if (isSelected) {
            btn.classList.add('is-active-select'); // สวมป้ายสีเขียวเด่นชัด
        } else if (hasBill) {
            btn.classList.add('has-pending-bill'); // สวมป้ายสีส้มแจ้งยอดบิลค้าง
        }

        // เมื่อกดปุ่ม ให้ไปรันฟังก์ชันตรรกะคำนวณเป้าหมายตามเดิมเป๊ะ 100%
        btn.onclick = () => selectTable(i);
        
        container.appendChild(btn);
    }
}

// ฟังก์ชันสำหรับเวลากดกลับมาขายหน้าร้าน (Walk-in) - คลีน UI ป้องกันบั๊กสีหลอน 09-06-2026
async function selectWalkIn() {
    console.log("🛒 [Mode Switch] สลับไปโหมดขายหน้าร้าน (Walk-in) -> เริ่มล้างสถานะข้อมูลเชิงลึกและปรับ UI");

    // =========================================================================
    // 🧠 ส่วนที่ 1: เคลียร์โต๊ะ "จองทิพย์" ในฐานข้อมูล (Dexie DB)
    // =========================================================================
    if (typeof selectedTable !== 'undefined' && selectedTable) {
        try {
            if (typeof db !== 'undefined' && db.active_tables) {
                const tableData = await db.active_tables.get(selectedTable);
                if (!tableData || !tableData.order_items || tableData.order_items.length === 0) {
                    await db.active_tables.delete(selectedTable);
                    console.log(`🧹 เคลียร์โต๊ะ ${selectedTable} ออกจากฐานข้อมูลเรียบร้อยเนื่องจากเป็นโต๊ะว่าง`);
                }
            }
        } catch (err) {
            console.error("❌ เกิดข้อผิดพลาดในการตรวจสอบฐานข้อมูลโต๊ะ:", err);
        }
    }

    // =========================================================================
    // 📦 ส่วนที่ 2: จัดระเบียบความจำหลังบ้าน (RAM State Reset)
    // =========================================================================
    selectedTable = null;               // 🚩 ตัดขาดจากระบบโต๊ะเดิมในร้าน
    window.isCheckingOutTable = null;   // 🚩 ล้างสถานะการค้างหน้าจอเช็คบิลของโต๊ะก่อนหน้า ป้องกันบิลซ้อน
    
    if (typeof cart !== 'undefined') {
        cart = [];                      // 🚩 ล้างตะกร้าอาหารให้โล่งบริสุทธิ์ พร้อมรับออเดอร์ใหม่
    }

    // =========================================================================
    // 🔄 ส่วนที่ 3: สั่งให้ระบบอื่น ๆ วาดหน้าจอของตัวเองให้เสร็จก่อน (UI Sync Background)
    // =========================================================================
    if (typeof renderTableSelection === 'function') {
        await renderTableSelection(); 
    }

    if (typeof updateOrderPreview === 'function') {
        updateOrderPreview();
    }

    // 🟢 เปลี่ยนจากการยัด style.display มาเป็นการสวมคลาสซ่อนสากลแทน คลีนสุดๆ
    const billingBox = document.getElementById('pending-billing-box');
    if (billingBox) billingBox.classList.add('stg-hidden');

    // ล้างคลาสไฮไลท์สีเขียวออกจากทุกปุ่มโต๊ะ
    document.querySelectorAll('.table-btn').forEach(btn => {
        btn.classList.remove('is-active-select', 'active'); 
    });

    // =========================================================================
    // 🖥️ ส่วนที่ 4: 🔥 [สยบบั๊กสีส้มหลอน] ควบคุมผ่านคลาสสถานะจาก CSS เกลี้ยงเกลา 100%
    // =========================================================================
    const display = document.getElementById('current-table-display');
    if (display) {
        display.innerText = "📍 กำลังขาย: หน้าร้าน (Walk-in)";
        // 🟢 ถอดคลาสสีส้ม/สีอื่น ๆ ของระบบโต๊ะออก แล้วสวมคลาสสีกรมท่าหน้าร้านจาก CSS ทันที
        display.className = 'table-display-walkin'; 
    }
    
    // ซ่อนปุ่มฝากลงโต๊ะทันทีผ่านคลาสซ่อนสากล เพราะโหมดกลับบ้านต้องจ่ายเงินเลย
    const btnToTable = document.getElementById('btn-to-table');
    if (btnToTable) {
    btnToTable.classList.remove('stg-hidden'); // ถอดคลาสซ่อนออกให้หมด
    btnToTable.style.display = 'block';        // บังคับให้แสดงตัวทันที
}
    // แต่งปุ่มโหมดขายหน้าร้านให้เด่นชัดผ่านคลาสสถานะแอคทีฟ
    const btnTakeaway = document.getElementById('btn-takeaway');
    if (btnTakeaway) {
        btnTakeaway.classList.add('btn-takeaway-mode', 'is-active-walkin');
    }

    console.log("🥡 [Done] ระบบนิ่ง 100% สลัดป้ายสีส้มโต๊ะเก่าทิ้ง และสวมสีกรมท่าหน้าร้านเรียบร้อย");
}


/**
 * ฟังก์ชันเลือกโต๊ะ (ฉบับลดอาการกระพริบ UI และจัดการข้อมูลค้าง)
 * ปรับปรุงล่าสุด: 12-05-2026
 */
/**
 * ฟังก์ชันเลือกโต๊ะ: ดึงของเก่าจาก DB มามาร์คป้าย เพื่อป้องกันการสั่งซ้ำ
 */
async function selectTable(tableId) {
    // 1. 🛡️ เตรียมข้อมูลตัวเลขโต๊ะให้เป๊ะ (String เสมอ)
    const targetTable = String(tableId);

    try {
        // 🚩 ดึงข้อมูลจาก DB มาเช็กสถานะล่าสุดของโต๊ะนี้
        const tableData = await db.active_tables.get(targetTable);

        // 2. 🎨 อัปเดตสถานะ Global และ UI ส่วนหัว
        selectedTable = targetTable; 
        const display = document.getElementById('current-table-display');
        
        if (display) {
            display.innerText = "📍 กำลังจัดการ: โต๊ะ " + targetTable;
            // 🟢 เปลี่ยนจากการยัดสไตล์สด มาเป็นการสวมคลาสสถานะเริ่มต้น (สีเขียว)
            display.className = 'table-display-green';
        }

        // 3. 🔍 จัดการข้อมูลในตะกร้า (Cart Management)
        if (tableData && Array.isArray(tableData.order_items)) {
            console.log(`🏠 โต๊ะ ${targetTable}: พบออเดอร์เดิม -> สั่งติดป้ายป้องกันการส่งซ้ำ...`);

            // 🏷️ [จุดพิชิตใจยายและระบบ]:
            cart = tableData.order_items.map(item => {
                const nameWithCheck = item.name.startsWith('✅') ? item.name : '✅ ' + item.name;
                
                return {
                    ...item,
                    name: nameWithCheck, // 🚩 ยายเห็นป้าย ✅ จะได้รู้ว่าเสิร์ฟแล้ว
                    fromDB: true        // 🚩 ระบบเห็นป้ายนี้ จะไม่ส่งเข้าครัวซ้ำ (กันออเดอร์เบิ้ล)
                };
            });
            
            // 🟢 เปลี่ยนสีหัวข้อเป็น "สีส้ม" ผ่านคลาสจาก CSS ทันทีเมื่อตรวจพบออเดอร์ค้าง (สยบบั๊กสีหลอน)
            if (display) {
                display.className = 'table-display-orange';
            }

        } else {
            // ถ้าเป็นโต๊ะว่าง (ไม่มีข้อมูลใน DB)
            console.log(`🆕 โต๊ะ ${targetTable}: เป็นโต๊ะว่าง`);
            cart = []; // ล้างตะกร้าให้โล่งเพื่อเริ่มรับลูกค้าใหม่
        }

        // 4. 🔥 [จุดปราบกระพริบ]: สั่งวาดหน้าจอรายการอาหาร (Preview)
        if (typeof updateOrderPreview === 'function') {
            updateOrderPreview(); 
        }

        // 5. 💰 จัดการ Billing Box (สรุปยอดเงินด้านล่าง)
        const billingBox = document.getElementById('pending-billing-box');
        if (cart.length > 0) {
            if (typeof refreshBillingBox === 'function') {
                await refreshBillingBox(targetTable); 
            }
            // 🟢 ควบคุมเปิด-ปิดผ่านคลาสสากลแทนการเขียนสไตล์อินไลน์ตรง ๆ
            if (billingBox) billingBox.classList.remove('stg-hidden');
        } else {
            if (billingBox) billingBox.classList.add('stg-hidden');
        }
        
        // 6. 🎨 รีเฟรชสีปุ่มผังโต๊ะ (อัปเดตสถานะ เขียว/ส้ม/ขาว ทันที)
        if (typeof renderTableSelection === 'function') {
            await renderTableSelection();
        }

        console.log(`✅ [Done] เลือกโต๊ะ ${targetTable} สำเร็จ (คัดกรองของเก่าเรียบร้อย)`);

    } catch (err) {
        console.error("❌ บั๊กใน selectTable:", err);
        cart = [];
        if (typeof updateOrderPreview === 'function') updateOrderPreview();
        alert("ยายจ๋า! โหลดข้อมูลโต๊ะพลาด: " + err.message);
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

        //ระบบ P2P 09-05-2026
        executeOrderSent();

    } catch (err) {
        console.error("เกิดข้อผิดพลาดในการหย่อนบิล:", err);
        alert("อุ้ย! บันทึกลงโต๊ะไม่ได้ ตรวจสอบฐานข้อมูลทีครับ");
    }
}

// ฟังก์ชัน: แสดงรายการอาหารที่ค้างอยู่ในโต๊ะ (Pending Billing Box)
// ทำงานเมื่อ: จิ้มเลือกโต๊ะที่มีออเดอร์ค้างอยู่ 09-06-2026
// ==========================================
async function refreshBillingBox(tableId) {
    // ดึง Element ต่างๆ มาเตรียมไว้
    const box = document.getElementById('pending-billing-box');
    const listContainer = document.getElementById('billing-items-list');
    const title = document.getElementById('billing-table-title');
    const totalDisplay = document.getElementById('billing-total-amount');

    // นำเข้าฟังก์ชันป้องกันตรรกะผิดพลาด (Normalize Table Name) เพื่อความรอบคอบ
    const cleanTableId = tableId ? String(tableId).trim() : '';

    // 🛑 [ดักด่านแรก]: ถ้าส่งค่าเป็นโหมดกลับบ้าน หรือไม่มี ID โต๊ะส่งมา ให้สั่งซ่อนกล่องและปิดงานทันที
    if (!cleanTableId || cleanTableId === "กลับบ้าน" || cleanTableId === "ทั่วไป") {
        if (box) box.classList.add('stg-hidden');
        return;
    }

    // 1. ดึงข้อมูลล่าสุดจากฐานข้อมูล active_tables
    const tableData = await db.active_tables.get(cleanTableId);

    // 2. ตรวจสอบโครงสร้างเบื้องต้น: ถ้าไม่มีข้อมูลโต๊ะ หรือไม่มีอาเรย์อาหารให้หยุดทันที
    if (!tableData || !tableData.order_items || tableData.order_items.length === 0) {
        if (box) box.classList.add('stg-hidden'); 
        return; 
    }

    // =========================================================================
    // 🧠 [จุดปรับปรุงรอบคอบสูงสุด]: คำนวณยอดเงินทดสอบก่อนเปิดกล่อง UI
    // =========================================================================
    let checkTotal = 0;
    tableData.order_items.forEach(item => {
        checkTotal += (parseFloat(item.price) || 0) * (parseInt(item.qty) || 1);
    });

    // 🛑 [ด่านสกัดวิญญาณหลอน]: ถ้ายอดสุทธิได้ 0.- หรือติดลบ สั่งซ่อนกล่องทันที ห้ามเด้งให้ยายรำคาญ
    if (checkTotal <= 0) {
        if (box) box.classList.add('stg-hidden');
        console.log(`🧹 [Anti-Ghost] บล็อกบิลเปล่าของโต๊ะ ${cleanTableId} ไม่ให้เด้งรบกวนหน้าร้าน`);
        return;
    }

    // =========================================================================
    // 🖥️ ส่วนที่ 3: ผ่านการตรวจสอบทุกด่าน -> แสดงผลบิลจริง
    // =========================================================================
    // ถอดคลาสซ่อนออก เพื่อเปิดหน้าต่างบิลขึ้นมาแสดงผลนิ่งๆ
    if (box) box.classList.remove('stg-hidden');
    if (title) title.innerText = `📝 รายการค้างชำระ โต๊ะ ${cleanTableId}`;

    // เริ่มกระบวนการวาดรายการอาหารใหม่
    if (listContainer) {
        listContainer.innerHTML = ''; // ล้าง HTML เก่าทิ้ง
        let total = 0;

        // วนลูปวาดรายการจากอาร์เรย์ order_items ลงบนหน้าจอจริง
        tableData.order_items.forEach((item, index) => {
            const itemRow = document.createElement('div');
            
            // 🟢 เปลี่ยนจากการพ่น style อินไลน์หนาเตอะ มาเป็นการแปะชื่อคลาสกลางจาก CSS ตัวเดียวจบ!
            itemRow.className = 'billing-item-row';
            
            const currentQty = item.qty || 1;
            const itemPriceSum = item.price * currentQty;

            // HTML โครงสร้างสะอาดสะอ้าน ไร้สารสไตล์ปนเปื้อนสายตา
            itemRow.innerHTML = `
                <div class="billing-item-info">
                    <span class="billing-item-name">${item.name}</span>
                    ${item.options ? `<span class="billing-item-options">- ${item.options}</span>` : ''}
                    <span class="billing-item-qty">x${currentQty}</span>
                </div>
                <div class="billing-item-price">
                    ${itemPriceSum.toLocaleString()}.-
                </div>
            `;
            
            listContainer.appendChild(itemRow);
            total += itemPriceSum;
        });

        // แสดงยอดรวมที่คำนวณได้จริง
        if (totalDisplay) {
            totalDisplay.innerText = `${total.toLocaleString()}.-`;
        }
    }
}

//หย่อนบิลสั่งอาหาร 28-05-2026
// 🚩 เพิ่มพารามิเตอร์ warpData (ข้อมูลออเดอร์) และ isFromWarp (เช็คว่ามาจากวาร์ปไหม)

/**
 * ฟังก์ชันฝากออเดอร์ลงโต๊ะ: 
 * บันทึกของใหม่รวมกับของเก่าใน DB และส่งเฉพาะของใหม่เข้าครัว
 */
async function saveOrderToTable(warpData = null, isFromWarp = false) {
    
    // =========================================================================
    // --- STEP 1: เตรียมข้อมูลตั้งต้นและตรวจสอบความถูกต้องของโต๊ะ (Input Validation) ---
    // =========================================================================
    
    // ดึงค่าตั้งต้น: ถ้าข้อมูลวาร์ปมาจากเน็ตเวิร์ก ให้ใช้ค่าที่ส่งมาในกล่องข้อมูล (warpData)
    // แต่ถ้าพนักงานกดหน้าร้านเอง ให้ใช้ค่าจากตัวแปร Global `selectedTable` ที่เลือกอยู่ปัจจุบัน
    let tableVal = isFromWarp ? (warpData ? warpData.table : null) : selectedTable;

    // =========================================================================
    // 🚨 [ระบบสับรางเปลี่ยนเลขโต๊ะฉุกเฉิน] (ทำงานเฉพาะตอนพนักงานกดสั่งเองหน้าร้าน)
    // =========================================================================
    if (!isFromWarp && tableVal) {
        const currentCheckTable = normalizeTableName(tableVal);
        const alertMsg = `🚨 ตรวจสอบเบอร์โต๊ะก่อนฝากรายการเข้าครัวครับ!\n\n📌 กำลังจะส่งออเดอร์ชุดนี้ไปที่: "${currentCheckTable}"\n\nแน่ใจใช่ไหมครับว่าเลือกโต๊ะไม่ผิด?`;
        
        // แสดงกล่องข้อความเตือนพนักงานให้ทบทวนเลขโต๊ะก่อนยิงเข้าครัว
        const isUserSure = confirm(alertMsg);
        
        // 🛑 เคสที่พนักงานไหวตัวทัน: "เห้ย กดผิดโต๊ะ!" แล้วกดยกเลิก (Cancel) เพื่อสับรางเปลี่ยนโต๊ะ
        if (!isUserSure) {
            console.log("🛑 พนักงานกด Cancel! ระบบระงับออเดอร์เดิม และเปิดช่องสลับเลขโต๊ะทันที");
            
            // ดึงจำนวนโต๊ะสูงสุดของร้านจาก localStorage เพื่อใช้ดักจับข้อมูลมั่ว
            const maxTablesAllowed = parseInt(localStorage.getItem('totalTables')) || 10;
            
            // เปิดกล่อง Prompt รับเลขโต๊ะที่ถูกต้องจากพนักงาน
            const userInputNewTable = prompt(`🔄 ยายเลือกผิดโต๊ะใช่ไหมครับ?\nป้อนเลขโต๊ะใหม่ที่ถูกต้อง (พิมพ์เลข 1 ถึง ${maxTablesAllowed} หรือพิมพ์ 'กลับบ้าน'):`);
            
            if (userInputNewTable !== null && userInputNewTable.trim() !== "") {
                let cleanNewInput = userInputNewTable.trim();
                
                // ตรวจสอบความปลอดภัยระดับโครงสร้างข้อมูล
                if (cleanNewInput !== "กลับบ้าน") {
                    const parsedNumber = parseInt(cleanNewInput);
                    
                    // ดักจับกรณีพนักงานป้อนมั่ว หรือระบุเลขโต๊ะเกินโครงสร้างแอป
                    if (isNaN(parsedNumber) || parsedNumber <= 0 || parsedNumber > maxTablesAllowed) {
                        alert(`⚠️ [ปฏิเสธการเปลี่ยน] เลขโต๊ะไม่ถูกต้อง! ร้านยายตั้งค่าไว้แค่ ${maxTablesAllowed} โต๊ะเท่านั้นครับ (รายการในตะกร้ายังปลอดภัยเหมือนเดิม)`);
                        return; // ↩️ ดีดตัวกลับหน้าจอสั่งอาหารทันที โดยไม่ล้างข้อมูลใด ๆ เพื่อให้พนักงานป้อนใหม่ได้
                    }
                    
                    // 🎯 [จุดปรับปรุงหลัก]: บังคับจัดฟอร์แมตให้เป็นตัวเลข String โดด ๆ (เช่น "1") 
                    // เพื่อล้อไปกับมาตรฐานคีย์หลักในตาราง active_tables ของฟังก์ชันอื่น ๆ
                    cleanNewInput = String(parsedNumber); 
                }
                
                console.log(`🎯 [Reroute Success] สับรางออเดอร์สำเร็จ ย้ายเป้าหมายปลายทางไปเข้าสู่เบอร์: ${cleanNewInput}`);
                
                // สับเปลี่ยนค่าตัวแปรหลักภายในฟังก์ชันนี้ให้กลายเป็น "โต๊ะใหม่ที่ถูกต้อง"
                tableVal = cleanNewInput; 
                
            } else {
                console.log("↩️ พนักงานกดยกเลิกการป้อนเลขใหม่ ดีดตัวกลับหน้าจอเดิมโดยคาตะกร้าไว้ตามเดิม");
                return; 
            }
        }
    }
    // =========================================================================

    // ตรวจสอบความปลอดภัยชั้นสุดท้าย: ป้องกันข้อมูลบิลหลุดลอยไปหาโต๊ะว่าง (Null Pointer)
    if (!tableVal || tableVal === "null" || tableVal === "undefined" || String(tableVal).trim() === "") {
        console.error("❌ [Abort] ไม่พบเลขโต๊ะปลายทาง ระบบปฏิเสธการบันทึกเพื่อป้องกันข้อมูลสูญหาย");
        if (!isFromWarp) alert("ยายจ๋า! กรุณาเลือกโต๊ะก่อนฝากรายการนะจ๊ะ");
        return; 
    }

    // 🎯 [จุดอุดรอยรั่วที่ 1]: สกัดข้อความ "โต๊ะ " ออกให้หมด ให้เหลือเฉพาะคีย์สะอาด (เช่น "1" หรือ "กลับบ้าน")
    // เพื่อให้ตอนสั่ง db.active_tables.get(targetTable) มันสามารถวิ่งชนคีย์ตัวเลขเดียวกับบิลเก่าของระบบได้ 100% บิลไม่แยกเงา
    const targetTable = String(tableVal).replace("โต๊ะ ", "").trim(); 
    
    // ดึงก้อนออเดอร์จากตะกร้าปัจจุบัน (คงโครงสร้างวัตถุเดิมไว้ครบถ้วนเพื่อความปลอดภัยของข้อมูล)
    const currentCartItems = isFromWarp ? (warpData.items || []) : [...cart];
    
    // 🚩 คัดกรองเอาเฉพาะอาหารจานใหม่แกะกล่องที่พนักงานเพิ่งเคาะสั่งเพิ่มเท่านั้น (!item.fromDB)
    // 💥 ผลลัพธ์เชิงลอจิก: ตะกร้าที่แอบติด เกาเหลา 1 (จากบิลโต๊ะ 3 เก่า) จะโดนเตะทิ้ง เหลือเฉพาะ "กากเจียว 2" วิ่งไปรวมร่าง
    const newItemsOnly = currentCartItems.filter(item => !item.fromDB);

    // ดักจับเคสตะกร้าว่างเปล่า เพื่อป้องกันพนักงานกดปุ่มส่งซ้ำซ้อน
    if (newItemsOnly.length === 0) {
        console.log("ℹ️ ไม่มีรายการอาหารใหม่ที่จะบันทึก");
        if (!isFromWarp) alert("รายการเหล่านี้สั่งไปหมดแล้วจ้ายาย!");
        return;
    }

    try {
        console.log(`💾 [IndexedDB] เริ่มกระบวนการคุมบัญชีโต๊ะ: ${targetTable} (จำนวนอาหารใหม่ที่จะเพิ่ม: ${newItemsOnly.length} รายการ)`);

        // =========================================================================
        // --- STEP 2: กลไกการควบรวมบิลในฐานข้อมูลภายในเครื่อง (The Core Database Merge) ---
        // =========================================================================
        
        // 1. วิ่งไปค้นหาข้อมูล "บิลเดิม" ของโต๊ะปลายทางที่สับรางไป (เช่น ดึงบิลเก่าของ โต๊ะ 1 ที่มี เส้นเล็กหมูน้ำตก 1 อยู่แล้ว)
        const existingRecord = await db.active_tables.get(targetTable);
        
        // 2. ตั้งต้นอาเรย์ผลลัพธ์: ถ้าโต๊ะปลายทางมีบิลเก่าอยู่แล้ว ให้กางอาเรย์เดิมรอไว้ แต่ถ้าเป็นโต๊ะว่างให้เริ่มจากอาเรย์เปล่า `[]`
        let finalItems = (existingRecord && Array.isArray(existingRecord.order_items)) 
            ? [...existingRecord.order_items] 
            : [];

        // 3. วนลูปจับเอาเฉพาะ "กากเจียว 2" (อาหารสั่งใหม่) มาแสตมป์ตราล็อกฐานข้อมูล (fromDB = true)
        // แล้วใช้ฟังก์ชัน .push() ยัดเข้าอาเรย์รวมร่างของโต๊ะปลายทางโดยตรง รักษาโครงสร้าง Object ของระบบเดิมไว้ครบถ้วน
        newItemsOnly.forEach(newItem => {
            finalItems.push({
                ...newItem,
                fromDB: true 
            });
        });

        // 4. บันทึกบิลก้อนบวกรวมชุดใหม่ [เส้นเล็กหมูน้ำตก 1 + กากเจียว 2] อัปเดตกลับลงไปที่ Dexie ภายในเครื่องตัวเอง
        await db.active_tables.put({
            table_id: targetTable,
            order_items: finalItems,
            last_update: new Date().toISOString() 
        });

        // =========================================================================
        // --- STEP 3: การจัดการเครือข่ายและการกระจายสัญญาณวาร์ป (P2P Network Handling) ---
        // =========================================================================
        
        // ประทับตราอาหารก้อนใหม่ให้เป็นของจากฐานข้อมูล เพื่อเตรียมส่งสัญญานไปสั่งพิมพ์ในห้องครัว
        const markedKitchenItems = newItemsOnly.map(item => ({ ...item, fromDB: true }));

        if (!isFromWarp) {
            
            // 📤 [พฤติกรรมฝั่งเครื่องลูก]: ยิงข้อมูลส่งวาร์ปออเดอร์ชุดใหม่ไปพิมพ์ออกที่ห้องครัว
            // 💥 ผลลัพธ์: ตัวแปรส่งเข้าครัวคือ markedKitchenItems ซึ่งมีแต่ "กากเจียว 2" ยิงไปที่เบอร์โต๊ะที่ถูกต้อง ครัวทำของไม่พลาด!
            if (typeof executeOrderSent === "function") {
                executeOrderSent(false, {
                    items: markedKitchenItems, 
                    table: targetTable === "กลับบ้าน" ? "กลับบ้าน" : `โต๊ะ ${targetTable}` // ปรับชื่อส่งออกอากาศให้ครัวอ่านง่าย
                }); 
            }

            alert(`📥 ฝากออเดอร์และควบรวมเข้าบิล โต๊ะ ${targetTable} เรียบร้อยแล้วจ้า!`);

            // 🎯 [จุดอุดรอยรั่วที่ 2 - แก้ไข Race Condition]:
            // 🛑 ลบโค้ดเดิม (cart = []; selectedTable = null; updateOrderPreview();) ทิ้งไป
            // 🔄 แทนที่ด้วยการส่งไม้ต่อให้ฟังก์ชัน `selectTable` บังคับเปิดหน้าจอจัดการโต๊ะปลายทางขึ้นมาทำงานต่อทันที
            // วิธีนี้จะสั่งให้แอปพลิเคชันกระโดดไปโฟกัสที่ โต๊ะ 1 โหลดเอาบิลรวมร่างล่าสุด [เส้นเล็ก 1 + กากเจียว 2]
            // ขึ้นมาวาดบนหน้าจอตะกร้าหน้าจอ ยายเห็นยอดเงินขยับเพิ่มสด ๆ คาตา ผังโต๊ะเปลี่ยนเป็นสีส้มทันที ลื่นไหลที่สุดครับ!
            if (typeof selectTable === "function") {
                await selectTable(targetTable);
            } else {
                // เคสสำรองกันเหนียว: ถ้าหาฟังก์ชัน selectTable ไม่เจอ ให้รีเซ็ตแบบปลอดภัยเพื่อไม่ให้แอปพลิเคชันค้าง
                cart = [];
                selectedTable = null;
                if (typeof updateOrderPreview === "function") updateOrderPreview();
                if (typeof renderTableSelection === "function") await renderTableSelection();
            }

            // ⚡ [ระบบสัญญาณ Auto-Sync]: แจ้งเครื่องอื่น ๆ ในร้านให้ปรับเปลี่ยนสถานะและสีผังโต๊ะตามเรียลไทม์
            if (typeof sendP2PData === 'function') {
                const identity = typeof getCurrentIdentity === 'function' ? getCurrentIdentity() : 'client';
                if (identity === 'client') {
                    sendP2PData({ type: 'TABLE_SYNC_REQUEST' });
                }
            }

        } else {
            
            // 🏠 [พฤติกรรมฝั่งเครื่องแม่ เมื่อรับข้อมูลวาร์ปมาจากเน็ตเวิร์ก]:
            console.log(`✅ [Master Hub] ระบบรับสัญญาณวาร์ปและทำการรวมร่างบิลเข้าสู่ ${targetTable} เรียบร้อย`);
            
            // แสดงหน้าต่างแอนิเมชันแจ้งเตือนมุมจอเครื่องแม่ให้แคชเชียร์รู้ตัวว่ามีของกินสั่งเพิ่มเข้ามานะ
            if (markedKitchenItems.length > 0 && typeof showOrderNotify === 'function') {
                showOrderNotify(`[โต๊ะ ${targetTable}] มีรายการสั่งเพิ่มเข้ามาใหม่!`);
            }

            // สั่งกระจายข่าวซิงค์สีผังโต๊ะส่งกลับไปให้เครื่องลูกตัวอื่น ๆ ในวงเครือข่ายรับรู้สถานะสีปุ่มล่าสุด
            if (typeof responseTableSync === 'function') {
                await responseTableSync();
            }

            // สั่งเครื่องแม่วาดสีปุ่มผังโต๊ะของเครื่องตัวเองใหม่ทันที (โต๊ะปลายทางจะกระพริบเปลี่ยนเป็นสีส้มแจ้งเตือนว่ามีเงินค้าง)
            if (typeof renderTableSelection === "function") await renderTableSelection(); 
            
            // 🔥 [จุดเสริมแกร่งเครื่องแม่]: ถ้าเครื่องแม่กำลังเปิดหน้ารวมบิลค้างชำระของโต๊ะนั้นดูอยู่พอดี
            // สั่งให้กล่องบิลด้านล่างโหลดข้อมูลขึ้นมาวาดใหม่ทันที ยอดเงินบนเครื่องแม่จะขยับตามออเดอร์เครื่องลูกทันทีโดยไม่ต้องกดรีเฟรช
            if (typeof refreshBillingBox === "function") {
                await refreshBillingBox(targetTable);
            }
        }
        
    } catch (err) {
        console.error("❌ บั๊กที่เกิดในฟังก์ชัน saveOrderToTable:", err);
        if (!isFromWarp) alert("เกิดข้อผิดพลาดที่ระบบฐานข้อมูลภายใน: " + err.message);
    }
}

// ฟังก์ชันปิดกล่อง (เมื่อต้องการเคลียร์หน้าจอ) 29-04-2026
function closeBillingBox() {
    document.getElementById('pending-billing-box').style.display = 'none';
    selectedTable = null;
    renderTableSelection(); // รีเฟรชสีปุ่มโต๊ะ
}

// ==========================================
// ฟังก์ชัน: เช็คบิล (ดึงรายการจากโต๊ะกลับมาจ่ายเงิน)
// ทำงานเมื่อ: กดปุ่ม "💰 เช็คบิลเก็บเงิน" ในกล่องเก็บบิล 11-05-2026
// ==========================================
/**
 * ฟังก์ชันเตรียมเช็คบิล (ฉบับอัปเกรดเพื่อระบบ P2P)
 * หน้าที่: ดึงรายการทั้งหมดจากโต๊ะใน DB กลับมาที่ตะกร้าหลักเพื่อให้ยายกดรับเงิน
 * ปรับปรุงล่าสุด: 11-05-2026
 */
async function checkoutTable() {
    // 1. ตรวจสอบว่าเลือกโต๊ะหรือยัง
    if (!selectedTable || selectedTable === "null") {
        alert("กรุณาเลือกโต๊ะที่ต้องการเช็คบิลก่อนจ้า");
        return;
    }

    try {
        // 2. ดึงข้อมูลล่าสุดจากฐานข้อมูล active_tables
        const tableData = await db.active_tables.get(String(selectedTable));

        // ตรวจสอบว่าโต๊ะนี้มีของจริงไหม (กันเหนียว)
        if (!tableData || !tableData.order_items || tableData.order_items.length === 0) {
            alert(`โต๊ะ ${selectedTable} ไม่มีรายการอาหารค้างอยู่ครับ`);
            return;
        }

        // 3. ยืนยันกับยายอีกครั้งเพื่อความชัวร์
        if (confirm(`💰 เรียกเก็บเงิน โต๊ะ ${selectedTable} ใช่หรือไม่?`)) {
            
            // 🚩 [จุดหัวใจ]: ย้ายรายการจาก DB มาใส่ใน Cart หลัก
            // เราใช้ .map() เพื่อเติม flag 'fromDB' ให้ระบบรู้ว่าเป็นรายการเก่า (โชว์ ✅)
            cart = tableData.order_items.map(item => ({
                ...item,
                fromDB: true 
            }));

            // ⭐ [จุดสำคัญ]: ปักหมุดบอกระบบว่า "ตอนนี้เรากำลังอยู่ในโหมดปิดโต๊ะ"
            // ตัวแปรนี้จะถูกใช้ในฟังก์ชันบันทึกรับเงิน เพื่อสั่งลบโต๊ะออกจากระบบ P2P
            window.isCheckingOutTable = String(selectedTable); 

            // 4. สั่งวาดหน้าจอตะกร้าใหม่ (ยายจะเห็นรายการอาหารทั้งหมดโผล่มาพร้อมยอดรวม)
            if (typeof updateOrderPreview === 'function') {
                updateOrderPreview(); 
            }

            // 5. ปิดกล่องสถานะบิลค้าง (เพราะตอนนี้ข้อมูลย้ายมาอยู่ที่ตะกร้าหลักเพื่อรอจ่ายเงินแล้ว)
            const billingBox = document.getElementById('pending-billing-box');
            if (billingBox) {
                billingBox.style.display = 'none';
            }
            
            // 6. UI Feedback: เลื่อนหน้าจอไปที่ตะกร้าเพื่อให้ยายเห็นปุ่มรับเงินชัดๆ
            const orderTotalSection = document.getElementById('order-total-price');
            if (orderTotalSection) {
                orderTotalSection.scrollIntoView({ behavior: 'smooth' });
            }

            console.log(`✅ เตรียมปิดบิลโต๊ะ ${selectedTable}: ข้อมูลวาร์ปกลับเข้าตะกร้าเรียบร้อย`);
            alert(`ดึงรายการจาก โต๊ะ ${selectedTable} มาแล้วจ้า! \nยายตรวจสอบยอดแล้วกด "เงินสด" หรือ "โอน" ได้เลย`);
        }

    } catch (err) {
        console.error("❌ เกิดข้อผิดพลาดในการดึงข้อมูลเพื่อเช็คบิล:", err);
        alert("ขออภัยจ้ะยาย ระบบดึงข้อมูลโต๊ะพลาด: " + err.message);
    }
}

// ==========================================
// ฟังก์ชันกลาง: สำหรับบันทึกยอดขายและเคลียร์ข้อมูล 30-05-2026 เชื่อมระบบ P2P
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

        // --- 1. บันทึกรายการลงฐานข้อมูล Local (เครื่องไหนกดขาย เครื่องนั้นบันทึก) ---
        for (const item of cart) {
            await db.orders.add({
                order_id: orderId,
                menu_name: item.name,
                total_price: item.price,
                discount: item.discount || 0,
                options: item.options || "",
                created_at: createdAt,
                payment_method: paymentMethod,
                // 🌟 [ติดอาวุธใหม่]: บันทึกป้ายสถานะค้างส่งไว้ทันที เพื่อรอให้ระบบเช็กประวัติย้อนหลังมาล้างป้ายเมื่อซิงค์สำเร็จ
                sync_status: 'pending'
            });
        }
        console.log(`💾 [Local DB] บันทึกออเดอร์ ${orderId} ลงฐานข้อมูลเครื่องนี้เรียบร้อย (sync_status: 'pending')`);

        // --- 2. 🧹 ล้างข้อมูลระบบโต๊ะในฐานข้อมูล Local ของตนเอง ---
        let tableToWarp = "หน้าร้าน"; 
        if (selectedTable) {
            tableToWarp = String(selectedTable);
            await db.active_tables.delete(tableToWarp);
            console.log(`🧹 [Local DB] เคลียร์ข้อมูลโต๊ะ ${tableToWarp} ในเครื่องนี้เรียบร้อย`);
        }

        // --- 3. 🌟 [ระบบ P2P]: ยิงสัญญาณแจ้งทุกเครื่องในเครือข่าย ---
        if (typeof sendP2PData === "function") {
            const orderPayload = {
                type: 'ORDER_INCOMING',
                orderId: orderId,
                table: tableToWarp, 
                items: JSON.parse(JSON.stringify(cart)), // 🛡️ ทำ Deep Copy ป้องกัน Object อ้างอิงซ้อน
                isPayment: true, 
                payment_method: paymentMethod, 
                totalNet: cart.reduce((sum, item) => sum + (item.price - (item.discount || 0)), 0),
                time: createdAt
            };
            
            // วาร์ปข้อมูลออกสู่เน็ตเวิร์ก P2P สด ๆ ณ วินาทีที่ขาย (ถ้าหลุดเน็ต ท่อนนี้จะ Error หรือเงียบหายไป ซึ่งไม่มีผลเสีย)
            sendP2PData(orderPayload); 
            console.log(`📡 [P2P Warp] ส่งข้อมูลปิดบิลโต๊ะ ${tableToWarp} ไปยังเครือข่าย (isPayment: true)`);
        }

        // --- 4. 🧹 เคลียร์ Memory และ State ของระบบขาย (ทำหลังส่ง P2P เสร็จสิ้น) ---
        cart = []; 
        selectedTable = null; // ✅ ปลอดภัย ล้างสถานะตรงนี้เพื่อเตรียมรับออเดอร์ถัดไป

        // --- 5. 🎨 กวาดล้างและอัปเดต UI หน้าจอขาย ---
        const display = document.getElementById('current-table-display');
        if (display) {
            display.innerText = "📍 กำลังขาย: หน้าร้าน (Walk-in)";
            display.style.background = "#34495e"; 
        }

        const btnToTable = document.getElementById('btn-to-table');
        if (btnToTable) {
            btnToTable.style.display = 'none';
        }

        // สั่งวาดหน้าจอใหม่ทั้งหมดเพื่อสะท้อนสถานะล่าสุดทันที
        updateOrderPreview();    
        renderTableSelection(); 

        // --- 6. แสดงผลลัพธ์คิวอาร์โค้ด หรือแจ้งเตือนตามวิธีจ่ายเงิน ---
        if (paymentMethod === 'transfer') {
            if (typeof generateQRCode === 'function') generateQRCode();
        } else {
            alert("✅ บันทึกการขายเงินสดเรียบร้อย!");
        }

        // 🟢 รีเรนเดอร์หน้าจอความจำดวงใหม่สะท้อนยอดขายทันที
        if (typeof renderRecentOrdersUI === 'function') renderRecentOrdersUI();
        if (typeof renderTodayOrdersTableUI === 'function') renderTodayOrdersTableUI();

    } catch (err) {
        console.error("❌ เกิดข้อผิดพลาดในการปิดยอด:", err);
        alert("เกิดข้อผิดพลาดในการบันทึกยอดขาย!");
    }
}

// ==========================================
// วางระบบ P2P 07-05-2026
// ==========================================


/**
 * 🚀 ฟังก์ชันหลักในการวาร์ปข้อมูลส่งออกนอกเครื่องผ่านระบบ P2P ไร้สาย
 * แก้ไขล่าสุด: อัปเกรดระบบจัดรูปคำชื่อโต๊ะขาออก และบังคับล็อกรหัสไอดีดั้งเดิม 18-05-2026
 */
async function executeOrderSent(isPaymentMode = false, extraData = null) {
    console.log("🚀 [System] เริ่มกระบวนการ executeOrderSent...");

    // --- 0. เช็คสิทธิ์ด้วย Identity Detector ---
    const identity = typeof getCurrentIdentity === 'function' ? getCurrentIdentity() : 'single';
    
    // ถ้าสถานะเป็น single หรือ none จะไม่ส่งข้อมูลออกไปเพื่อประหยัดทรัพยากร
    if (identity === 'single' || identity === 'none') {
        console.log("ℹ️ [P2P Skip] โหมด Offline/Single: ไม่ต้องส่งข้อมูลหาเครื่องอื่น");
        return; 
    }

    console.log(`📡 [P2P Active] ตรวจพบร่างเป็น: ${identity} (โหมดจ่ายเงิน = ${isPaymentMode})`);

    // --- 1. เตรียมรายการอาหาร ---
    let itemsToSend = [];
    if (extraData && extraData.items) {
        itemsToSend = extraData.items;
    } else if (typeof cart !== 'undefined') {
        itemsToSend = [...cart];
    }

    // กรองเฉพาะรายการใหม่ (ถ้ามี)
    const newItemsOnly = (extraData && extraData.newOnly) 
                        ? extraData.newOnly 
                        : itemsToSend.filter(i => !i.fromDB);

    // 🛡️ [ป้องกัน Error]: หากไม่มีรายการอาหาร ห้ามวาร์ป (แก้ปัญหา Array(0) หน้างาน)
    if (itemsToSend.length === 0) {
        console.warn("⚠️ [Cancel] ไม่สามารถวาร์ปได้: ไม่มีรายการอาหารในตะกร้า");
        return;
    }

    // --- 2. รวบรวมข้อมูลออเดอร์ (Data Preparation) ---
    const method = extraData?.payment_method || extraData?.paymentType || 'Cash';
    
    // 🛡️ 🚩 [แก้ไขช่องโหว่สำคัญ - การล็อกรหัสไอดีดั้งเดิม]:
    let finalOrderId = extraData?.orderId || null;
    
    if (!finalOrderId) {
        if (isPaymentMode) {
            finalOrderId = Date.now();
        } else {
            finalOrderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        }
    }

    // [สแกนเนอร์ขัดเงาชื่อโต๊ะขาออก]:
    const rawTable = extraData?.table || (typeof selectedTable !== 'undefined' ? selectedTable : 'กลับบ้าน');
    const currentTable = normalizeTableName(rawTable);

    // 🧠 ✨ [อัปเกรดตรรกะตรวจจับส่วนลดเพื่อแพ็กลงกล่อง Payload ขาออก] ✨
    // สิ่งที่จะเกิดขึ้น: ดึงค่าส่วนลดบาทที่คัดลอก/ส่งต่อมาจาก confirmOrder มาเก็บเตรียมไว้ส่งออก
    let finalDiscount = 0;
    if (extraData && extraData.discount !== undefined) {
        finalDiscount = parseFloat(extraData.discount) || 0;
    }

    // 🧠 ✨ [อัปเกรดตรรกะคำนวณยอดเงินรวมส่งออกให้แม่นยำ] ✨
    // สิ่งที่จะเกิดขึ้น: หากเครื่องต้นทางส่งยอดสุทธิที่ลดแล้วมาให้ใน extraData.total_price หรือจากในบิล 
    // ให้ใช้ยอดนั้นทันที! แต่ถ้าเป็นออเดอร์สั่งอาหารธรรมดาที่ยังไม่คิดเงิน ค่อยใช้ระบบ .reduce บวกราคาสินค้าดิบ
    let finalTotalAmount = 0;
    if (isPaymentMode && extraData && (extraData.total_price !== undefined || extraData.total !== undefined)) {
        // ดึงราคาสุทธิที่ลดแล้วจากหน้าใบเสร็จมาใช้เลยโดยตรง ไม่ต้องบวกใหม่ให้บั๊ก
        finalTotalAmount = parseFloat(extraData.total_price || extraData.total || 0);
    } else {
        // กรณีออเดอร์ปกติที่ไม่มีส่วนลด ค่อยคำนวณยอดดิบรายชิ้นตามเดิม
        let rawCalculatedSum = itemsToSend.reduce((sum, item) => sum + (parseFloat(item.price) * (item.qty || item.quantity || 1)), 0);
        finalTotalAmount = Math.max(0, rawCalculatedSum - finalDiscount);
    }

    // แพ็กข้อมูลลงกล่องเตรียมวาร์ป
    const orderData = {
        type: 'ORDER_INCOMING', 
        table: String(currentTable), 
        items: JSON.parse(JSON.stringify(itemsToSend)), 
        newOnly: JSON.parse(JSON.stringify(newItemsOnly)), 
        orderId: finalOrderId, 
        time: new Date().toLocaleTimeString('th-TH'),
        discount: finalDiscount,       // ✨ [อุดรอยรั่วจุดที่ 1]: ส่งมูลค่าส่วนลดบาทวาร์ปข้ามเครื่องไปด้วยแล้ว!
        total: finalTotalAmount,        // ✨ [อุดรอยรั่วจุดที่ 2]: ส่งยอดราคาสุทธิที่หักส่วนลดแล้วแทนยอดดิบ!
        isPayment: isPaymentMode, 
        payment_method: method 
    };

    console.log("📦 [Payload] ข้อมูลพร้อมยิงออกนอกเครื่อง (อัปเดตระบบส่วนลดแล้ว):", orderData);

    // --- 3. วาร์ปข้อมูลออกเน็ตเวิร์ก (The Warp) ---
    try {
        if (typeof sendP2PData === 'function') {
            console.log("⚡ [Relay] กำลังส่งเข้าท่อส่งข้อมูลหลัก...");
            
            // ยิงข้อมูลออกสู่อากาศไร้สาย
            await sendP2PData(orderData); 

            console.log(`✅ [Success] วาร์ปข้อมูลสำเร็จ! ID อ้างอิง: ${orderData.orderId}`);

            if (typeof updateP2PStatusUI === 'function') {
                updateP2PStatusUI('วาร์ปข้อมูลสำเร็จ', '#2ecc71');
            }

            if (!isPaymentMode) {
                console.log("📢 ส่งออเดอร์ปกติไปหน้าครัว/เครื่องแม่เรียบร้อย");
            }
        } else {
            throw new Error("ไม่พบฟังก์ชัน sendP2PData ในระบบ");
        }
    } catch (err) {
        console.error("❌ [P2P Send Error]:", err);
        if (typeof updateP2PStatusUI === 'function') {
            updateP2PStatusUI('วาร์ปข้อมูลล้มเหลว', '#e74c3c');
        }
    }
}

/**
 * ฟังก์ชันช่วยอัปเดตสถานะบน UI 15-05-2026
 */
function updateP2PStatusUI(text, color) {
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    if (statusDot && statusText) {
        statusDot.style.backgroundColor = color; 
        statusText.innerText = text;
    }
}



//แถบสถานะ (Status Bar) 15-05-2026 CSS
/**
 * 🚩 [Master UI Logic] ฟังก์ชันอัปเดตป้ายสถานะตาม "หน้าจอจริง"
 * อัปเดตล่าสุด: เลิกดึงค่าจาก localStorage เพื่อป้องกันปัญหา Boss กลายเป็น Kitchen
 */
function updateRoleDisplay() {
    // 1. ดึง Element ป้ายสถานะ
    const badge = document.getElementById('role-badge');
    const icon = document.getElementById('role-icon');
    const text = document.getElementById('role-text');
    const p2pToggle = document.getElementById('p2p-toggle'); 

    // ถ้าไม่มีป้ายในหน้านั้น ให้หยุดทำงานทันที (เกราะป้องกันระบบเอ๋อ)
    if (!badge) return;

    // 2. ตรวจสอบสถานะสวิตช์ P2P จาก "หน้าจอจริง" เท่านั้น
    const isP2PEnabled = p2pToggle ? p2pToggle.checked : (localStorage.getItem('p2p_enabled') === 'true');

    // 🚩 [ความจริงจากหน้าจอ]: เช็กว่าตอนนี้เราอยู่ที่หน้าไหนโดยดูจาก Class ของ Body
    const isBossUI = document.body.classList.contains('boss-mode');
    const isKitchenUI = document.body.classList.contains('kitchen-mode');
    const isBabyUI = document.body.classList.contains('baby-mode');

    // เคลียร์คลาสสถานะบทบาทเก่าออกให้เกลี้ยงก่อนสวมคลาสใหม่ เพื่อป้องกันคลาสสีตีกันเอง
    badge.classList.remove('role-alone', 'role-boss', 'role-kitchen', 'role-baby', 'role-pending');

    // --- [ด่านที่ 1]: กรณีปิดสวิตช์ (โหมด Offline) ---
    if (!isP2PEnabled) {
        // 🟢 เปลี่ยนจากการยัดโค้ดสไตล์สีหนา ๆ มาเป็นการสวมคลาสที่เคลียร์สะอาดจาก CSS ตัวเดียวจบ
        badge.classList.add('role-alone');
        if (icon) icon.innerText = '🏠';
        if (text) text.innerText = 'Alone'; 
        console.log("ℹ️ [UI] แสดงสถานะ: Alone");
        return; 
    }

    // --- [ด่านที่ 2]: กรณีเปิดสวิตช์ (อัปเดตตามคลาสที่พบจริงบน Body) ---
    if (isBossUI) {
        // 👑 กรณีเป็นหน้าจอ Boss
        badge.classList.add('role-boss');
        if (icon) icon.innerText = '👑';
        if (text) text.innerText = 'Boss';
        localStorage.setItem('p2p_mode', 'hub');

    } else if (isKitchenUI) {
        // 👨‍🍳 กรณีเป็นหน้าจอครัว
        badge.classList.add('role-kitchen');
        if (icon) icon.innerText = '👨‍🍳';
        if (text) text.innerText = 'Kitchen';
        localStorage.setItem('p2p_mode', 'kitchen');

    } else if (isBabyUI) {
        // 📱 กรณีเป็นหน้าจอเครื่องลูก
        badge.classList.add('role-baby');
        if (icon) icon.innerText = '📱';
        if (text) text.innerText = 'Baby';
        localStorage.setItem('p2p_mode', 'client');

    } else {
        // ⚠️ กรณีเปิดสวิตช์แต่หน้าจอยังไม่มี Class ระบุตัวตน
        badge.classList.add('role-pending');
        if (icon) icon.innerText = '⚠️';
        if (text) text.innerText = 'รอเลือกบทบาท...';
    }

    console.log(`🎯 [UI Refresh] ป้ายสถานะถูกอัปเดตตามคลาสบน Body`);
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
    if (!profitElement) return; // 🔒 เกราะป้องกันระบบ เผื่อ Element หน้านั้นไม่ได้เปิดใช้งาน
    
    const netProfit = totalSales - dailyCost;
    
    // 1. จัดการวาดโครงสร้างข้อความและตัวแปรคำนวณลง HTML ตามปกติเป๊ะ
    profitElement.innerHTML = netProfit >= 0 
        ? `✅ กำไรวันนี้: <b>${netProfit.toLocaleString()}</b> .-` 
        : `⚠️ ขาดทุนอยู่: <b>${Math.abs(netProfit).toLocaleString()}</b> .-`;
    
    // 2. 🟢 ล้างคลาสสลับสีอันเก่าออกให้สะอาดก่อน เพื่อป้องกันคลาสตีกันเอง
    profitElement.classList.remove('status-surplus', 'status-deficit');
    
    // 3. 🟢 สวมคลาสสีที่ถูกต้องผ่านพลังของ CSS แทนการฝืนพ่นสีอินไลน์ใน JS
    if (netProfit >= 0) {
        profitElement.classList.add('status-surplus');
    } else {
        profitElement.classList.add('status-deficit');
    }
}

//29-05-2026
async function handleCloseDay() {
    // 🎯 1. ดึงหน่วยนับสากลจากความจำ (เช่น ใบ, ฟอง, กล่อง)
    const counterUnitName = localStorage.getItem('counterUnit') || 'รายการ';
    
    const totalSales = (document.getElementById('total-sales-display').innerText || '0').replace(/,/g, '');
    
    // 🎯 [แก้ไขจุดที่ 1]: เปลี่ยนที่อยู่การดึงตัวเลขจาก 'egg-count' เป็น 'total-count' ตาม HTML ใหม่
    const totalCount = (document.getElementById('total-count').innerText || '0').replace(/,/g, '');

    if (confirm(`ยืนยันการปิดยอดวันนี้?\n💰 ยอด: ${totalSales}.-\n📈 ${counterUnitName}: ${totalCount}`)) {
        const today = new Date().toISOString().split('T')[0];
        
        // 🎯 2. ยิงข้อมูลเข้าตารางสรุปรายวันใน Dexie DB ด้วยฟิลด์สากล 'total_count' อย่างแม่นยำ
        await db.dailysummary.put({ 
            summary_date: today, 
            total_sales: parseFloat(totalSales), 
            total_count: parseInt(totalCount) 
        });
        
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

//กล่องค้นหา 23-06-2026
function filterMenuList() {
    // 1. ดึงคำค้นหามา
    const searchTerm = document.getElementById('menuSearchInput').value.toLowerCase();
    
    // 2. ดึงทุกรายการเมนูที่เป็น li
    const listBoard = document.getElementById('menu-list-items');
    const items = listBoard.getElementsByClassName('menu-list-item-row');

    // 3. วนลูปเช็ค
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        // ดึงชื่อเมนูจาก input ในแถวนั้น (พี่ใช้ id="full-edit-name-${menu.id}")
        // แต่เพื่อความไว เราสั่ง query จาก input ในแถวนั้นได้เลย
        const menuName = item.querySelector('.menu-txt-input').value.toLowerCase();
        
        if (menuName.includes(searchTerm)) {
            item.style.display = ""; // ถ้าเจอให้โชว์
        } else {
            item.style.display = "none"; // ถ้าไม่เจอให้ซ่อน
        }
    }
}

// --- ส่วนของคลังเมนูทั้งหมด --- 25-04-2026
async function renderMenuList() {
    const allMenus = await db.menus.toArray();
    const listContainer = document.getElementById('menu-list-items');
    if (!listContainer) return; // 🔒 เกราะป้องกันระบบถ้ารันในหน้าที่ไม่มีอินเทอร์เฟซนี้
    listContainer.innerHTML = ''; 
    
    allMenus.forEach(menu => {
        const li = document.createElement('li');
        
        // 🟢 เปลี่ยนจากการพ่นสไตล์หนาเตอะใน JS มาเป็นการแปะชื่อคลาสสากลจาก CSS ตัวเดียวจบ!
        li.className = 'menu-list-item-row';
        
        // 🟢 HTML คลีนสะอาดยกแผง แยกหน้าที่ชัดเจน ไร้เงาสไตล์ปนเปื้อนสายตา
        li.innerHTML = `
            <div class="menu-input-group">
                <input type="text" value="${menu.name}" disabled id="full-edit-name-${menu.id}" class="menu-txt-input">
                <input type="number" value="${menu.price}" disabled id="full-edit-price-${menu.id}" class="menu-num-input">
            </div>
            <div class="menu-action-group">
                <div>
                    <button onclick="toggleEditFullDb(this, ${menu.id})" class="btn-menu-edit">📝 แก้ไข</button>
                    <button onclick="deleteFullMenu(${menu.id})" class="btn-menu-delete">ลบจากคลัง</button>
                </div>
                <button onclick="addFromStorageToQuick('${menu.name}', ${menu.price})" class="btn-menu-to-quick">
                    + หน้าแรก
                </button>
            </div>
        `;
        listContainer.appendChild(li);
    });
}

// ฟังก์ชันใหม่: ใช้ชื่อ toggleEditFullDb เพื่อไม่ให้สับสนกับ toggleEditRow 09-06-2026
async function toggleEditFullDb(btn, id) {
    const nameInput = document.getElementById(`full-edit-name-${id}`);
    const priceInput = document.getElementById(`full-edit-price-${id}`);
    if (!nameInput || !priceInput) return; // 🔒 เกราะป้องกันเผื่อดึง Element พลาด
    
    // ดึงอิลิเมนต์แถวแม่ (li) ของอินพุตชุดนี้ขึ้นมาเพื่อเตรียมแปะคลาสสถานะ
    const rowParent = btn.closest('.menu-list-item-row');
    const isLocked = nameInput.disabled;

    if (isLocked) {
        // --- 📝 จังหวะที่ 1: เปิดล็อกโหมดแก้ไข ---
        nameInput.disabled = false;
        priceInput.disabled = false;
        btn.innerText = "✅ บันทึก";
        
        // 🟢 สวมเสื้อโค้ตคลาสโหมดแก้ไขให้แถวแม่ทันที (CSS ด้านนอกจะรุมสลับสีอินพุตและปุ่มให้เองอัตโนมัติ)
        if (rowParent) {
            rowParent.classList.add('is-editing-mode');
        }
        
        // สั่งโฟกัสไปที่ช่องชื่ออาหารเพื่อให้คุณยายพร้อมพิมพ์ทันทีเพื่อความสะดวก
        nameInput.focus();

    } else {
        // --- ✅ จังหวะที่ 2: กดบันทึกข้อมูลเข้าคลัง ---
        const newName = nameInput.value;
        const newPrice = parseFloat(priceInput.value);
        
        if (newName && !isNaN(newPrice)) {
            // อัปเดตลงคลังข้อมูล Dexie DB ลอจิกเดิมเป๊ะ ปลอดภัยสูงสุด
            await db.menus.update(id, { name: newName, price: newPrice });
            
            nameInput.disabled = true;
            priceInput.disabled = true;
            btn.innerText = "📝 แก้ไข";
            
            // 🟢 ล้างคลาสโหมดแก้ไขออกจากแถวแม่ เพื่อให้หน้าจอดึงสีปกติใน CSS กลับคืนมาทันที
            if (rowParent) {
                rowParent.classList.remove('is-editing-mode');
            }
            
            // สั่งอัปเดตผังปุ่มหน้าแรกเผื่อข้อมูลชื่อหรือราคาอาหารมีการเปลี่ยนแปลง
            if (typeof renderOrderButtons === 'function') {
                renderOrderButtons(); 
            }
        }
    }
}

// ฟังก์ชันทางลัด: ดึงจากคลังไปโชว์ในหน้าตั้งค่าเมนูขายทันที
function addFromStorageToQuick(name, price) {
    const container = document.getElementById('menu-settings-list');
    if (!container) return; // 🔒 เกราะป้องกันระบบ เผื่อ Element หน้านั้นไม่ได้เปิดใช้งาน
    
    const div = document.createElement('div');
    div.className = 'menu-setting-row'; // 🟢 ใช้คลาสตัวเดิม แต่ย้ายการคุมสไตล์ทั้งหมดไปฝั่ง CSS
    
    // 🟢 HTML คลีนสะอาดยกแผง แยกหน้าที่ชัดเจน ไร้เงาสไตล์ปนเปื้อนใน JS
    div.innerHTML = `
        <input type="text" value="${name}">
        <input type="number" value="${price}">
        <button onclick="this.parentElement.remove()" class="btn-remove-setting">🗑️</button>
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
    if (!resultArea) return; // 🔒 เกราะป้องกันระบบ เผื่อดึง Element ผิดพลาด
    
    // 🛑 [ด่านแรก]: ถ้าไม่มีคำค้นหา พิมพ์ว่างเปล่า ให้ล้างข้อมูล สั่งหุบกล่องซ่อน และจบงานทันที
    if (!query || query.length < 1) { 
        resultArea.innerHTML = ''; 
        resultArea.classList.add('stg-hidden'); // 🟢 ซ่อนกล่องลอยนิ่งๆ ผ่านคลาสสากล
        return; 
    }
    
    // ค้นหากรองชื่อเมนูในฐานข้อมูล Dexie DB ตามตรรกะเดิมที่แม่นยำ
    const matches = await db.menus.filter(m => m.name.toLowerCase().includes(query.toLowerCase())).toArray();
    resultArea.innerHTML = '';
    
    if (matches.length > 0) {
        // 🟢 เปิดกล่องลอยแสดงผลทันทีโดยการถอดคลาสซ่อนออก ปลอดภัยกว่าพ่นสไตล์อินไลน์สด ๆ
        resultArea.classList.remove('stg-hidden');
        
        matches.forEach(menu => {
            const btn = document.createElement('button');
            btn.innerText = `➕ ${menu.name} (${menu.price}.-)`;
            
            // 🟢 แปะชื่อคลาสสากลจาก CSS จบปัญหาขยะสไตล์พะรุงพะรังใน JS
            btn.className = 'btn-search-match';
            
            btn.onclick = () => {
                if (typeof orderMenu === 'function') {
                    orderMenu(menu.name, menu.price); // สั่งอาหารเข้าตะกร้า
                }
                resultArea.innerHTML = '';
                resultArea.classList.add('stg-hidden'); // เลือกเสร็จให้กล่องลอยหุบซ่อนหายวับไปทันที
                
                const searchInput = document.getElementById('smart-search-input');
                if (searchInput) searchInput.value = '';
            };
            resultArea.appendChild(btn);
        });
    } else {
        // 🟢 กรณีพิมพ์แล้วไม่เจออะไรเลย แสดงกล่องแจ้งเตือนฉบับสะอาดไร้สไตล์อินไลน์ตกค้าง
        resultArea.classList.remove('stg-hidden');
        resultArea.innerHTML = `<div class="search-no-match">❌ ไม่พบเมนูนี้ในระบบจ้า</div>`;
    }
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
                        <td>${Number(row.total_count).toLocaleString()}</td>`;
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

// เริ่มระบบ 06-05-2026
window.onload = async function() {
    // ---------------------------------------------------------
    // 1. ดึงข้อมูลพื้นฐาน (ชื่อร้าน/หัวข้อเมนู)
    // ---------------------------------------------------------
    const keys = [{ k: 'shopName', i: 'name-main' }, { k: 'shopMenu', i: 'menu-name' }];
    keys.forEach(item => {
        let val = localStorage.getItem(item.k);
        if (val && document.getElementById(item.i)) {
            document.getElementById(item.i).innerText = val;
        }
    });

    // ---------------------------------------------------------
    // 2. ตั้งค่าระบบนับ (ไข่ดาว/ฟอง)
    // ---------------------------------------------------------
    const savedLabel = localStorage.getItem('counterLabel') || "ไข่ดาว";
    const savedUnit = localStorage.getItem('counterUnit') || "ฟอง";

    const elementsToUpdate = [
        { id: 'display-label', text: "📊 วันนี้ใช้ " + savedLabel + " ไปแล้ว" },
        { id: 'display-unit', text: savedUnit },
        { id: 'dashboard-unit-header', text: savedLabel },
        { id: 'dashboard-unit-name', text: savedUnit }
    ];

    elementsToUpdate.forEach(el => {
        const target = document.getElementById(el.id);
        if (target) target.innerText = el.text;
    });

    if (document.getElementById('counter-label-input')) document.getElementById('counter-label-input').value = savedLabel;
    if (document.getElementById('counter-unit-input')) document.getElementById('counter-unit-input').value = savedUnit;

    // ---------------------------------------------------------
    // 3. ตั้งค่าส่วนลดและระบบต้นทุน (ความปลอดภัยสูง)
    // ---------------------------------------------------------
    // ดึงส่วนลดพื้นฐาน
    const savedDiscount = localStorage.getItem('default_discount') || 0;
    if (document.getElementById('set_discount')) {
        document.getElementById('set_discount').value = savedDiscount;
    }

    // ✨ [จุดที่พี่ถาม]: โหลดทุนวันนี้มาเตรียมไว้ก่อนคำนวณยอดขาย
    if (typeof loadDailyCost === 'function') {
        loadDailyCost(); 
    }

    // ---------------------------------------------------------
    // 4. 🔥 วาดหน้าจอและคำนวณข้อมูล (Core Engine)
    // ---------------------------------------------------------
    // วาดปุ่มโต๊ะ
    if (typeof renderTableSelection === 'function') {
        await renderTableSelection();
    }

    // คำนวณยอดขาย/กำไร (ต้องรันหลัง loadDailyCost เพื่อให้กำไรสุทธิแม่นยำ)
    if (typeof fetchTodaySales === 'function') {
        fetchTodaySales(); 
    }

    // วาดปุ่มเมนูอาหารและตัวเลือกเสริม
    if (typeof renderOrderButtons === 'function') renderOrderButtons();
    if (typeof renderExtraOptions === 'function') renderExtraOptions();
    
    // 🟢 เปลี่ยนมาเช็คและเรียกใช้งานฟังก์ชันใหม่ทั้ง 2 ดวงแทนเลยครับ 25-05-2026
    if (typeof renderRecentOrdersUI === 'function') renderRecentOrdersUI();
    if (typeof renderTodayOrdersTableUI === 'function') renderTodayOrdersTableUI();

    // ---------------------------------------------------------
    // 5. ✨ โหลดระบบจดของและประวัติการซื้อ
    // ---------------------------------------------------------
    // รายการที่กำลังจด (pending)
    if (typeof renderShoppingList === 'function') {
        renderShoppingList(); 
    }

    // ประวัติการซื้อทั้งหมด (completed)
    if (typeof renderFullHistory === 'function') {
        await renderFullHistory(); 
    }

    // วิเคราะห์ราคา (Price Insight)
    if (typeof updateDashboardPriceInsight === 'function') {
        updateDashboardPriceInsight();
    }

    // 🚩 เพิ่มบรรทัดนี้ลงไปครับ แถบสถานะ (Status Bar) P2P 15-05-2026
    // 1. ดึงสถานะปัจจุบันจากความจำเครื่อง
        updateRoleDisplay();
    
    
    console.log("🚀 Smart POS พร้อมดูแลร้านยายแล้วจ้า! (Version 11: ระบบประวัติและทุนยืดหยุ่นพร้อมใช้งาน)");
};

// ==========================================
// สรุปภาพรวมธุรกิจ (มุมหลานรัก) chart  06-05--2026
// ==========================================
async function openGrandmaDashboard(filterDays = 'all') {
    // --- ส่วนที่ 1: การจัดการหน้าจอและประวัติการเข้าชม ---
    
    // 🚩 [จุดปรับปรุง]: เช็กสถานะการเปิด Modal
    const modal = document.getElementById('dashboard-modal');
    const isAlreadyOpen = modal.style.display === 'block';

    // ถ้าหน้าจอยังไม่เปิด ให้สั่งเปิดและสร้าง "จุดพักประวัติ" (Push State)
    if (!isAlreadyOpen) {
        modal.style.display = 'block';
        
        // สร้างจุดพักประวัติ เพื่อให้ปุ่ม Back บนมือถือช่วยปิด Modal แทนการปิดแอป
        // จะรันแค่ครั้งเดียวตอนเปิด Modal ครั้งแรกเท่านั้น
        history.pushState({ modalOpen: true }, 'GrandmaDashboard'); 
    }
    // --- ส่วนที่ 2: การเตรียมข้อมูลจากฐานข้อมูล (รองรับแผน 20 ปี) ---
    
    // เริ่มต้นการ Query ข้อมูล
    let query = db.dailysummary.orderBy('summary_date');
    
    // 🚩 [จุดอัปเกรด]: กรองข้อมูลตามช่วงเวลา (7, 30 วัน หรือทั้งหมด) เพื่อไม่ให้กราฟแน่นเกินไปในอนาคต
    if (filterDays !== 'all') {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - filterDays);
        const startDateStr = startDate.toISOString().split('T')[0];
        query = query.filter(day => day.summary_date >= startDateStr);
    }

    const historyData = await query.toArray();
    
    let labels = [];
    let salesData = [];
    let investmentData = [];
    let accumSales = 0;
    let accumInvest = 0;
    let lastYear = null; // ตัวแปรหัวใจสำคัญในการเช็กปีข้ามศตวรรษ

    // ประมวลผลข้อมูลรายวัน
    historyData.forEach(day => {
        const dateParts = day.summary_date.split('-'); // เช่น ["2026", "05", "06"]
        const currentYear = dateParts[0];
        const monthDay = `${dateParts[1]}/${dateParts[2]}`;

        // 🚩 [จุดอัปเกรด]: แสดงปีอัตโนมัติเมื่อข้อมูลข้ามปี
        // จะแสดงปี (เช่น /26) เฉพาะจุดแรกของข้อมูล หรือเมื่อขึ้นปีใหม่เท่านั้น เพื่อให้กราฟสะอาดตา
        if (currentYear !== lastYear) {
            labels.push(`${monthDay}/${currentYear.slice(-2)}`); 
            lastYear = currentYear;
        } else {
            labels.push(monthDay); 
        }
        
        // คำนวณยอดสะสม (Cumulative) เพื่อดูการเติบโตระยะยาว
        accumSales += (day.total_sales || 0);
        accumInvest += (day.daily_investment || 0);
        
        salesData.push(accumSales);
        investmentData.push(accumInvest);
    });

    // --- ส่วนที่ 3: การแสดงผลกราฟและตัวเลข ---

    const ctx = document.getElementById('businessHeartChart').getContext('2d');
    if (window.myChart) window.myChart.destroy(); // เคลียร์กราฟเก่าป้องกัน Data ซ้อน
    
    window.myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels, // ข้อมูลวันที่ที่ประมวลผลแล้ว
            datasets: [
                { 
                    label: 'ยอดขายสะสม', 
                    data: salesData, 
                    borderColor: '#2ecc71', 
                    backgroundColor: 'rgba(46, 204, 113, 0.1)', 
                    fill: true, 
                    tension: 0.3 
                },
                { 
                    label: 'ทุนสะสม', 
                    data: investmentData, 
                    borderColor: '#e74c3c', 
                    borderDash: [5, 5], 
                    tension: 0.1 
                }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' } // เพิ่มคำอธิบายเส้นกราฟให้ยายอ่านง่าย
            }
        }
    });

    // อัปเดตตัวเลขยอดรวมและการ์ดให้กำลังใจ
    updateDashboardUI(accumSales, accumInvest);

    // --- ส่วนที่ 4: การคำนวณขั้นสูง ---

    // วาดคะแนนความมั่งคั่ง (Efficiency Score) 0-10 ในกรอบสีฟ้า
    await renderEfficiencyDashboard(accumSales, accumInvest);

    // วิเคราะห์ช่วงเวลาขายดี
    if (typeof renderPeakSalesChart === "function") {
        renderPeakSalesChart();
    }
}

function updateDashboardUI(totalSales, totalInvest) {
    const net = totalSales - totalInvest;
    const statsDiv = document.getElementById('dashboard-stats');
    const msgDiv = document.getElementById('grandma-message');
    
    if (!statsDiv) return; // 🔒 เกราะป้องกันระบบ เผื่อ Element หน้านั้นไม่ได้เปิดใช้งาน

    // 🟢 เปลี่ยนจากการพ่นสไตล์หนาเตอะใน JS มาเป็นการแปะชื่อคลาสสากล แยกหน้าที่เด็ดขาด!
    statsDiv.innerHTML = `
        <div class="db-stat-card card-sales">
            <small>ยอดขายรวม</small><br><strong>${totalSales.toLocaleString()}</strong>
        </div>
        <div class="db-stat-card card-invest">
            <small>ทุนสะสม</small><br><strong>${totalInvest.toLocaleString()}</strong>
        </div>
    `;

    // ส่วนของตรรกะพ่นข้อความให้กำลังใจคุณยาย (รักษาความเสถียรและทำงานได้แม่นยำเหมือนเดิมเป๊ะ)
    if (msgDiv) {
        if (net >= 0) {
            msgDiv.innerText = `ยายครับ! ตอนนี้เรากำไรสะสมแล้ว ${net.toLocaleString()} บาท หลานภูมิใจในตัวยายที่สุดเลยครับ!`;
        } else {
            msgDiv.innerText = `สู้ๆ ครับยาย อีกแค่ ${Math.abs(net).toLocaleString()} บาท เราก็จะคืนทุนทั้งหมดแล้วครับ!`;
        }
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
    if (!container) return; // 🔒 เกราะป้องกันระบบ เผื่อดึง Element ผิดพลาด

    // 1. ดึงรายการซื้อของที่ "ยังไม่ได้บันทึกราคา" (pending) จากคลังข้อมูล
    const items = await db.shopping_list.where('status').equals('pending').reverse().toArray();

    // 2. กรณีไม่มีรายการจด (แสดงผลฉบับสะอาด ไร่สไตล์ปนเปื้อน)
    if (items.length === 0) {
        container.innerHTML = `
            <div class="shopping-empty-box">
                <i class="fas fa-clipboard-list"></i>
                <p>ยายยังไม่ได้จดอะไรเพิ่มเลยครับ<br><small>ลองพิมพ์ชื่อวัตถุดิบข้างบนดูนะ</small></p>
            </div>
        `;
        return;
    }

    // 3. สร้าง HTML สำหรับแต่ละรายการผ่านกลไกคลาสสากล
    container.innerHTML = items.map(item => {
        const cleanName = item.name.split(' (')[0];

        // ตรวจสอบสถานะการบันทึกราคา เพื่อสลับข้อความให้อ่านง่ายถูกต้อง
        const hasPrice = item.price > 0 && item.confirmed_time;
        const timeDisplay = hasPrice 
            ? `✅ ซื้อเมื่อ: ${item.confirmed_date} เวลา ${item.confirmed_time}` 
            : `🕒 จดเมื่อ: ${item.date || 'ไม่ระบุวันที่'}`;
        
        // 🟢 สวมคลาสสถานะ 'is-confirmed' พ่วงไปที่กล่องแม่ทันที ถ้าบันทึกราคาแล้ว (CSS จะสลับสีเวลาให้เอง)
        const activeClass = hasPrice ? 'shopping-card-item is-confirmed' : 'shopping-card-item';

        return `
        <div class="${activeClass}">
            
            <div class="shopping-card-top">
                <div class="shopping-info-area">
                    <div class="shopping-title-group">
                        <strong>${item.name}</strong>
                        <span onclick="showPriceHistory('${cleanName}')" class="btn-price-history">
                            🔍 ประวัติ
                        </span>
                    </div>
                    <div class="shopping-time-display">
                        <span>${timeDisplay}</span>
                    </div>
                </div>
                
                <div class="shopping-action-buttons">
                    <button onclick="editShoppingItem(${item.id}, '${item.name}')" class="btn-shop-edit">📝</button>
                    <button onclick="deleteShoppingItem(${item.id})" class="btn-shop-delete">🗑️</button>
                </div>
            </div>

            <div class="shopping-card-bottom">
                <span class="lbl-real-price">ซื้อมาจริง:</span>
                
                <input type="number" id="real-price-${item.id}" 
                        value="${item.price > 0 ? item.price : ''}"
                        onchange="savePriceToDB(${item.id}, this.value)"
                        placeholder="บาท" 
                        class="input-real-price">
                
                <button onclick="updateActualPrice(${item.id}, '${cleanName}')" class="btn-shop-save">
                    ✅ บันทึก
                </button>
            </div>
        </div>
        `;
    }).join('');

    // สั่งรันระบบวิเคราะห์คำนวณราคาเฉลี่ยต่อหน่วยอัจฉริยะ (เสถียร แม่นยำ เหมือนเดิมเป๊ะ)
    await runSmartAnalysis();
}

//06-05-2026
async function savePriceToDB(id, price) {
    if (price === "") return;
    // บันทึกราคาลง DB ทันที ยายพิมพ์เสร็จปุ๊บ ข้อมูลใน DB จะไม่ใช่ 0 อีกต่อไป
    await db.shopping_list.update(id, { price: parseFloat(price) });
    console.log("หลานจำราคาให้แล้วครับ!");
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
        // --- ส่วนที่เพิ่ม: เตรียมรูปแบบวันที่และเวลาแยกกัน ---
        const now = new Date();
        const ThaiDate = now.toLocaleDateString('th-TH'); // เช่น 6/5/2569
        const ThaiTime = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }); // เช่น 14:30
        const fullDateTime = `${ThaiDate} ${ThaiTime}`; // สำหรับเก็บเป็น log รวม

        // --- ส่วนที่ 1: วิเคราะห์และบันทึกประวัติราคา (Price History) ---
        const history = await db.price_history.get(cleanName);
        let compliment = ""; 

        // ข้อมูลที่จะบันทึกลงประวัติราคา (เพิ่ม field date และ time เข้าไป)
        const historyData = {
            name: cleanName,
            last_price: actualPrice,
            last_updated: fullDateTime,
            date: ThaiDate, // ✨ เก็บวันที่แยก (สำหรับโชว์ใน Modal แก้ 165)
            time: ThaiTime  // ✨ เก็บเวลาแยก (สำหรับโชว์ใน Modal แก้ 165)
        };

        if (history) {
            const priceDiff = history.last_price - actualPrice;
            if (actualPrice < history.best_price) {
                compliment = `\n🏆 ทุบสถิติ! นี่คือราคาที่ถูกที่สุดที่ยายเคยซื้อเลยครับ`;
            } else if (priceDiff > 0) {
                compliment = `\n✨ ยายซื้อถูกลงกว่ารอบก่อน ${priceDiff} บาทแน่ะ!`;
            }
            
            historyData.best_price = Math.min(history.best_price, actualPrice);
            await db.price_history.put(historyData);
        } else {
            compliment = "\n🌟 บันทึกราคาครั้งแรกเรียบร้อย ต่อไปหลานจะช่วยจำให้นะครับ";
            historyData.best_price = actualPrice;
            await db.price_history.put(historyData);
        }

        // --- ส่วนที่ 2: อัปเดตราคาใน Shopping List ---
        // เพิ่มการเก็บ date และ time ลงในรายการที่กำลังซื้อด้วย
        await db.shopping_list.update(id, { 
            price: actualPrice, 
            confirmed_date: ThaiDate, // ✨ สำหรับโชว์ในรายการล่าสุด (แก้ 163)
            confirmed_time: ThaiTime  // ✨ สำหรับโชว์ในรายการล่าสุด (แก้ 163)
        });

        // --- ส่วนที่ 3: แจ้งเตือนและอัปเดตหน้าจอ ---
        alert(`หลานจำราคา ${cleanName} ไว้ให้แล้วครับ!${compliment}`);
        
        renderShoppingList(); 

        // อัปเดตกล่องสีเหลือง (Dashboard) และกล่องม่วง (Smart Suggestion)
        if (typeof updateDashboardPriceInsight === "function") updateDashboardPriceInsight();
        if (typeof runSmartAnalysis === "function") await runSmartAnalysis(); 

    } catch (err) {
        console.error("เกิดข้อผิดพลาดในการบันทึกราคา:", err);
        alert("อุ๊ย! เกิดข้อผิดพลาดนิดหน่อยครับคุณยาย");
    }
}

// ฟังก์ชันช่วยส่งยอดซื้อไปรวมกับทุนรายวัน (เพื่อให้ Dashboard ขยับ) 06-05-2026
async function syncPurchaseToInvestment(amount) {
    // 1. ใช้รูปแบบวันที่มาตรฐาน ISO (YYYY-MM-DD) เพื่อให้ตรงกับส่วนอื่นๆ ของระบบ
    const today = new Date().toISOString().split('T')[0]; // ✅ แบบสากล (2026-05-06)
    
    try {
        const summary = await db.dailysummary.get(today);
        
        if (summary) {
            // ถ้ามีข้อมูลของวันนี้แล้ว ให้บวกยอดเงินลงทุนเพิ่มเข้าไป
            await db.dailysummary.update(today, {
                daily_investment: (summary.daily_investment || 0) + amount
            });
        } else {
            // 🚩 [จุดที่เพิ่ม]: ถ้าเป็นรายการแรกของวัน และยังไม่มีข้อมูล ให้สร้างแถวใหม่เลย
            await db.dailysummary.add({
                summary_date: today,
                daily_investment: amount,
                total_sales: 0 // เริ่มต้นยอดขายที่ 0
            });
        }
        console.log(`✅ ซิงค์ยอดลงทุนเรียบร้อย: ${amount} บาท`);
    } catch (err) {
        console.error("❌ ซิงค์ข้อมูลลงบัญชีไม่สำเร็จ:", err);
    }
}

async function runSmartAnalysis() {
    // --- จุดที่ 1: วิเคราะห์ดัชนีราคา (กล่องเหลือง) ---
    const priceDiv = document.getElementById('price-content');
    
    if (priceDiv) {
        const history = await db.price_history.orderBy('best_price').limit(3).toArray();
        if (history.length > 0) {
            // 🟢 เปลี่ยนจากการยัดสไตล์อินไลน์หนา ๆ มาเป็นการครอบคลาส 'analysis-price-row'
            priceDiv.innerHTML = history.map(item => 
                `<div onclick="showPriceHistory(\`${item.name}\`)" class="analysis-price-row">
                    • <b>${item.name}</b> ถูกสุด <b>${item.best_price}.-</b> 🔍
                 </div>`).join('');
        } else {
            priceDiv.innerText = "ยายจดของบ่อยๆ นะ แล้วหลานจะจำราคาให้ครับ!";
        }
    }

    // --- จุดที่ 2: คำนวณคะแนนบริหาร (กล่องน้ำเงิน) ---
    const scoreContent = document.getElementById('score-content');
    const scoreMsg = document.getElementById('score-message');
    
    const today = new Date().toISOString().split('T')[0]; 
    const summary = await db.dailysummary.get(today);

    // ลอจิกคำนวณคะแนนความคุ้มค่าด้านต้นทุนและยอดขาย (เสถียรและทนทาน ไร้สารอินไลน์ตกค้าง)
    if (scoreContent && scoreMsg) {
        if (summary && summary.daily_investment > 0) {
            const ratio = summary.total_sales / summary.daily_investment;
            let score = (ratio * 2).toFixed(1); 
            score = Math.min(score, 10); 
            
            scoreContent.innerText = `${score}/10`;
            scoreMsg.innerText = score >= 7 ? "วันนี้ยายบริหารทุนเก่งมากครับ!" : "วันนี้คนอาจจะน้อยหน่อย พรุ่งนี้สู้ใหม่นะยาย!";
        } else {
            scoreContent.innerText = "0/10";
            scoreMsg.innerText = "รอยอดขายและต้นทุนวันนี้อยู่นะครับยาย";
        }
    }

    // --- จุดที่ 3: ระบบพยากรณ์ของที่ต้องซื้อ (กล่องม่วง) ---
    const suggestDiv = document.getElementById('suggestion-content');
    
    if (suggestDiv) {
        const pendingList = await db.shopping_list.where('status').equals('pending').toArray();
        
        if (pendingList.length > 0) {
            const itemsName = pendingList.map(item => item.name).join(', ');
            // 🟢 เคลียร์สไตล์อินไลน์ออกแล้วครอบคลาสสากล 'analysis-pending-names' ให้ตัวแปรสีม่วงพยากรณ์แทน
            suggestDiv.innerHTML = `ยายมีของค้าง <b>${pendingList.length} อย่าง:</b> <br>
                                    <span class="analysis-pending-names">(${itemsName})</span>`;
        } else {
            suggestDiv.innerText = "ตอนนี้ของครบแล้ว ยายพักผ่อนให้สบายนะครับ";
        }
    }
}

async function showPriceHistory(itemName) {
    try {
        // 1. [การดึงข้อมูล]: คิวรีหาประวัติวัตถุดิบจากคลังข้อมูลตามปกติ
        const allRecords = await db.shopping_list.where('name').equals(itemName).toArray();

        // 2. [การจัดการข้อมูล]: กรองเฉพาะบิลสำเร็จและเรียงจากใหม่ไปเก่า
        const priceRecords = allRecords
            .filter(item => item.status === 'completed' && !isNaN(parseFloat(item.price)))
            .sort((a, b) => b.id - a.id);

        const tableContent = document.getElementById('history-table-content');
        const titleElement = document.getElementById('history-title');
        
        if (titleElement) {
            titleElement.innerText = `📊 ประวัติราคา: ${itemName}`;
        }
        
        if (!tableContent) return; // 🔒 เกราะป้องกัน Error

        if (priceRecords.length > 0) {
            // 3. [การคำนวณ]: หาเรทราคาที่ถูกที่สุดและล่าสุด
            const minPrice = Math.min(...priceRecords.map(item => parseFloat(item.price)));
            const latestPrice = parseFloat(priceRecords[0].price);

            // 🟢 โครงสร้าง HTML คลีนสะอาดยกแผง แยกฝั่งดีไซน์ไปให้ CSS ดูแลเต็มตัว
            let html = `
                <div class="history-summary-box">
                    <small>สรุปราคาล่าสุด:</small>
                    <div class="history-summary-flex">
                        <span>💰 ล่าสุด: <b>${latestPrice.toLocaleString()}.-</b></span>
                        <span class="text-min-price">📉 ถูกสุด: <b>${minPrice.toLocaleString()}.-</b></span>
                    </div>
                </div>

                <table class="history-table">
                <thead>
                    <tr>
                        <th class="txt-left">วันที่ซื้อ</th>
                        <th class="txt-right">ราคา (บาท)</th>
                    </tr>
                </thead>
                <tbody>`;
            
            // แสดงเฉพาะ 5 รายการล่าสุดตามกติกาเดิมของคุณยาย
            priceRecords.slice(0, 5).forEach(h => {
                const currentPrice = parseFloat(h.price);
                const isMinPrice = currentPrice === minPrice;
                
                // 🟢 สลับคลาสความพรีเมียมจาก CSS แทนการฝังโค้ดสีดิบลงใน JS
                const priceClass = isMinPrice ? 'price-text-highlight' : 'price-text-normal';
                
                html += `
                <tr>
                    <td class="col-date">
                        <div>${h.confirmed_date || h.date || 'ไม่ระบุวันที่'}</div>
                        <div class="time-sub">🕒 ${h.confirmed_time || ''}</div>
                    </td>
                    <td class="col-price ${priceClass}">
                        ${currentPrice.toLocaleString()}.- ${isMinPrice ? '✨' : ''}
                    </td>
                </tr>`;
            });
            
            html += `</tbody></table>`;
            tableContent.innerHTML = html;
        } else {
            // กรณีไม่มีประวัติ (แสดงผลผ่านคลาสสากล ไม่ง้อสไตล์อินไลน์)
            tableContent.innerHTML = `
                <div class="history-empty-state">
                    <p class="empty-icon">📝</p>
                    <p>ยังไม่มีประวัติการซื้อ "${itemName}"<br>
                    <small>ยายต้องกด "บันทึกยอดรวมและปิดงาน" ก่อนนะครับ</small></p>
                </div>`;
        }

        // 4. [การแสดงผล Modal]: เปิดการทำงานผ่านคลาสสากล (หรือคงลอจิกเดิมไว้หากผูกระบบแอปอยู่)
        const modal = document.getElementById('price-history-modal');
        if (modal) {
            modal.classList.remove('stg-hidden'); // 🟢 ปลดคลาสซ่อนออกนิ่ง ๆ 
            // หากต้องการใช้ลอจิกสลับ display เดิม ให้เปลี่ยนเป็น modal.style.display = 'flex'; ได้ตามความเหมาะสมของ Modal หลัก
            modal.style.display = 'flex'; 
            
            // 5. [ปุ่ม Back]: ดักปุ่มย้อนกลับบนมือถือลื่นไหลเหมือนเดิมเป๊ะ
            window.history.pushState({ modalOpen: true }, ""); 
        }

    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการดึงประวัติ:", error);
    }
}

//ฟังก์ชันสั่งปิด popup ประวัติราคาวัตถุดิบ 06-05-2026
function closePriceHistoryModal() {
    const modal = document.getElementById('price-history-modal');
    if (modal) {
        // 1. สั่งซ่อนหน้าต่างทันที (อันนี้คือสิ่งที่พี่ต้องการ)
        modal.style.display = 'none';

        // 2. วิธีแก้ปัญหาการ "ดีด": 
        // เราจะเช็กก่อนว่าเราอยู่ในสถานะ Modal จริงไหม 
        // ถ้าใช่ เราจะแค่ "ล้างสถานะ" ในโค้ด แต่ไม่สั่ง history.back() 
        // เพื่อป้องกันไม่ให้บราวเซอร์พากระโดดออกไปหน้าหลักครับ
        console.log("✅ ปิดเฉพาะหน้าต่าง Pop-up เรียบร้อย (ไม่ดีดออกแล้วครับ)");
    }
}

async function renderFullHistory() {
    const historyContainer = document.getElementById('full-history-display'); 
    if (!historyContainer) return;

    try {
        // 1. [การดึงข้อมูล]: ดึงเฉพาะรายการที่ซื้อสำเร็จเสร็จสิ้นจากฐานข้อมูลตามปกติ
        const allHistory = await db.shopping_list
            .where('status')
            .equals('completed')
            .reverse()
            .toArray();

        // 2. [กรณีไม่มีข้อมูล]: แสดงสถานะว่างเปล่าฉบับสะอาด ไร้สไตล์อินไลน์ตกค้าง
        if (allHistory.length === 0) {
            historyContainer.innerHTML = `
                <div class="hist-empty-container">
                    <i class="fas fa-shopping-basket"></i>
                    <p>ยังไม่มีประวัติการซื้อครับยาย<br><small>พอยายกด "บันทึกราคา" ประวัติจะมาโชว์ตรงนี้ครับ</small></p>
                </div>
            `;
            return;
        }

        // 3. [การแสดงผล]: วาดรายการประวัติผ่านชุดโครงสร้างคลาสสากล
        historyContainer.innerHTML = allHistory.map(item => {
            const fullDate = item.confirmed_date || item.date;
            
            return `
                <div id="history-item-${item.id}" class="full-history-card">
                    <div class="hist-card-left">
                        <div class="hist-item-title">
                            <span id="name-display-${item.id}">${item.name.split(' (')[0]}</span>
                        </div>
                        <div class="hist-item-date">
                            <span>📅 ${fullDate}</span>
                        </div>
                    </div>
                    
                    <div class="hist-card-right">
                        <div class="hist-item-price">
                            <span id="price-display-${item.id}">${Number(item.price).toLocaleString()}</span>.-
                        </div>
                        
                        <div class="hist-status-group">
                            <small>บันทึกแล้ว</small>
                            <button onclick="editHistoryItem(${item.id})" class="btn-hist-edit" title="แก้ไขประวัติ">
                                ✏️
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Error rendering history:", err);
        // 🟢 กล่องแจ้งเตือนสภาวะขัดข้องพ่นผ่านคลาสสากลสะอาดยกแผง
        historyContainer.innerHTML = `<div class="hist-error-msg">เกิดข้อผิดพลาดในการโหลดประวัติครับ</div>`;
    }
}

//แก้ไขรายละเอียดประวัติการซื้อวัตถุดิบ 04-05-2026
function editHistoryItem(id) {
    // ดักจับ Element เป้าหมายตามโครงสร้าง ID มาตรฐานสากลที่ถูกต้อง
    const nameSpan = document.getElementById(`name-display-${id}`);
    const priceSpan = document.getElementById(`price-display-${id}`);
    
    // เกราะป้องกันความปลอดภัยระดับสูงสุด ป้องกันปัญหา Error เผื่อหาไอดีไม่เจอ
    if (!nameSpan || !priceSpan) {
        console.error("หาไอดีไม่เจอครับพี่! เช็คสะกดใน HTML อีกทีนะ");
        return;
    }

    // แกะและเก็บค่าเดิม (ล้างลูกน้ำและสัญลักษณ์ราคาออก เพื่อให้พร้อมแก้ไขเป็นตัวเลขเพียวๆ)
    const oldName = nameSpan.innerText;
    const oldPrice = priceSpan.innerText.replace(/,/g, '').replace('.-', '');

    // 🟢 เสกสลับหน้ากากเข้าโหมดพิมพ์แก้ไข ผ่านคลาสสากล คลีนสะอาดยกชุด ไร้สไตล์อินไลน์ปนเปื้อนใน JS
    nameSpan.innerHTML = `
        <input type="text" id="edit-name-${id}" value="${oldName}" class="input-inline-edit edit-width-name">
    `;
    
    priceSpan.innerHTML = `
        <input type="number" id="edit-price-${id}" value="${oldPrice}" class="input-inline-edit edit-width-price"> 
        <button onclick="saveEdit(${id})" class="btn-inline-save">ตกลง</button>
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
    if (!priceDisplay) return; // 🔒 เกราะป้องกันระบบ เผื่อดึง Element ผิดพลาด

    try {
        // 1. [การดึงข้อมูล]: ดึงบิลรายการล่าสุดที่ซื้อสำเร็จจากคลังข้อมูลตามปกติ
        const lastItem = await db.shopping_list
            .where('status').equals('completed')
            .reverse()
            .first(); 

        if (lastItem) {
            // 2. [การจัดการชื่อ]: ตัดส่วนวงเล็บออกเพื่อความกระชับสวยงามบนกระดานแดชบอร์ด
            const shortName = lastItem.name ? lastItem.name.split(' (')[0] : "ไม่ระบุชื่อ";
            
            // 3. [การแสดงผล]: พ่นโครงสร้าง HTML ขาวสะอาดหมดจด ควบคุมระเบียบดีไซน์ผ่านคลาส CSS
            priceDisplay.innerHTML = `
                <div class="insight-top-flex">
                    <div class="insight-title">
                        ${shortName} ล่าสุด <span class="insight-price-tag">${Number(lastItem.price).toLocaleString()}.-</span>
                    </div>
                    <button onclick="showPriceHistory('${lastItem.name}')" class="btn-insight-search" title="ส่องประวัติราคา">
                        🔍
                    </button>
                </div>
                <div class="insight-bottom-time">
                    🕒 <small>ซื้อเมื่อ: ${lastItem.confirmed_date || lastItem.date || 'ไม่ระบุเวลา'}</small>
                </div>
            `;
        } else {
            // 4. [กรณีหน้าใหม่]: หน้าจอว่างเปล่าไร้ประวัติ พ่นผ่านคลาสสากลสะอาดยกชุด
            priceDisplay.innerHTML = `
                <div class="insight-empty-state">
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

// ฟังก์ชันใหม่สำหรับปุ่มสีดำ: บันทึกข้อมูลยอดรวมวัตถุดิบแล้วค่อยปิดหน้าจอ
async function saveAndCloseShopping() {
    try {
        // 1. ดึงรายการที่ยังค้างอยู่ (pending) ทั้งหมดมาตรวจสอบ
        const pendingList = await db.shopping_list.where('status').equals('pending').toArray();
        let totalInvestmentToday = 0;

        // ใช้ for...of เพื่อให้สามารถใช้ await บันทึกทีละรายการได้อย่างแม่นยำ
        for (const item of pendingList) {
            // ดึงค่าจากช่อง Input โดยใช้ ID 'real-price-' ให้ตรงกับที่พี่วาดใน renderShoppingList
            const priceInput = document.getElementById(`real-price-${item.id}`);
            
            if (priceInput && priceInput.value !== "") {
                const finalPrice = parseFloat(priceInput.value);
                
                // [จุดเปลี่ยนสำคัญ] อัปเดตราคากลับลงไปในฐานข้อมูลของรายการนั้นๆ จริงๆ
                // เพื่อให้คราวหน้าเปิดมา ราคาจะไม่เป็น 0 และประวัติจะถูกบันทึกไว้
                await db.shopping_list.update(item.id, { 
                    price: finalPrice,
                    status: 'completed' // เปลี่ยนสถานะเป็นเสร็จสิ้นการซื้อวัตถุดิบ
                });

                // รวมยอดเงินที่ใช้ไปเฉพาะรายการที่มีการกรอกราคาในรอบนี้
                totalInvestmentToday += finalPrice;
            }
        }

        // 2. บันทึกยอดรวมเงินลงทุน (ต้นทุน) ลงใน dailysummary
        const today = new Date().toISOString().split('T')[0]; // ✅ แบบสากล (2026-05-06)
        const existingRecord = await db.dailysummary.get(today);

        if (existingRecord) {
            // ถ้าวันนี้เคยลงบันทึกไปแล้ว ให้บวกยอดใหม่ทบเข้าไปใน daily_investment
            await db.dailysummary.update(today, {
                daily_investment: (existingRecord.daily_investment || 0) + totalInvestmentToday
            });
        } else {
            // ถ้าเป็นรายการแรกของวัน ให้สร้างแถวใหม่ในตาราง
            await db.dailysummary.add({
                summary_date: today,
                daily_investment: totalInvestmentToday,
                total_sales: 0
            });
        }

        // 3. แจ้งเตือนหลานรักและปิดหน้าต่าง
        alert("หลานจดราคาและคำนวณต้นทุนให้ยายเรียบร้อยแล้วครับ! ✨");
        closeShoppingManager(); 

        // 📢 [จุดแก้ไข]: เพิ่มบรรทัดนี้ลงไปตรงท้ายสุดก่อนจบฟังก์ชัน
        if (typeof runSmartAnalysis === 'function') {
            await runSmartAnalysis();}
        
        // 4. (ทางเลือก) สั่งโหลดรายการใหม่ที่หน้าหลักถ้าจำเป็น
        // if (typeof renderDashboard === 'function') renderDashboard();

    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการบันทึก:", error);
        alert("ขอโทษครับพี่ ระบบบันทึกขัดข้อง ลองเช็กค่าที่กรอกอีกครั้งนะ");
    }
}

// ==========================================
// วิเคราะห์ "ช่วงเวลาทำเงิน" 4-05-2026
// ==========================================

//นับว่าในแต่ละชั่วโมง (0-23) มีออเดอร์เข้าเท่าไหร่
async function getPeakSalesData() {
    const orders = await db.orders.toArray();
    const hourlySales = new Array(24).fill(0);
    
    // [จุดที่เพิ่ม]: นับสถิติวันในสัปดาห์ (0 = อาทิตย์, 6 = เสาร์)
    const dailySales = new Array(7).fill(0);
    const dayNames = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

    orders.forEach(order => {
        if (order.created_at) {
            const date = new Date(order.created_at);
            
            // เก็บสถิติชั่วโมง
            const hour = date.getHours();
            hourlySales[hour]++;
            
            // เก็บสถิติวัน
            const day = date.getDay();
            dailySales[day]++;
        }
    });

    return { hourlySales, dailySales, dayNames };
}

//2. ส่วนการแสดงผล (UI)
async function renderPeakSalesChart() {
    // ดึงข้อมูลวิเคราะห์ช่วงเวลาทำเงินจากระบบหลังบ้านตามปกติ
    const { hourlySales, dailySales, dayNames } = await getPeakSalesData();
    
    const maxSalesHour = Math.max(...hourlySales);
    const maxSalesDayValue = Math.max(...dailySales);
    const peakDayName = dayNames[dailySales.indexOf(maxSalesDayValue)];
    
    const chartContainer = document.getElementById('peak-sales-chart');
    if (!chartContainer) return; // 🔒 เกราะป้องกันป้องกัน Error เช็กความพร้อมของ DOM

    let html = `
        <div class="chart-peak-card">
            
            <div class="chart-peak-header">
                <div>
                    <div class="header-title">🕒 ช่วงเวลาทำเงิน</div>
                    <div class="header-subtitle">
                        🌟 วันที่ขายดีที่สุด: วัน${peakDayName}
                    </div>
                </div>
                <div class="header-update-zone">
                    <span class="time-lbl">อัปเดตล่าสุด</span>
                    <span class="time-val">${new Date().toLocaleDateString('th-TH')}</span>
                </div>
            </div>

            <div class="chart-bars-timeline">
                ${hourlySales.map((count, hour) => {
                    // คำนวณความสูงตามสัดส่วนคณิตศาสตร์เหมือนเดิม
                    const height = maxSalesHour > 0 ? (count / maxSalesHour) * 100 : 5;
                    const isPeak = count === maxSalesHour && maxSalesHour > 0;
                    
                    // 🟢 สลับคลาสสีแท่งกราฟแทนการพ่น String Gradient สดในนี้
                    const barClass = isPeak ? 'bar-peak' : 'bar-normal';
                    
                    // ปรับแต่งป้ายกำกับชั่วโมงให้คลีน คุมขนาดฟอนต์ผ่าน CSS คลาส 'bar-time-label'
                    const label = [6, 12, 18, 21].includes(hour) 
                        ? `<span class="bar-time-label">${hour}</span>` 
                        : '';
                    
                    return `
                        <div class="chart-bar-column">
                            <div class="bar-pillar ${barClass}" style="height: ${height}%;"></div>
                            ${label}
                        </div>
                    `;
                }).join('')}
            </div>

            <div class="chart-peak-footer">
                <div class="footer-icon">🔥</div>
                <div>
                    <div class="footer-meta-lbl">สรุปภาพรวม:</div>
                    <div class="footer-meta-val">
                        มักจะขายดีใน <span class="highlight-orange">วัน${peakDayName}</span> 
                        เวลา <span class="highlight-orange">${hourlySales.indexOf(maxSalesHour)}:00 น.</span>
                    </div>
                </div>
            </div>
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
    // เลือกจุดที่จะวาดข้อมูลตามโครงสร้าง ID สากลของระบบ
    const container = document.getElementById('efficiency-content-area');
    if (!container) return; // 🔒 เกราะป้องกันป้องกัน Error

    if (totalInvest === 0) return;

    // คำนวณคะแนนประสิทธิภาพเต็ม 10 ตามตรรกะโมเดลธุรกิจเดิม
    let rawScore = (totalSales / (totalInvest * 3)) * 10;
    let scoreForShow = Math.min(Math.round(rawScore * 10) / 10, 10); // ฟอร์แมตทศนิยม 1 ตำแหน่ง เช่น 8.5

    let statusText = "";
    let stateClass = "";

    // 🟢 เปลี่ยนจากการพ่นโค้ดสีสด มาเป็นการคัดกรองคลาสสเตตัสคู่บุญฝั่ง CSS
    if (scoreForShow >= 8) {
        statusText = "สุดยอดครับยาย! บริหารเงินได้กริบมาก";
        stateClass = "eff-state-good";
    } else if (scoreForShow >= 5) {
        statusText = "พอใช้ได้ครับยาย แต่ยังลดต้นทุนได้อีกนะ";
        stateClass = "eff-state-fair";
    } else {
        statusText = "ต้องระวังครับ! ช่วงนี้รายจ่ายสูงกว่ายอดขายนะ";
        stateClass = "eff-state-bad";
    }

    // 🟢 วาดโครงสร้าง HTML คลีนสะอาดยกแผง แยกฝั่งดีไซน์ไปให้ CSS ทำงานผ่านคลาสครอบตัวเดียว
    container.innerHTML = `
        <div class="${stateClass}">
            <div class="eff-score-display">
                ${scoreForShow}/10
            </div>
            
            <div class="eff-progress-track">
                <div class="eff-progress-fill" style="width: ${scoreForShow * 10}%;"></div>
            </div>
            
            <div class="eff-status-quote">
                ${statusText}
            </div>
        </div>
    `;
}

// ==========================================
// [เพิ่มเติม] ระบบแสดงประวัติการขายล่าสุด (ฝังส่วนลด) 25-05-2026
// ==========================================
async function renderRecentOrdersUI() {
    // 1. ตรวจสอบส่วนแสดงผล (id="recent-orders-list")
    const historyContainer = document.getElementById('recent-orders-list'); 
    if (!historyContainer) return;

    // ⚡ [มาตรการดักจับความ Real-Time]: หน่วงเวลารอ Transaction เบื้องหลังตามปกติ
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
        // 2. ดึงข้อมูลจาก Dexie DB 50 รายการล่าสุด
        const rawOrders = await db.orders.orderBy('id').reverse().limit(50).toArray();
        
        // กรณีไม่มีข้อมูลแสดงผลพ่นผ่านคลาสสากล
        if (rawOrders.length === 0) {
            historyContainer.innerHTML = '<p class="order-system-status status-empty">ยังไม่มีประวัติการขายวันนี้จ้า</p>';
            return;
        }

        // 3. [ขั้นตอนการจัดกลุ่ม] รวมรายการที่ order_id เดียวกันเป็นหนึ่งใบออเดอร์ตามปกติ
        const grouped = {};
        rawOrders.forEach(o => {
            if (!grouped[o.order_id]) {
                const cleanMethod = String(o.payment_method || '').toUpperCase().trim();

                grouped[o.order_id] = {
                    order_id: o.order_id,
                    time: new Date(o.created_at).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'}),
                    method: cleanMethod === 'CASH' ? 'เงินสด' : 'โอน/QR',
                    items: [],      
                    totalNet: 0,    
                    totalRaw: 0,    
                    discount: 0,    
                    fullData: o 
                };
            }

            if (o.discount && parseFloat(o.discount) > 0) {
                grouped[o.order_id].discount = Math.max(grouped[o.order_id].discount, parseFloat(o.discount));
            }

            if (o.total_price < 0) {
                grouped[o.order_id].discount += Math.abs(o.total_price);
            } else {
                grouped[o.order_id].items.push(`${o.menu_name} x${o.qty}`);
                grouped[o.order_id].totalRaw += Number(o.total_price || 0);
            }
        });

        // คำนวณสรุปยอดสุทธิท้ายบิลให้เที่ยงตรง
        Object.values(grouped).forEach(order => {
            if (order.discount > 0) {
                order.totalNet = Math.max(0, order.totalRaw - order.discount);
            } else {
                order.totalNet = order.totalRaw;
            }
        });

        // 4. คัดเอา 10 ออเดอร์ล่าสุดมาโชว์บนแผงควบคุมหน้าบ้าน
        const displayData = Object.values(grouped).slice(0, 10);

        // 5. [ส่วนการสร้างหน้าจอ] พ่นโครงสร้าง HTML สะอาดหมดจด ไร้สไตล์อินไลน์ตกค้าง
        historyContainer.innerHTML = `
            <h3 class="recent-orders-title">
                🕒 รายการออเดอร์ล่าสุด 
                <small>(อัปเดตล่าสุด: ${new Date().toLocaleTimeString('th-TH')})</small>
            </h3>
            ${displayData.map(order => {
                const hasDiscount = order.discount > 0; 
                
                // 🟢 สลับการแสดงผลสเตตัสการ์ดผ่านการครอบคลาสสากลแทนสไตล์อินไลน์แบบเดิม
                const cardStateClass = hasDiscount ? 'card-state-discount' : 'card-state-normal';

                return `
                    <div class="order-recent-card ${cardStateClass}">
                        
                        <div class="order-badge-line"></div>

                        <div class="order-info-left">
                            <div class="order-food-text">
                                ${order.items.join(', ')}
                            </div>
                            <small class="order-meta-text">
                                🕒 ${order.time} | 💳 ${order.method} 
                                ${hasDiscount ? `<span class="discount-highlight">[🔥 ลด ${order.discount.toLocaleString()}.-]</span>` : ''}
                            </small>
                        </div>
                        
                        <div class="order-pricing-right">
                            <div class="price-net">
                                ${order.totalNet.toLocaleString()}.-
                            </div>
                            
                            ${hasDiscount ? `
                                <div class="price-raw-box">
                                    <span>${order.totalRaw.toLocaleString()}</span>
                                </div>
                            ` : `
                                <div class="price-normal-lbl">ปกติ</div>
                            `}
                        </div>
                        
                        <button onclick="if(typeof reprintByGroupId === 'function') reprintByGroupId(${order.order_id})" 
                                class="btn-reprint-receipt" title="พิมพ์ใบเสร็จซ้ำ">
                            🧾
                        </button>
                    </div>
                `;
            }).join('')}
        `;

    } catch (err) {
        console.error("❌ โหลดประวัติพลาด:", err);
        historyContainer.innerHTML = '<p class="order-system-status status-error">เกิดข้อผิดพลาดในการดึงประวัติ</p>';
    }
}

// ฟังก์ชันเสริมสำหรับกดดูบิลเก่าจากหน้าประวัติ
// 🟢 ตัวแทนร่างทองของแถว 3197 + 3788 (Layer 1)
// หน้าที่: รับข้อมูลออเดอร์มาเป็นก้อนวัตถุ แปลงรูปแบบแล้วแสดงผลใบเสร็จทันที 25-05-2026
/**
 * 🖨️ [Reprint Processor] ทำหน้าที่เตรียมข้อมูลให้อาหารชุดเดิมกลับมาแสดงผลในใบเสร็จ
 * ปรับปรุง: เพิ่มระบบคำนวณราคาพิเศษย้อนหลัง เพื่อให้ใบเสร็จโชว์รายการ "(พิเศษ +10.-)" ได้ถูกต้อง
 */
function renderReprintFromObject(orderData) {
    if (!orderData) return;
    
    if (typeof showSmartReceipt === "function") {
        // --- 1. การคำนวณแยกส่วน (Reverse Logic) ---
        // เราคำนวณราคาต่อหน่วยรวมก่อน (total / qty)
        const unitPrice = orderData.qty ? (orderData.total_price / orderData.qty) : orderData.total_price;
        
        // เราสมมติ "ราคาอาหารปกติ" เพื่อแยกหาค่าพิเศษ 
        // *หมายเหตุ: หากระบบพี่มีฐานข้อมูลราคาเมนู (Menu DB) แนะนำให้ดึงจากตรงนั้นจะแม่นยำที่สุด
        // ในที่นี้เราจะหักลบด้วยค่าสมมติ หรือหากไม่มีออปชัน ระบบจะมองเป็น 0 ทันที
        const basePrice = 40; // 🎯 ราคากลางที่ยายขายปกติ
        const extraPrice = unitPrice > basePrice ? (unitPrice - basePrice) : 0;

        showSmartReceipt({
            order_id: orderData.order_id || null,
            items: [{ 
                name: orderData.menu_name, 
                price: unitPrice > basePrice ? basePrice : unitPrice, // ส่งราคาตั้งต้น
                qty: orderData.qty || 1, 
                options: orderData.options || "",
                // 🌟 [จุดสำคัญ]: ส่งคีย์ราคาพิเศษเพิ่มเข้าไป ใบเสร็จจะรับคีย์นี้ไปโชว์ (+10.-)
                optionPrice: extraPrice,
                option_price: extraPrice
            }],
            total_price: orderData.total_price,
            discount: orderData.discount || 0,
            payment_method: orderData.payment_method,
            created_at: orderData.created_at
        });
    } else {
        console.error("❌ หาฟังก์ชัน showSmartReceipt ไม่เจอครับเพื่อน!");
    }
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
    
    // 🔒 เกราะป้องกันระบบ เผื่อกรณีหา Element บน DOM ไม่เจอ
    if (!p1 || !p2 || !btn) return;

    // เงื่อนไขสากล: ความยาวเลขพร้อมเพย์ต้องตรงตามมาตรฐาน 10 หรือ 13 หลักเท่านั้น
    const isValidLength = (p1.length === 10 || p1.length === 13);
    
    // ตรวจสอบความสอดคล้องของข้อมูล
    if (p1 === p2 && isValidLength) {
        // 🟢 เปิดล็อกปุ่มให้ใช้งานได้ทันที ระบบสีเขียวจะสว่างขึ้นเองตามระเบียบ CSS
        btn.disabled = false;
    } else {
        // 🟢 ล็อกปุ่มไว้เมื่อข้อมูลไม่ถูกต้อง ระบบสีเทาจะสวมทับผ่านสเตตัส :disabled อัตโนมัติ
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

// ฟังก์ชัน Wrapper ช่วยอัปเดตข้อความบนหน้าจอ ก่อนจะส่งไม้ต่อให้ระบบกู้คืนข้อมูลดั้งเดิม 29-05-2026
function handleFileChangeWrapper(event) {
    const fileInput = event.target;
    const displayElement = document.getElementById('import-file-name-display');
    
    if (displayElement) {
        if (fileInput.files.length > 0) {
            // [การจัดการข้อมูล]: เมื่อคุณยายเลือกไฟล์สำเร็จ โชว์ชื่อไฟล์และสลับคลาสสีเขียวผ่าน CSS
            displayElement.innerText = "📄 " + fileInput.files[0].name;
            
            // 🟢 อัปเดตสเตตัสคลาสสะอาดยกชุด หมดห่วงเรื่องสารตกค้างอินไลน์สไตล์
            displayElement.classList.remove('file-state-empty');
            displayElement.classList.add('file-state-active');
        } else {
            // [กรณีกดยกเลิก]: ดีดข้อความกลับเป็นค่าเริ่มต้น และสลับคลาสสีเทาตามกฎระเบียบ
            displayElement.innerText = "ยังไม่ได้เลือกไฟล์เลยจ้าคุณยาย";
            
            // 🟢 อัปเดตสเตตัสคลาสกลับสู่สภาวะสแตนด์บาย
            displayElement.classList.remove('file-state-active');
            displayElement.classList.add('file-state-empty');
        }
    }
    
    // 🚀 ส่งไม้ต่อให้ฟังก์ชันกู้คืนระบบดั้งเดิม (restoreDatabase) ทำงานเต็มสูบตามปกติ
    if (typeof restoreDatabase === "function") {
        restoreDatabase(event);
    }
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


// ฟังก์ชัน "วาด" ใบเสร็จ (ใช้ทั้งตอนขายเสร็จ และตอนดึงย้อนหลัง) 27-04-2026
// --- วางแทนฟังก์ชันเดิมที่มีซ้ำกันทั้งหมด ---


// ฟังก์ชันดึงข้อมูลย้อนหลัง (เรียกจากหน้า Dashboard หรือหน้าประวัติ)
// 🟢 อยู่ใน Layer 1 (UI): ดึงข้อมูลออเดอร์ย้อนหลังมาเพื่อส่งต่อให้หน้าจอใบเสร็จแสดงผล 25-05-2026
async function getOrderAndShowReceipt(orderId) {
    try {
        if (!orderId) return;
        
        const order = await db.orders.get(orderId);
        if (order) {
            if (typeof showSmartReceipt === "function") {
                showSmartReceipt(order);
            } else {
                console.error("❌ หาฟังก์ชัน showSmartReceipt ไม่เจอครับเพื่อน!");
            }
        } else {
            alert("ไม่พบข้อมูลออเดอร์นี้ในเครื่องจ้าคุณยาย");
        }
    } catch (err) {
        console.error("❌ ระบบดึงบิลย้อนหลังมีปัญหา:", err);
        alert("เกิดข้อผิดพลาดในการดึงข้อมูลใบเสร็จ");
    }
}

//ฟังก์ชันนี้จะดึงออเดอร์จาก db.orders (Dexie) มาโชว์แบบเรียงตามเวลาล่าสุด 28-04-2026
async function renderTodayOrdersTableUI() {
    const tableBody = document.getElementById('recent-orders-body');
    if (!tableBody) return; // 🔒 เกราะป้องกันป้องกัน Error เช็กความพร้อมของตาราง

    try {
        const todayStr = new Date().toLocaleDateString('sv-SE');
        
        // 1. ดึงข้อมูลของวันนี้ทั้งหมดจากคลังข้อมูลตามปกติ
        const allOrders = await db.orders
            .where('created_at')
            .startsWith(todayStr)
            .toArray();

        // 2. รวมร่างรายการที่ order_id เดียวกัน ป้องกันส่วนลดซ้ำซ้อนตามตรรกะเดิม
        const groupedOrders = {};
        allOrders.forEach(order => {
            const gid = order.order_id || order.id; 
            if (!groupedOrders[gid]) {
                groupedOrders[gid] = {
                    order_id: gid,
                    time: order.created_at.includes(' ') ? order.created_at.split(' ')[1].substring(0, 5) : "00:00",
                    itemList: [],
                    totalNet: 0,
                    totalDiscount: 0 
                };
            }

            if (order.total_price > 0) {
                groupedOrders[gid].itemList.push(`${order.menu_name}${order.qty > 1 ? ' x' + order.qty : ''}`);
            }
            
            groupedOrders[gid].totalNet += Number(order.total_price || 0);
            
            if (order.discount > 0) {
                groupedOrders[gid].totalDiscount += Number(order.discount || 0);
            }
        });

        // 3. จัดการเรียงคัดบิลล่าสุด 10 รายการป้องกันการ Error แก้วิกฤตหน้าบ้าน
        const displayOrders = Object.values(groupedOrders).reverse().slice(0, 10);

        // 4. วาดโครงสร้างตารางแสดงผล คลีนขยะอินไลน์สไตล์ออกพ่นผ่านคลาสสากล
        tableBody.innerHTML = displayOrders.length 
            ? '' 
            : '<tr><td colspan="4" class="table-order-empty">ยังไม่มีรายการของวันนี้</td></tr>';

        // วนลูปสร้างแถวตารางแบบมืออาชีพ ขาวสะอาดปราศจากอินไลน์สารเคมี
        displayOrders.forEach(group => {
            const tr = document.createElement('tr');
            tr.className = "order-table-row"; // 🟢 สวมคลาสควบคุมระเบียบแถวตารางจาก CSS 100%
            
            tr.innerHTML = `
                <td>${group.time}</td>
                <td class="col-items">
                    ${group.itemList.join(', ')}
                    ${group.totalDiscount > 0 ? `<br><small class="discount-lbl">(ส่วนลด ${group.totalDiscount}.-)</small>` : ''}
                </td>
                <td class="col-price">
                    <b>${group.totalNet.toLocaleString()}.-</b>
                </td>
                <td class="col-action">
                    <button onclick="reprintByGroupId(${group.order_id})" class="btn-table-reprint" title="พิมพ์ใบเสร็จซ้ำ">
                        🧾
                    </button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    } catch (err) {
        console.error("โหลดประวัติพลาด:", err);
    }
}



//ดึง "ทั้งชุด" มาโชว์ในใบเสร็จ 28-04-2026
/**
 * 🖨️ [Group Reprint Processor] ดึงข้อมูลออเดอร์ทั้งกลุ่มมาพิมพ์ใบเสร็จใหม่
 * ปรับปรุง: เพิ่มระบบคำนวณราคาพิเศษย้อนหลัง (Reverse Math) ให้กับทุกรายการในกลุ่ม
 */
async function reprintByGroupId(orderId) {
    // 1. ดึงทุกรายการที่มี order_id เดียวกันออกมา
    const orders = await db.orders.where('order_id').equals(orderId).toArray();
    
    if (orders.length > 0) {
        // --- [ดึงส่วนลดที่ฝังไว้] ---
        const discountEntry = orders.find(o => o.discount > 0);
        const savedDiscount = discountEntry ? Number(discountEntry.discount) : 0;

        // 2. ปรับปรุงการ Map ข้อมูลรายการอาหาร (ใส่ลอจิกหาค่าพิเศษเพิ่ม)
        const data = {
            order_id: orderId,
            items: orders.map(o => {
                // คำนวณราคาต่อหน่วยจริงจากฐานข้อมูล
                const unitPrice = o.total_price / o.qty;
                // 🎯 สมมติราคาปกติ (ต้องตรงกับที่ตั้งไว้ใน renderReprintFromObject)
                const basePrice = 40; 
                const calculatedExtraPrice = unitPrice > basePrice ? (unitPrice - basePrice) : 0;

                return { 
                    name: o.menu_name, 
                    price: unitPrice > basePrice ? basePrice : unitPrice, 
                    qty: o.qty, 
                    options: o.options,
                    // 🌟 [จุดสำคัญ]: ฝังราคาพิเศษเข้าไป เพื่อให้ showSmartReceipt นำไปพ่นลงใบเสร็จ
                    optionPrice: calculatedExtraPrice,
                    option_price: calculatedExtraPrice 
                };
            }),
            
            // 3. คำนวณยอดรวมราคาเต็ม (รวมทั้งหมดในกลุ่ม)
            total_price: orders.reduce((sum, o) => sum + Number(o.total_price), 0),
            discount: savedDiscount, 
            payment_method: orders[0].payment_method,
            created_at: orders[0].created_at
        };

        // 4. ส่งข้อมูลที่ครบถ้วนไปให้ showSmartReceipt วาดใบเสร็จ
        showSmartReceipt(data);
    }
}

// ฟังก์ชันปิดใบเสร็จ (นายเขียนไว้แล้ว เอามาวางคู่กัน)
// 🟢 อยู่ใน Layer 1: หน้าที่ปิดโมดอลใบเสร็จและเคลียร์ QR Code อย่างปลอดภัย 25-05-2026
function closeReceipt() {
    const receiptModal = document.getElementById('receipt-modal');
    if (receiptModal) {
        receiptModal.style.display = 'none';
    }
    
    const qrArea = document.getElementById('qrcode');
    if (qrArea) {
        qrArea.innerHTML = ''; // ล้าง QR เก่าทิ้งเพื่อป้องกันการสับสนในบิลถัดไป
    }
}

// ==========================================
// กล่องที่ 7: ระบบใบเสร็จฉลาด (Smart Receipt & QR) - เติม 2-05-2026
// ==========================================
/**
 * 🖨️ [Smart Receipt Viewer] ฟังก์ชันวาดและแสดงผลใบเสร็จอัจฉริยะ (หน้าต่าง Modal)
 * ปรับปรุงความรอบคอบ: เพิ่มการคำนวณและแสดงราคาค่าตัวเลือกเสริม (เช่น พิเศษ +10.-) ลงในแถวรายการอาหาร
 */
async function showSmartReceipt(data) {
    const modal = document.getElementById('receipt-modal');
    if (!modal) return; // 🔒 เกราะป้องกันป้องกัน Error

    // --- [เพิ่มบรรทัดนี้ตรงนี้เลยครับ] ---
    document.body.appendChild(modal); 
    // ---------------------------------

    // --- 1. เตรียมข้อมูลราคา (ยึดตามที่บันทึกจริง) ---
    const discountAmount = parseFloat(data.discount) || 0;
    
    // 🚩 หัวใจสำคัญ: ยึดราคาเดิมจากออเดอร์ย้อนหลังเพื่อเซฟตี้สูงสุดตามตรรกะพี่
    let finalTotal = parseFloat(data.total_price) || 0;

    if (data.items && data.items.length > 0) {
        const hasDiscountInItems = data.items.some(item => (parseFloat(item.total_price) || 0) < 0);
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
    
    // --- 3. รายการอาหาร (กรองเอาเฉพาะเมนูปกติ ไม่เอาบรรทัดส่วนลดซ้ำซ้อน) ---
    const itemsContainer = document.getElementById('r-items');
    const foodItems = data.items.filter(item => {
        const p = parseFloat(item.total_price) || parseFloat(item.price) || 0;
        return p > 0;
    });

    // คำนวณราคารายบรรทัด และวาดโครงสร้างตารางรายการผ่านคลาส CSS
    itemsContainer.innerHTML = foodItems.map(item => {
        const displayName = item.menu_name || item.name || "รายการอาหาร";
        
        const opPrice = parseFloat(item.optionPrice || item.option_price || item.extraPrice || item.extra_price || 0);
        const itemBasePrice = parseFloat(item.price) || 0;
        const finalQty = item.qty || 1;
        const displayPrice = parseFloat(item.total_price) || ((itemBasePrice + opPrice) * finalQty);

        // 🟢 ย้ายโค้ดสีอินไลน์ระบุตรงออก เปลี่ยนมาครอบคลาสควบคุมความงาม
        const optionTextTag = item.options 
            ? `<br><small class="rcpt-option-detail">(${item.options}${opPrice > 0 ? ` +${opPrice.toLocaleString()}.-` : ''})</small>` 
            : '';

        return `
            <div class="rcpt-item-row">
                <span>${displayName} ${optionTextTag}</span>
                <span class="rcpt-item-price">x${finalQty} ${displayPrice.toLocaleString()}.-</span>
            </div>
        `;
    }).join('');
    
    // ยอดรวมสุทธิบิล
    document.getElementById('r-total').innerText = `รวมทั้งสิ้น: ${finalTotal.toLocaleString()}.-`;
    
    // --- 4. วิธีชำระเงินและส่วนลด ---
    const method = String(data.payment_method || "").toLowerCase();
    let isQR = (method === 'qr' || method === 'transfer'); 
    let paymentHTML = "วิธีชำระ: " + (isQR ? '📱 เงินโอน/QR' : '💵 เงินสด');
    
    if (discountAmount > 0) {
        // 🟢 ปรับเปลี่ยนมาพ่นผ่านคลาสแจ้งเตือนส่วนลดท้ายบิลของ CSS
        paymentHTML = `<div class="rcpt-discount-banner">🔥 ส่วนลดท้ายบิล: -${discountAmount.toLocaleString()}.-</div>` + paymentHTML;
    }
    document.getElementById('r-payment').innerHTML = paymentHTML;
    
    // --- 5. จัดการส่วน QR Code (รองรับโหมด Offline แบบสมบูรณ์) ---
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = ""; // ล้างกระดานวาด

    if (isQR) {
        const promptpayNumber = ppData ? ppData.value : null;
        if (promptpayNumber) {
            const cleanNumber = promptpayNumber.replace(/[^0-9]/g, "").trim();
            const qrAmount = finalTotal;

            if (navigator.onLine) {
                // โหมด Online: แสดงผลคลีนสไตล์ผ่านคลาสสากล
                qrContainer.innerHTML = `
                <div class="rcpt-qr-card qr-online">
                    <img src="https://promptpay.io/${cleanNumber}/${qrAmount}.png">
                    <p class="qr-meta-caption">
                        <span class="status-net-online">${cleanNumber}</span><br>
                        <span class="txt-amount-green">ยอดเงิน: ${qrAmount.toLocaleString()} บาท</span>
                    </p>    
                </div>`;
            } else {
                // โหมด Offline: ดึงคลาสสากลมาคุมกรอบคิวอาร์แทนคำสั่ง .style.cssText ดั้งเดิม
                if (typeof QRCode !== 'undefined' && window.promptpayQr) {
                    try {
                        const payload = window.promptpayQr.generatePayload(cleanNumber, { amount: qrAmount });
                        
                        const qrBox = document.createElement('div');
                        qrBox.className = "rcpt-qr-card"; // 🟢 มอบหน้าที่ความงามให้ CSS ดูแลทั้งหมด
                        qrContainer.appendChild(qrBox);

                        new QRCode(qrBox, {
                            text: payload,
                            width: 200,
                            height: 200,
                            colorDark: "#000000",
                            colorLight: "#ffffff",
                            correctLevel: QRCode.CorrectLevel.H 
                        });

                        qrContainer.innerHTML += `
                        <p class="qr-meta-caption">
                            <span class="status-net-offline">⚠️ โหมด Offline (สแกนได้ปกติ)</span><br>
                            <span class="status-net-online">${cleanNumber}</span>
                        </p>`;
                    } catch (err) {
                        console.error("QR Local Error:", err);
                        if (typeof showOfflineText === 'function') showOfflineText(qrContainer, cleanNumber, qrAmount);
                    }
                } else {
                    if (typeof showOfflineText === 'function') showOfflineText(qrContainer, cleanNumber, qrAmount);
                }
            }
        } else {
            qrContainer.innerHTML = "<p class='rcpt-status-error-lbl'>ยังไม่ได้ตั้งค่าเลข PromptPay</p>";
        }
    } else {
        // สภาวะรับเงินสด: ถอนอินไลน์สไตล์ออกพ่นผ่านคลาสคุมไอคอน
        qrContainer.innerHTML = `<div class="rcpt-cash-success-icon">✅</div><p>ขอบคุณที่ชำระเงินสดครับ</p>`;
    }

    modal.style.display = 'flex'; // คงคำสั่งคุมโครงสร้าง Modal ยืดหยุ่นไว้ตามกฎระเบียบ
}

    

// 🚩 อย่าลืมก๊อปปี้ฟังก์ชันเสริมนี้ไปวางไว้ "นอก" ฟังก์ชันหลักด้วยนะครับ 04-05-2026
function showOfflineText(container, number, amount) {
    // 🔒 เกราะป้องกันระบบ เผื่อกรณีตำแหน่งพ่นข้อมูลไม่มีอยู่จริงบนหน้าจอ
    if (!container) return;

    // พ่นโครงสร้าง HTML สะอาดหมดจด ไร้เศษขยะสไตล์อินไลน์ปนเปื้อน 100%
    container.innerHTML = `
        <div class="rcpt-offline-box">
            <p class="offline-title-lbl">⚠️ ตอนนี้ระบบ Offline</p>
            <p class="offline-desc-text">โอนเงิน PromptPay ตามเลขนี้ได้เลยครับ:</p>
            <h2 class="offline-number-display">${number}</h2>
            <p class="offline-amount-display">ยอดโอน: ${amount.toLocaleString()} บาท</p>
            <p class="offline-footnote-lbl">*สแกน QR ไม่ได้เนื่องจากไม่ได้โหลดไฟล์เสริม</p>
        </div>
    `;
}

// ฟังก์ชันดูใบเสร็จย้อนหลัง
// 🟢 ตัวแทนร่างทองของแถว 3962 (Layer 1 ที่ดึงข้อมูลจาก Layer 3)
// หน้าที่: รับเลข ID บิล วิ่งไปดึงข้อมูลจากฐานข้อมูลขึ้นมา แล้วค่อยสั่งพิมพ์ใบเสร็จ 25-05-2026
/**
 * 🖨️ [Receipt Reprinter] ฟังก์ชันดึงข้อมูลออเดอร์เก่ามาพิมพ์ใบเสร็จซ้ำ
 * ปรับปรุงความรอบคอบ: ดักจับและแยกแยะราคาตัวเลือกเสริม (Options) ออกมาให้ระบบใบเสร็จเห็นอย่างชัดเจน
 */
async function reprintReceiptById(orderId) {
    try {
        if (!orderId) return;
        
        // 🎯 1. ดึงข้อมูลบิลประวัติศาสตร์จากฐานข้อมูล IndexedDB
        const order = await db.orders.get(orderId);
        
        if (order) {
            if (typeof showSmartReceipt === "function") {
                
                // 🧠 [ตรรกะถอดรหัสราคาออปชันเสริมอย่างปลอดภัย]
                // ดึงราคาพิเศษที่ซ่อนอยู่ในเบส (เผื่อไว้ทั้งชื่อคีย์แบบงู_และแบบอูฐ) ถ้าไม่มีให้ Fallback เป็น 0 หรือ 10 ตามลอจิกตั้งต้น
                const optionPrice = Number(order.option_price || order.optionPrice || order.extra_price || order.extraPrice || 0);
                
                // แกะราคาเนื้ออาหารแท้ ๆ ออกมา (เอาเงินรวม ลบ ค่าพิเศษออกก่อน แล้วค่อยคำนวณราคาต่อจานเริ่มต้น)
                const baseTotalPrice = Number(order.total_price) - optionPrice;
                const finalQty = Number(order.qty) || 1;
                const singleItemPrice = baseTotalPrice > 0 ? (baseTotalPrice / finalQty) : Number(order.price || baseTotalPrice);

                // 📦 2. แพ็กก้อน Data ส่งต่อให้ฟังก์ชันวาดใบเสร็จอัจฉริยะ
                const data = {
                    order_id: order.order_id || orderId,
                    items: [{ 
                        name: order.menu_name, 
                        price: singleItemPrice,           // 🥩 ราคาเนื้ออาหารแท้ ๆ ต่อหน่วย
                        qty: finalQty, 
                        options: order.options || "",     // 📝 ตัวหนังสือ "พิเศษ"
                        optionPrice: optionPrice,         // 💰 [คีย์วิกฤตที่เพิ่มเข้ามา]: ส่งยอดราคาพิเศษเข้าไปด้วย!
                        option_price: optionPrice         // ดักคีย์ตัวหนอนเผื่อลอจิกใบเสร็จใช้อ่าน
                    }],
                    total_price: Number(order.total_price),
                    discount: Number(order.discount || 0),
                    payment_method: order.payment_method,
                    created_at: order.created_at
                };

                console.log("🖨️ [Reprint Payload] ส่งดาต้าพิมพ์บิลซ้ำแบบระบุราคาออปชันชัดเจน:", data);
                showSmartReceipt(data);
            }
        } else {
            alert("ไม่พบข้อมูลออเดอร์รหัสนี้ในฐานข้อมูลจ้า");
        }
    } catch (err) {
        console.error("❌ ระบบดึงข้อมูลพิมพ์บิลซ้ำมีปัญหา:", err);
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




// iOS & Popstate + ระบบกันลืม: เตือนก่อนปิดหน้าจอ 06-05-2026
// --- 1. ระบบจัดการเมื่อโหลดหน้าเว็บสำเร็จ ---
window.addEventListener('load', () => {
    // เช็กว่าเป็นเครื่อง iPhone/iPad หรือไม่
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    // เช็กว่าตอนนี้ใช้งานผ่านหน้าเว็บปกติ หรือกดเปิดจากไอคอนแอป (Standalone)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    // ถ้าใช้ iPhone และ "ยังไม่ได้ติดตั้งแอป" ให้โชว์วิธีติดตั้ง (ios-install-guide)
    const installGuide = document.getElementById('ios-install-guide');
    if (isIOS && !isStandalone && installGuide) {
        installGuide.style.display = 'block';
    }
});

// --- 2. ระบบกันลืม + กันท่อ P2P หลุด: เตือนก่อนปิดหรือรีเฟรชหน้าจอ ---
/**
 * ระบบป้องกันการปิดหน้าจอโดยไม่ตั้งใจ (Safety Guard)
 * [ปรับปรุง]: เปลี่ยนมาเช็ก window.currentConn เพื่อให้รู้สถานะท่อวาร์ปที่แท้จริง
 */
window.addEventListener('beforeunload', (event) => {
    // 🔍 1. เช็กของค้างในตะกร้า (โหมดขายหน้าร้าน)
    const hasItems = typeof cart !== 'undefined' && cart.length > 0;
    
    // 🔍 2. เช็กระบบ P2P (โหมดวาร์ป)
    // 🚩 [จุดสำคัญ]: เปลี่ยนจาก currentConn ลอยๆ เป็น window.currentConn
    // เพื่อดึงสถานะจากกระดานกลางมาเช็กว่า "ท่อยังเชื่อมอยู่ไหม"
    const isP2PActive = (window.currentConn && window.currentConn.open);

    // 🚩 ถ้ามีออเดอร์ค้าง หรือ ท่อวาร์ปยังเปิดอยู่
    if (hasItems || isP2PActive) {
        // บังคับให้บราวเซอร์หยุดชะงัก
        event.preventDefault();
        
        // 💡 สิ่งที่จะเกิดขึ้น: 
        // บราวเซอร์จะแสดง Popup มาตรฐานว่า "คุณแน่ใจไหมที่จะออกจากไซต์นี้?" 
        // เพื่อป้องกันเครื่องครัวหลุดการเชื่อมต่อโดยไม่ตั้งใจครับ
        event.returnValue = ''; 
        return ''; 
    }
});

// ดักจับการกดปุ่ม Back ของบราวเซอร์/มือถือ
window.addEventListener('popstate', function() {
    const modal = document.getElementById('price-history-modal'); // ใส่ ID ของ Pop-up พี่
    if (modal && modal.style.display === 'block') {
        // ถ้า Modal เปิดอยู่ ให้ปิดมันซะ และไม่ให้มันเปลี่ยนหน้า
        closePriceHistoryModal(); // เรียกฟังก์ชันปิด Pop-up ของพี่
    }
});

// สั่งให้ระบบวิเคราะห์ (รวมถึงกล่องม่วง) ทำงานทันทีที่เปิดหน้าจอ 06-05-2026
document.addEventListener('DOMContentLoaded', () => {
    runSmartAnalysis(); 
    // ถ้าพี่มีฟังก์ชันแสดงรายการจดของด้วย ก็ใส่ต่อท้ายกันได้เลย
    if (typeof renderShoppingList === 'function') renderShoppingList();
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
