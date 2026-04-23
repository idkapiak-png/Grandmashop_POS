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

function saveAndExit() {
    // 1. ดึงค่าพื้นฐาน
    const shopName = document.getElementById('name-input').value;
    const shopMenu = document.getElementById('menu-input').value;
    const counterLabel = document.getElementById('counter-label-input').value;
    const counterUnit = document.getElementById('counter-unit-input').value;

    // 2. บันทึกรายการเมนูขายหน้าแรก (Quick Menus) ลง localStorage
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

    // 3. บันทึกชื่อร้าน
    if(shopName.trim() !== "") {
        document.getElementById('name-main').innerText = shopName;
        localStorage.setItem('shopName', shopName);
    }
    if(shopMenu.trim() !== "") {
        document.getElementById('menu-name').innerText = shopMenu;
        localStorage.setItem('shopMenu', shopMenu);
    }

    // 4. บันทึกค่าการนับ
    if(counterLabel.trim() !== "") {
        localStorage.setItem('counterLabel', counterLabel);
        if(document.getElementById('display-label')) 
            document.getElementById('display-label').innerText = "📊 วันนี้ใช้ " + counterLabel + " ไปแล้ว";
    }
    if(counterUnit.trim() !== "") {
        localStorage.setItem('counterUnit', counterUnit);
        if(document.getElementById('display-unit')) 
            document.getElementById('display-unit').innerText = counterUnit;
    }

    // 5. ปิดหน้าตั้งค่า
    if (window.location.hash === '#settings') {
        history.back(); 
    }
    document.getElementById('front-page').style.display = 'block';
    document.getElementById('back-page').style.display = 'none';
    
    // 6. อัปเดต UI หน้าแรก
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

// วาดรายการ "บันทึกรายการเมนูขาย" ในหน้าตั้งค่า - ดึงจาก localStorage
function renderMenuSettings() {
    const container = document.getElementById('menu-settings-list');
    if (!container) return;
    const quickMenus = JSON.parse(localStorage.getItem('quickMenus')) || [];
    container.innerHTML = '';
    
    quickMenus.forEach((menu, index) => {
        const div = document.createElement('div');
        div.className = 'menu-setting-row';
        div.style.display = "flex"; div.style.gap = "5px"; div.style.marginBottom = "8px";
        div.innerHTML = `
            <input type="text" value="${menu.name}" style="flex: 2; padding: 8px;">
            <input type="number" value="${menu.price}" style="width: 70px; padding: 8px;">
            <button onclick="this.parentElement.remove()" style="background: #ff4757; color: white; border: none; padding: 5px 10px; border-radius: 5px;">🗑️</button>
        `;
        container.appendChild(div);
    });
}

// เพิ่มแถวใหม่ในหน้าตั้งค่า (หน้าขาย)
function addMenuField() {
    const container = document.getElementById('menu-settings-list');
    const div = document.createElement('div');
    div.className = 'menu-setting-row';
    div.style.display = "flex"; div.style.gap = "5px"; div.style.marginBottom = "8px";
    div.innerHTML = `
        <input type="text" placeholder="ชื่อเมนู" style="flex: 2; padding: 8px;">
        <input type="number" placeholder="ราคา" style="width: 70px; padding: 8px;">
        <button onclick="this.parentElement.remove()" style="background: #ff4757; color: white; border: none; padding: 5px 10px; border-radius: 5px;">🗑️</button>
    `;
    container.appendChild(div);
}

// วาดส่วนเพิ่มเติม (Options)
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
function orderMenu(name, price) {
    currentOrder.name = name;
    currentOrder.price = price;
    currentOrder.qty = 1;
    updateOrderPreview();
}

function addItemToOrder(name, price) {
    currentOrder.name = name;
    currentOrder.price = price;
    currentOrder.qty = 1;
    document.querySelectorAll('#Order-menu button').forEach(b => b.classList.remove('selected'));
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

async function confirmOrder(paymentType) {
    if (!currentOrder.name || currentOrder.name === "") return alert("เลือกเมนูก่อนครับ!");
    const { extraPrice, extraNames } = getSelectedOptions();
    let finalTotalPrice = ((currentOrder.price || 0) + (extraPrice || 0)) * (currentOrder.qty || 1);

    try {
        const thailandTime = new Date().toLocaleString('sv-SE');
        await db.orders.add({
            menu_name: currentOrder.name,
            qty: Number(currentOrder.qty) || 1, 
            options: extraNames.join(', '),
            total_price: Number(finalTotalPrice) || 0,
            payment_method: paymentType,
            created_at: thailandTime
        });
        alert(`✅ บันทึกสำเร็จ!`);
        await fetchTodaySales();
        resetOrder(); 
    } catch (error) {
        alert("❌ บันทึกล้มเหลว: " + error.message);
    }
}

async function fetchTodaySales() {
    try {
        const todayStr = new Date().toLocaleDateString('sv-SE');
        const allOrders = await db.orders.toArray();
        let total = 0, cashTotal = 0, qrTotal = 0, countItems = 0;
        const targetSearch = localStorage.getItem('counterLabel') || "ไข่"; 

        allOrders.forEach(o => {
            if (o.created_at && o.created_at.startsWith(todayStr)) {
                const price = Number(o.total_price || 0);
                total += price;
                if (o.payment_method === 'Cash') cashTotal += price;
                else if (o.payment_method === 'QR') qrTotal += price;
                if (o.options && o.options.includes(targetSearch)) countItems += Number(o.qty || 0);
            }
        });

        document.getElementById('total-sales-display').innerText = total.toLocaleString();
        document.getElementById('cash-display').innerText = cashTotal.toLocaleString();
        document.getElementById('qr-display').innerText = qrTotal.toLocaleString();
        document.getElementById('egg-count').innerText = countItems.toLocaleString();
        updateProfitStatus(total);
    } catch (err) { console.error(err); }
}

function resetOrder() {
    currentOrder = { name: "", price: 0, qty: 1 };
    document.getElementById('order-detail').innerText = "ยังไม่ได้เลือกเมนู";
    document.getElementById('order-total-price').innerText = "รวม: 0.-";
    document.getElementById('order-qty').innerText = "1";
    document.querySelectorAll('.extra-opt-check').forEach(c => c.checked = false);
    document.querySelectorAll('#Order-menu button').forEach(b => b.classList.remove('selected'));
}

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

    if (confirm(`ยืนยันการปิดยอดวันนี้?\n💰 ยอด: ${totalSales}.-\n🥚 ${eggUnitName}: ${eggCount}`)) {
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

// แสดงรายการใน "คลังใหญ่" และมีปุ่มเพิ่มไปหน้าแรก
async function renderMenuList() {
    const allMenus = await db.menus.toArray();
    const listContainer = document.getElementById('menu-list-items');
    if(!listContainer) return;
    listContainer.innerHTML = ''; 
    allMenus.forEach(menu => {
        const li = document.createElement('li');
        li.style.cssText = "display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee; align-items:center;";
        li.innerHTML = `
            <span><b>${menu.name}</b> (${menu.price}.-)</span>
            <div>
                <button onclick="addFromStorageToQuick('${menu.name}', ${menu.price})" style="background:#00acc1; color:white; border:none; padding:5px 10px; border-radius:5px; margin-right:5px;">+ หน้าแรก</button>
                <button onclick="deleteFullMenu(${menu.id})" style="color:#ff4757; background:none; border:none; cursor:pointer; font-weight:bold;">ลบจากคลัง</button>
            </div>
        `;
        listContainer.appendChild(li);
    });
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
        btn.style.cssText = "margin:5px; padding:10px; background:#e0f7fa; border-radius:5px; border:1px solid #00acc1;";
        btn.onclick = () => {
            addItemToOrder(menu.name, menu.price); 
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
window.onload = function() {
    const keys = [{ k: 'shopName', i: 'name-main' }, { k: 'shopMenu', i: 'menu-name' }];
    keys.forEach(item => {
        let val = localStorage.getItem(item.k);
        if (val && document.getElementById(item.i)) document.getElementById(item.i).innerText = val;
    });

    const savedLabel = localStorage.getItem('counterLabel') || "ไข่ดาว";
    const savedUnit = localStorage.getItem('counterUnit') || "ฟอง";

    if (document.getElementById('display-label')) document.getElementById('display-label').innerText = "📊 วันนี้ใช้ " + savedLabel + " ไปแล้ว";
    if (document.getElementById('display-unit')) document.getElementById('display-unit').innerText = savedUnit;
    if (document.getElementById('counter-label-input')) document.getElementById('counter-label-input').value = savedLabel;
    if (document.getElementById('counter-unit-input')) document.getElementById('counter-unit-input').value = savedUnit;

    loadDailyCost();
    fetchTodaySales();
    renderOrderButtons(); 
    renderExtraOptions(); 
};

// Export CSV และ Backup/Restore (คงเดิมจากโค้ดนาย)
async function exportToCSV() { /* ... โค้ดเดิมของนาย ... */ }
async function backupDatabase() { /* ... โค้ดเดิมของนาย ... */ }
async function restoreDatabase(event) { /* ... โค้ดเดิมของนาย ... */ }

// iOS & Popstate
window.addEventListener('load', () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isIOS && !isStandalone && document.getElementById('ios-install-guide')) {
        document.getElementById('ios-install-guide').style.display = 'block';
    }
});

window.onpopstate = function(event) {
    if (document.getElementById('back-page').style.display === 'block') saveAndExit(); 
};