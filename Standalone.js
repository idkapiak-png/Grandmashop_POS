// ==========================================
// กล่องที่ 1: หัวใจระบบ (ฐานข้อมูล Dexie)
// ==========================================
const db = new Dexie("StandaloneDatabase");

db.version(3).stores({
   orders: '++id, menu_name, total_price, created_at, options, payment_method',
    dailysummary: 'summary_date, total_sales, egg_count',
    menus: '++id, name, price',
    extra_options: '++id, name, price' 
});

db.open().catch(err => console.error("เปิดฐานข้อมูลไม่ได้: " + err.stack));

let currentOrder = { name: "", price: 0, qty: 1 };

// ==========================================
// กล่องที่ 2: ระบบจัดการหน้าตาเว็บและการตั้งค่า
// ==========================================
function showSetting() {
    // ดึงค่าปัจจุบันไปใส่ในช่อง Input ของหน้าตั้งค่า
    const nameInput = document.getElementById('name-input');
    const nameMain = document.getElementById('name-main');
    if (nameInput && nameMain) nameInput.value = nameMain.innerText;

    // เพิ่มบรรทัดนี้ลงไปท้ายสุด
    history.pushState({ page: 'settings' }, 'Settings', '#settings');

    const menuInput = document.getElementById('menu-input');
    const menuName = document.getElementById('menu-name');
    if (menuInput && menuName) menuInput.value = menuName.innerText;

    document.getElementById('front-page').style.display = 'none';
    document.getElementById('back-page').style.display = 'block';

    loadDashboardData();
    renderMenuSettings(); 
    renderOptionsSettings(); 
}

function saveAndExit() {
    const shopName = document.getElementById('name-input').value;
    const shopMenu = document.getElementById('menu-input').value;

    // เพิ่ม: บันทึกค่าการนับ
    const counterLabel = document.getElementById('counter-label-input').value;
    const counterUnit = document.getElementById('counter-unit-input').value;

    if(shopName.trim() !== "") {
        document.getElementById('name-main').innerText = shopName;
        localStorage.setItem('shopName', shopName);
    }
    if(shopMenu.trim() !== "") {
        document.getElementById('menu-name').innerText = shopMenu;
        localStorage.setItem('shopMenu', shopMenu);
    }

    if(counterLabel.trim() !== "") {
        localStorage.setItem('counterLabel', counterLabel);
        document.getElementById('display-label').innerText = "📊 วันนี้ใช้" + counterLabel + "ไปแล้ว";
    }
    if(counterUnit.trim() !== "") {
        localStorage.setItem('counterUnit', counterUnit);
        document.getElementById('display-unit').innerText = counterUnit;
    }

    // อัปเดตหัวตารางใน Dashboard ด้วย
    const headerLabel = document.getElementById('dashboard-unit-header');
    const headerUnit = document.getElementById('dashboard-unit-name');

    if (headerLabel) headerLabel.innerText = counterLabel || "รายการ";
    if (headerUnit) headerUnit.innerText = counterUnit || "หน่วย";

    // เพิ่มบรรทัดนี้: ถ้าปัจจุบันอยู่ที่หน้าตั้งค่า (#settings) ให้สั่งย้อนกลับประวัติ Browser ด้วย
    if (window.location.hash === '#settings') {
        history.back(); 
    }

    document.getElementById('front-page').style.display = 'block';
    document.getElementById('back-page').style.display = 'none';
    
    // รีเฟรชหน้าขายให้เป็นข้อมูลล่าสุดเสมอ
    renderOrderButtons(); 
    renderExtraOptions();
}

function loadDailyCost() {
    const savedCost = localStorage.getItem('myDailyCost');
    if (savedCost) document.getElementById('daily-cost').value = savedCost;
}

function saveCostAndRefresh() {
    const newCost = document.getElementById('daily-cost').value;
    localStorage.setItem('myDailyCost', newCost);
    fetchTodaySales();
}

// ==========================================
// กล่องที่ 3: ระบบ Dynamic Menu & Options (ดึงจาก DB)
// ==========================================

async function renderOrderButtons() {
    const menuContainer = document.getElementById('Order-menu');
    if (!menuContainer) return;
    const allMenus = await db.menus.toArray();
    menuContainer.innerHTML = allMenus.length ? '' : '<p style="grid-column: span 2; text-align: center; color: #888; padding: 20px;">ยังไม่มีเมนู... เพิ่มที่ตั้งค่า ⚙️</p>';

    allMenus.forEach(menu => {
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
            <input type="checkbox" class="extra-opt-check" data-name="${opt.name}" data-price="${opt.price}" onchange="updateOrderPreview()">
            <span>+ ${opt.name} (${opt.price}.-)</span>
        `;
        container.appendChild(label);
    });
}

// ระบบจัดการหลังบ้าน (CRUD)
async function renderMenuSettings() {
    const container = document.getElementById('menu-settings-list');
    if (!container) return;
    const allMenus = await db.menus.toArray();
    container.innerHTML = '';
    allMenus.forEach(menu => {
        const div = document.createElement('div');
        div.style.display = "flex"; div.style.gap = "5px"; div.style.marginBottom = "8px";
        div.innerHTML = `<input type="text" value="${menu.name}" onchange="updateMenu(${menu.id}, 'name', this.value)" style="flex: 2; padding: 8px;">
                         <input type="number" value="${menu.price}" onchange="updateMenu(${menu.id}, 'price', this.value)" style="width: 70px; padding: 8px;">
                         <button onclick="deleteMenu(${menu.id})" style="background: #ff4757; color: white; border: none; padding: 5px 10px; border-radius: 5px;">🗑️</button>`;
        container.appendChild(div);
    });
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

async function addMenuField() { await db.menus.add({ name: "เมนูใหม่", price: 40 }); renderMenuSettings(); renderOrderButtons(); }
async function deleteMenu(id) { if (confirm("ลบเมนูนี้ไหม?")) { await db.menus.delete(id); renderMenuSettings(); renderOrderButtons(); } }
async function updateMenu(id, field, value) { 
    let updateData = {}; updateData[field] = field === 'price' ? Number(value) : value;
    await db.menus.update(id, updateData); renderOrderButtons(); 
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
    currentOrder.name = name;
    currentOrder.price = price;
    currentOrder.qty = 1;
    updateOrderPreview();
}

function changeQty(amount) {
    currentOrder.qty += amount;
    if (currentOrder.qty < 1) currentOrder.qty = 1;
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

function updateOrderPreview() {
    if (currentOrder.name === "") return;
    const { extraPrice, extraNames } = getSelectedOptions();
    let totalPrice = (currentOrder.price + extraPrice) * currentOrder.qty;
    let detailText = `${currentOrder.name} x ${currentOrder.qty}`;
    if (extraNames.length > 0) detailText += ` (${extraNames.join(', ')})`;

    document.getElementById('order-qty').innerText = currentOrder.qty;
    document.getElementById('order-detail').innerText = detailText;
    document.getElementById('order-total-price').innerText = `รวมทั้งสิ้น: ${totalPrice.toLocaleString()}.-`;
}

//ปุ่มจ่ายเงิน 2 แบบ เงินสด & เงินโอน
async function confirmOrder(paymentType) {
    if (currentOrder.name === "") return alert("เลือกเมนูก่อนครับ!");
    const { extraPrice, extraNames } = getSelectedOptions();
    let finalTotalPrice = (currentOrder.price + extraPrice) * currentOrder.qty;

    try {
        const now = new Date();
        const thailandTime = now.toLocaleString('sv-SE'); 

        // บันทึกลง Database โดยเพิ่มฟิลด์ payment_method
        // บันทึกลง Database
        await db.orders.add({
            menu_name: currentOrder.name,
            qty: Number(currentOrder.qty), // บังคับให้เป็นตัวเลขเพื่อความชัวร์
            options: extraNames.join(','), 
            total_price: finalTotalPrice,
            payment_method: paymentType,
            created_at: thailandTime
        });
        
        alert(`✅ บันทึก (${paymentType === 'Cash' ? 'เงินสด' : 'เงินโอน'}) สำเร็จ!`);
        fetchTodaySales();
        resetOrder(); 
        
    } catch (error) {
        alert("❌ ผิดพลาด: " + error.message);
    }
}

// ฟังก์ชันใหม่: ล้างจำนวนจานและพรีวิว แต่ยังค้าง "เมนู" และ "Checkbox" ไว้
function softReset() {
    // 1. รีเซ็ตจำนวนจานกลับเป็น 1
    currentOrder.qty = 1;
    document.getElementById('order-qty').innerText = "1";
    
    // 2. อัปเดตการแสดงผลพรีวิวให้เป็นราคาเริ่มต้น (ราคาเมนู + ส่วนเสริม x 1 จาน)
    updateOrderPreview();
    
    console.log("รีเซ็ตจำนวนจานแล้ว แต่เมนูและส่วนเสริมยังค้างไว้ตามที่ต้องการครับ");
}

async function fetchTodaySales() {
    try {
        // --- จุดสำคัญ: ปรับการดึงวันที่วันนี้ให้ตรงกับรูปแบบที่เราบันทึก (sv-SE) ---
        const now = new Date();
        const todayStr = now.toLocaleDateString('sv-SE'); // จะได้ "YYYY-MM-DD" ตรงกับที่บันทึกไว้
        
        // ดึงออเดอร์ทั้งหมดจากฐานข้อมูล
        const allOrders = await db.orders.toArray();
        
        let total = 0; 
        let cashTotal = 0;
        let qrTotal = 0;
        let countItems = 0;

        const targetSearch = localStorage.getItem('counterLabel') || "ไข่"; 

        allOrders.forEach(o => {
            if (o.created_at && o.created_at.startsWith(todayStr)) {
                const price = Number(o.total_price || 0);
                const quantity = Number(o.qty || 0); // ดึงค่า qty ออกมาเป็นตัวเลข
                
                total += price;
                
                // แยกยอดตามประเภทการจ่าย
                if (o.payment_method === 'Cash') cashTotal += price;
                else if (o.payment_method === 'QR') qrTotal += price;

                // ถ้านามสกุลออเดอร์มีคำที่ต้องการนับ (เช่น "ไข่") ให้บวกจำนวนจานเข้าไป
                if (o.options && o.options.includes(targetSearch)) {
                    countItems += quantity; // ใช้ค่า quantity ที่เราดึงมา
                }
            }
        });

        /// แสดงผลยอดรวมบนหน้าจอ
        document.getElementById('total-sales-display').innerText = total.toLocaleString();
        
        // (Optional) ถ้าเพื่อนอยากโชว์ยอดแยกที่หน้าแรกด้วย ให้เพิ่ม ID ใน HTML แล้วเปิดใช้บรรทัดล่างนี้ครับ
        // document.getElementById('cash-display').innerText = cashTotal.toLocaleString();
        // document.getElementById('qr-display').innerText = qrTotal.toLocaleString();

        document.getElementById('egg-count').innerText = countItems.toLocaleString();
        if (typeof updateProfitStatus === "function") updateProfitStatus(total);

    } catch (err) { 
        console.error("เกิดข้อผิดพลาด:", err); 
    }
}

function resetOrder() {
    // 1. คืนค่าตัวแปรหลัก
    currentOrder = { name: "", price: 0, qty: 1 };
    
    // 2. ล้างการแสดงผลในหน้าเว็บ
    document.getElementById('order-detail').innerText = "ยังไม่ได้เลือกเมนู";
    document.getElementById('order-total-price').innerText = "รวม: 0.-";
    document.getElementById('order-qty').innerText = "1";
    
    // 3. เอาติ๊กถูกออกให้หมด
    document.querySelectorAll('.extra-opt-check').forEach(c => c.checked = false);
    
    // 4. เอาสีไฮไลท์ที่ปุ่มเมนูออก
    document.querySelectorAll('#Order-menu button').forEach(b => b.classList.remove('selected'));
    
    console.log("ล้างค่าเริ่มต้นเรียบร้อย!");
}

// ==========================================
// กล่องที่ 5: ระบบรายงานและการโหลดข้อมูล
// ==========================================

function updateProfitStatus(totalSales) {
    const dailyCost = parseFloat(document.getElementById('daily-cost').value) || 0;
    const profitElement = document.getElementById('profit-status');
    if (!profitElement) return;
    const netProfit = totalSales - dailyCost;
    profitElement.innerHTML = netProfit >= 0 ? `✅ กำไรวันนี้: <b>${netProfit.toLocaleString()}</b> .-` : `⚠️ ขาดทุนอยู่: <b>${Math.abs(netProfit).toLocaleString()}</b> .-`;
    profitElement.style.color = netProfit >= 0 ? "#27ae60" : "#e74c3c";
}

async function handleCloseDay() {   //แก้ไข เพิ่มเติม 23-04-2026
    // 1. ดึงค่าหน่วยที่ลูกค้าตั้งไว้จาก localStorage (สมมติว่านายใช้ชื่อ 'eggUnit')
    // ถ้ายังไม่ได้ตั้งค่า ให้ใช้คำว่า 'ไข่' เป็นค่าเริ่มต้น
    const eggUnitName = localStorage.getItem('eggUnit') || 'ไข่';

    const totalSales = document.getElementById('total-sales-display').innerText.replace(/,/g, '');
    const eggCount = document.getElementById('egg-count').innerText.replace(/,/g, '');

    // 2. ปรับตรง confirm ให้ใช้ตัวแปร eggUnitName ที่เราดึงมา
    if (confirm(`ยืนยันการปิดยอดวันนี้?\n💰 ยอด: ${totalSales}.-\n🥚 ${eggUnitName}: ${eggCount}`)) {
        const today = new Date().toISOString().split('T')[0];
        await db.dailysummary.put({ 
            summary_date: today, 
            total_sales: parseFloat(totalSales), 
            egg_count: parseInt(eggCount) 
        });
        alert("✅ ปิดยอดแล้ว!");
        loadDashboardData();
    }
}

    // 1. ฟังก์ชันเพิ่มเมนูใหม่ลงตาราง menus //เพิ่มเติม 23-04-2026
async function addNewMenu() {
    const name = document.getElementById('new-menu-name').value;
    const price = document.getElementById('new-menu-price').value;

    if (name && price) {
        await db.menus.add({ 
            name: name, 
            price: parseFloat(price) 
        });
        document.getElementById('new-menu-name').value = '';
        document.getElementById('new-menu-price').value = '';
        renderMenuList(); // อัปเดตรายการที่โชว์ทันที
        alert("บันทึกเมนูเรียบร้อย!");
    } else {
        alert("กรุณากรอกชื่อและราคาให้ครบครับ");
    }
}

// 2. ฟังก์ชันดึงเมนูทั้งหมดมาโชว์ (เอาไว้ลบหรือดูรายการ) //เพิ่มเติม 23-04-2026
async function renderMenuList() {
    const allMenus = await db.menus.toArray();
    const listContainer = document.getElementById('menu-list-items');
    if(!listContainer) return;

    listContainer.innerHTML = ''; 
    allMenus.forEach(menu => {
        const li = document.createElement('li');
        li.style.cssText = "display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #eee;";
        li.innerHTML = `
            <span>${menu.name} (${menu.price}.-)</span>
            <button onclick="deleteMenu(${menu.id})" style="color:red; background:none; border:none; cursor:pointer;">ลบ</button>
        `;
        listContainer.appendChild(li);
    });
}

async function deleteMenu(id) {
    if (confirm("ยืนยันการลบเมนูนี้?")) {
        await db.menus.delete(id);
        renderMenuList();
    }
}

// 3. ฟังก์ชันค้นหาเมนู (จะเรียกใช้ตอนลูกค้าพิมพ์) //เพิ่มเติม 23-04-2026
async function searchSmartMenu(query) {
    const resultArea = document.getElementById('search-results-area');
    if (!query || query.length < 1) {
        resultArea.innerHTML = '';
        return;
    }

    // ค้นหาคำที่ใกล้เคียงในตาราง menus
    const matches = await db.menus
        .filter(menu => menu.name.toLowerCase().includes(query.toLowerCase()))
        .toArray();

    resultArea.innerHTML = ''; // ล้างค่าเก่า

    matches.forEach(menu => {
        const btn = document.createElement('button');
        btn.innerText = `➕ ${menu.name} (${menu.price}.-)`;
        btn.className = "menu-btn-search"; // นายไปตั้ง CSS ให้สวยๆ ได้
        btn.style.cssText = "margin:5px; padding:10px; background:#e0f7fa; border-radius:5px; border:1px solid #00acc1;";
        
        btn.onclick = () => {
            // เรียกฟังก์ชันเพิ่มออเดอร์เดิมของนาย 
            // สมมติว่าฟังก์ชันเดิมนายชื่อ addToCart หรือบวกเงินโดยตรง
            addItemToOrder(menu.name, menu.price); 
            
            // ล้างช่องค้นหาเมื่อกดเลือกแล้ว
            resultArea.innerHTML = '';
            document.getElementById('smart-search-input').value = '';
        };
        resultArea.appendChild(btn);
    });
}

    //เพิ่มเติม 23-04-2026
function openMenuManager() {
    document.getElementById('menu-manager-section').style.display = 'block';
    renderMenuList(); // สั่งให้โหลดรายการมาโชว์ทันทีที่เปิดหน้า
}

    //เพิ่มเติม 23-04-2026
function closeMenuManager() {
    document.getElementById('menu-manager-section').style.display = 'none';
}


async function loadDashboardData() {
    const tableBody = document.getElementById('dashboard-table-body');
    if (!tableBody) return;
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
    // ถามเพื่อความแน่ใจ 2 รอบกันพลาด
    if (confirm("⚠️ คุณแน่ใจใช่ไหม? ข้อมูลออเดอร์ทั้งหมดจะถูกลบออกจากเครื่องและไม่สามารถเรียกคืนได้")) {
        if (confirm("ยืนยันอีกครั้ง: คุณได้ดาวน์โหลดไฟล์ CSV เก็บไว้แล้วใช่หรือไม่?")) {
            try {
                await db.orders.clear(); // ล้างข้อมูลในตาราง orders
                // ถ้าอยากล้างตารางสรุปรายวันด้วย ให้เพิ่มบรรทัดล่างนี้:
                // await db.dailysummary.clear(); 
                
                alert("✅ ล้างข้อมูลเรียบร้อยแล้ว! พื้นที่ว่างขึ้นแล้วครับ");
                location.reload(); // รีเฟรชหน้าจอเพื่อให้ยอดขายกลับเป็น 0
            } catch (err) {
                alert("❌ ไม่สามารถล้างข้อมูลได้: " + err.message);
            }
        }
    }
}


// --- ส่วนการเริ่มระบบเมื่อเปิดหน้าเว็บ ---
window.onload = function() {
    // 1. โหลดข้อมูลตัวอักษรจาก localStorage
    const keys = [
        { k: 'shopName', i: 'name-main' }, 
        { k: 'shopMenu', i: 'menu-name' }
    ];
    keys.forEach(item => {
        let val = localStorage.getItem(item.k);
        if (val) {
            const el = document.getElementById(item.i);
            if (el) el.innerText = val;
        }
    });

    // โหลดค่าชื่อการนับ
    // 1. ประกาศตัวแปรเพื่อดึงค่าจาก localStorage มาเก็บไว้ (ประกาศแค่ครั้งเดียวพอ!)

    const savedLabel = localStorage.getItem('counterLabel') || "ไข่ดาว";
    const savedUnit = localStorage.getItem('counterUnit') || "ฟอง";

    // จากนั้น "ใช้งาน" อย่างเดียว ไม่ต้องประกาศ const/let เพิ่มแล้ว
    if (document.getElementById('display-label')) {
        document.getElementById('display-label').innerText = "📊 วันนี้ใช้ " + savedLabel + " ไปแล้ว";
    }
    if (document.getElementById('display-unit')) {
        document.getElementById('display-unit').innerText = savedUnit;
    }
    if (document.getElementById('counter-label-input')) {
        document.getElementById('counter-label-input').value = savedLabel;
    }
    if (document.getElementById('counter-unit-input')) {
        document.getElementById('counter-unit-input').value = savedUnit;
    }
    if (document.getElementById('dashboard-unit-header')) {
        document.getElementById('dashboard-unit-header').innerText = savedLabel;
    }
    if (document.getElementById('dashboard-unit-name')) {
        document.getElementById('dashboard-unit-name').innerText = savedUnit;
    }

    // 2. โหลดต้นทุนและยอดขายปัจจุบัน
    loadDailyCost();
    fetchTodaySales();

    // 3. วาด UI ที่มาจาก Database (เมนูอาหาร และ ส่วนเพิ่มเติม)
    renderOrderButtons(); 
    renderExtraOptions(); 
};

// ==========================================
// ฟังก์ชันดาวน์โหลดรายละเอียดการขายทั้งหมด (ฉบับละเอียด)
// ==========================================
async function exportToCSV() {
    try {
        const data = await db.orders.toArray();
        if (data.length === 0) {
            alert("❌ ยังไม่มีข้อมูลออเดอร์ครับ");
            return;
        }

        // --- ส่วนที่ 1: คำนวณยอดสรุปแยกประเภท ---
        const now = new Date();
        const todayStr = now.toLocaleDateString('sv-SE'); // YYYY-MM-DD
        
        // ตัวแปรเก็บยอดรวมแยกประเภท
        let dayCash = 0, dayQR = 0;
        let weekCash = 0, weekQR = 0;
        let monthCash = 0, monthQR = 0;
        let yearCash = 0, yearQR = 0;
        
        // คำนวณหาวันแรกของสัปดาห์ (วันจันทร์)
        const firstDayOfWeek = new Date(now);
        firstDayOfWeek.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
        firstDayOfWeek.setHours(0,0,0,0);

        data.forEach(row => {
            const orderDate = new Date(row.created_at);
            const price = Number(row.total_price || 0);
            const isQR = row.payment_method === 'QR'; // เช็คว่าเป็นเงินโอนหรือไม่

            // 1. ยอดวันนี้
            if (row.created_at.startsWith(todayStr)) {
                if (isQR) dayQR += price; else dayCash += price;
            }
            
            // 2. ยอดสัปดาห์นี้
            if (orderDate >= firstDayOfWeek) {
                if (isQR) weekQR += price; else weekCash += price;
            }

            // 3. ยอดเดือนนี้
            if (orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear()) {
                if (isQR) monthQR += price; else monthCash += price;
            }

            // 4. ยอดปีนี้
            if (orderDate.getFullYear() === now.getFullYear()) {
                if (isQR) yearQR += price; else yearCash += price;
            }
        });

        // --- ส่วนที่ 2: สร้างเนื้อหาไฟล์ CSV ---
        let csvContent = "\ufeff"; // BOM สำหรับภาษาไทย

        csvContent += `รายงานสรุปยอดขายแยกประเภทการชำระเงิน,ณ วันที่,${now.toLocaleString('th-TH')}\n\n`;

        // ตารางสรุปภาพรวมแยก Cash/QR
        csvContent += "ช่วงเวลา,ยอดรวม (บาท),เงินสด (💵),เงินโอน (📱)\n";
        csvContent += `วันนี้,${dayCash + dayQR},${dayCash},${dayQR}\n`;
        csvContent += `สัปดาห์นี้,${weekCash + weekQR},${weekCash},${weekQR}\n`;
        csvContent += `เดือนนี้,${monthCash + monthQR},${monthCash},${monthQR}\n`;
        csvContent += `ปีนี้ (YTD),${yearCash + yearQR},${yearCash},${yearQR}\n\n`;

        // หัวตารางรายละเอียด
        csvContent += "--- รายละเอียดออเดอร์ ---\n";
        csvContent += "วัน-เวลา,ชื่อเมนู,ส่วนเพิ่มเติม,จำนวน,ราคารวม (บาท),ช่องทางชำระเงิน\n";

        // ใส่ข้อมูลแต่ละออเดอร์พร้อมระบุช่องทางชำระ
        data.forEach(row => {
            const menuName = `"${row.menu_name}"`;
            const options = `"${row.options || '-'}"`;
            const paymentText = row.payment_method === 'QR' ? "เงินโอน (QR)" : "เงินสด";
            csvContent += `${row.created_at},${menuName},${options},${row.qty},${row.total_price},${paymentText}\n`;
        });

        // --- ส่วนที่ 3: สั่งดาวน์โหลด ---
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const fileName = `รายงานขาย_แยกประเภท_${todayStr}.csv`;
        
        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
        link.click();

        console.log("ดาวน์โหลดรายงานแบบแยกยอด Cash/QR เรียบร้อย!");
    } catch (err) {
        console.error(err);
        alert("เกิดข้อผิดพลาด: " + err.message);
    }
}

// --- 1. ฟังก์ชันส่งออกข้อมูล (Backup) ---
async function backupDatabase() {
    try {
        // ดึงข้อมูลจากทุกตารางที่ประกาศไว้ใน Version 3
        const orders = await db.orders.toArray();
        const dailysummary = await db.dailysummary.toArray();
        const menus = await db.menus.toArray();
        const extra_options = await db.extra_options.toArray();

        const backupData = {
            orders: orders,
            dailysummary: dailysummary,
            menus: menus,
            extra_options: extra_options,
            backupDate: new Date().toISOString(),
            dbVersion: 3 // ระบุไว้กันพลาด
        };

        const blob = new Blob([JSON.stringify(backupData)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Backup_POS_Full_${new Date().toLocaleDateString('sv-SE')}.json`;
        link.click();
        
        alert("📤 สำรองข้อมูลครบทุกส่วนสำเร็จ!");
    } catch (err) {
        alert("❌ Backup ล้มเหลว: " + err.message);
    }
}

// --- แผนการทำระบบย้ายเครื่อง (Backup/Restore) ---
async function restoreDatabase(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm("⚠️ คำเตือน: ข้อมูลในเครื่องนี้จะถูกเขียนทับด้วยข้อมูลจากไฟล์ Backup คุณต้องการดำเนินการต่อใช่หรือไม่?")) {
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const importedData = JSON.parse(e.target.result);

            // 1. ล้างข้อมูลเก่าออกให้หมดทุกตาราง
            await Promise.all([
                db.orders.clear(),
                db.dailysummary.clear(),
                db.menus.clear(),
                db.extra_options.clear()
            ]);

            // 2. นำเข้าข้อมูลใหม่ (เช็คก่อนว่าในไฟล์มีข้อมูลตารางนั้นไหม)
            if (importedData.orders) await db.orders.bulkAdd(importedData.orders);
            if (importedData.dailysummary) await db.dailysummary.bulkAdd(importedData.dailysummary);
            if (importedData.menus) await db.menus.bulkAdd(importedData.menus);
            if (importedData.extra_options) await db.extra_options.bulkAdd(importedData.extra_options);

            alert("✅ นันเข้าข้อมูลสำเร็จ! ระบบจะรีโหลดเพื่อแสดงข้อมูลใหม่");
            location.reload();
        } catch (err) {
            alert("❌ นำเข้าล้มเหลว: " + err.message);
        }
    };
    reader.readAsText(file);
}

//เพิ่มเติม 23-04-2026
function checkAndShowIOSGuide() {
    // เช็คว่าเป็นอุปกรณ์ iOS (iPhone, iPad, iPod) หรือไม่
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    // เช็คว่าเปิดผ่าน Browser ปกติ (ไม่ใช่เปิดจากที่ติดตั้งแล้ว)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    if (isIOS && !isStandalone) {
        // ถ้าเป็น iOS และยังไม่ได้ติดตั้ง ให้โชว์กล่องแจ้งเตือน
        document.getElementById('ios-install-guide').style.display = 'block';
    }
}

// เรียกใช้งานทันทีเมื่อโหลดหน้าเว็บ
window.addEventListener('load', checkAndShowIOSGuide);

//........................................................

// ดักจับเวลาคนกดย้อนกลับที่ตัวเครื่อง (ปุ่ม Back ของ Android หรือปัดย้อนกลับใน iPhone)
window.onpopstate = function(event) {
    // ถ้ากดย้อนกลับตอนที่หน้าตั้งค่าเปิดอยู่ ให้สั่งปิดหน้าตั้งค่าแทนการออกจากเว็บ
    if (document.getElementById('back-page').style.display === 'block') {
        // เรียกฟังก์ชันปิดหน้าตั้งค่าของเพื่อน
        saveAndExit(); 
    }
};