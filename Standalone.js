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
// 25-04-2026 
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
    
    // อัปเดตราคา (ราคาพื้นฐาน + ราคาตัวเลือกเสริม)
    lastItem.price = lastItem.basePrice + extraPrice;
    // อัปเดตชื่อตัวเลือกเสริม
    lastItem.options = extraNames.join(', ');

    // 4. สั่งวาดหน้าจอใหม่
    updateOrderPreview();
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


// ฟังก์ชันแสดงผล (มีปุ่มลบรายบรรทัด) 25-04-2026
function updateOrderPreview() {
    const detailBox = document.getElementById('order-detail');
    const totalBox = document.getElementById('order-total-price');
    const qtyBox = document.getElementById('order-qty'); // <-- 1. ดึงตำแหน่งที่จะโชว์ตัวเลขจาน

    if (cart.length === 0) {
        if(detailBox) detailBox.innerHTML = "ยังไม่ได้เลือกเมนู";
        if(totalBox) totalBox.innerText = "รวมทั้งสิ้น : 0.-";
        if(qtyBox) qtyBox.innerText = "1"; // <-- 2. ถ้าไม่มีของ ให้กลับไปเลข 1
        return;
    }

    let grandTotal = 0;
    // วนลูปสร้าง HTML รายบรรทัด พร้อมปุ่มลบ (X)
    let detailHTML = cart.map((item, index) => {
        const itemTotal = item.price * item.qty;
        grandTotal += itemTotal;
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px dashed #ccc; padding-bottom: 4px;">
                <span style="font-size: 1.1rem; flex: 1;">
                    <b>${item.name}</b> ${item.options ? '<br><small>('+item.options+')</small>' : ''}
                </span>
                <span style="width: 100px; text-align: right;">
                    x ${item.qty} = ${itemTotal}.-
                </span>
                <button onclick="deleteSpecificItem(${index})" style="background: #ff4757; color: white; border: none; border-radius: 50%; width: 25px; height: 25px; margin-left: 10px; cursor: pointer;">×</button>
            </div>
        `;
    }).join('');

    if(detailBox) detailBox.innerHTML = detailHTML;
    if(totalBox) totalBox.innerText = `รวมทั้งสิ้น : ${grandTotal.toLocaleString()}.-`;

    // --- 3. เพิ่มบรรทัดนี้ เพื่อให้ตัวเลขที่ปุ่ม + / - ขยับตามรายการล่าสุด ---
    if(qtyBox && cart.length > 0) {
        qtyBox.innerText = cart[cart.length - 1].qty;
    }
}

// ฟังก์ชันลบเฉพาะบางรายการ 25-04-2026
function deleteSpecificItem(index) {
    cart.splice(index, 1); // ลบข้อมูลใน Array ตามตำแหน่งที่กด
    updateOrderPreview();  // วาดหน้าจอใหม่
}

// ฟังก์ชันยืนยัน (บันทึกลงฐานข้อมูล) 25-04-2026
async function confirmOrder(paymentType) {
    if (cart.length === 0) return alert("เลือกเมนูก่อนครับ!");
    
    const thailandTime = new Date().toLocaleString('sv-SE');
    
    // วนลูปบันทึกทีละรายการในตะกร้าลง Dexie
    for (const item of cart) {
        await db.orders.add({
            menu_name: item.name,
            qty: item.qty,
            options: item.options,
            total_price: item.price * item.qty,
            payment_method: paymentType,
            created_at: thailandTime
        });
    }

    alert("บันทึกสำเร็จทั้งหมด " + cart.length + " รายการ");
    cart = []; // ล้างตะกร้า
    updateOrderPreview();
    fetchTodaySales();
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

// 2. ฟังก์ชันนำเข้าข้อมูล (Restore) - จากไฟล์เครื่องเก่า
async function restoreDatabase(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (confirm("⚠️ การนำเข้าข้อมูลจะเขียนทับข้อมูลปัจจุบัน ยืนยันไหม?")) {
                // ล้างข้อมูลเก่า
                await db.orders.clear();
                await db.dailysummary.clear();
                await db.menus.clear();
                await db.extra_options.clear();

                // ใส่ข้อมูลใหม่ลงไป
                if (data.orders) await db.orders.bulkAdd(data.orders);
                if (data.dailysummary) await db.dailysummary.bulkAdd(data.dailysummary);
                if (data.menus) await db.menus.bulkAdd(data.menus);
                if (data.extra_options) await db.extra_options.bulkAdd(data.extra_options);

                // คืนค่า Settings ลง LocalStorage
                if (data.settings) {
                    Object.keys(data.settings).forEach(key => {
                        if (data.settings[key]) localStorage.setItem(key, data.settings[key]);
                    });
                }

                alert("✅ นำเข้าข้อมูลสำเร็จ! ระบบจะทำการเริ่มใหม่");
                location.reload();
            }
        } catch (err) {
            alert("❌ ไฟล์ไม่ถูกต้องหรือเสีย: " + err.message);
        }
    };
    reader.readAsText(file);
}

// 3. ฟังก์ชันส่งออกยอดขายเป็น CSV (สำหรับเปิดใน Excel)
async function exportToCSV() {
    try {
        const orders = await db.orders.toArray();
        if (orders.length === 0) return alert("ไม่มีข้อมูลยอดขายให้ส่งออก");

        // --- 1. คำนวณสรุปยอด ---
        const now = new Date();
        const todayStr = now.toLocaleDateString('sv-SE'); 
        const startOfWeek = new Date(now);
        const day = now.getDay();
        const diff = now.getDate() - (day === 0 ? 6 : day - 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);

        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let summary = {
            today: { total: 0, cash: 0, transfer: 0 },
            week: { total: 0, cash: 0, transfer: 0 },
            month: { total: 0, cash: 0, transfer: 0 },
            year: { total: 0, cash: 0, transfer: 0 }
        };

        orders.forEach(o => {
            const datePart = o.created_at.split(',')[0].trim(); 
            const oDate = new Date(datePart);
            const oDateStr = oDate.toLocaleDateString('sv-SE');
            const price = o.total_price || 0;
            
            // แก้ไขจุดนี้: ใช้ .trim() เพื่อป้องกันช่องว่าง และเช็กคำว่า "เงินสด" ให้แม่นยำขึ้น
            const isCash = o.payment_method && o.payment_method.trim() === 'เงินสด';

            if (oDate.getFullYear() === currentYear) {
                summary.year.total += price;
                if (isCash) summary.year.cash += price; else summary.year.transfer += price;

                if (oDate.getMonth() === currentMonth) {
                    summary.month.total += price;
                    if (isCash) summary.month.cash += price; else summary.month.transfer += price;
                }
                if (oDate >= startOfWeek) {
                    summary.week.total += price;
                    if (isCash) summary.week.cash += price; else summary.week.transfer += price;
                }
                if (oDateStr === todayStr) {
                    summary.today.total += price;
                    if (isCash) summary.today.cash += price; else summary.today.transfer += price;
                }
            }
        });

        // --- 2. เริ่มสร้างเนื้อหาไฟล์ CSV ---
        let csvContent = "\ufeff"; 

        csvContent += "รายการสรุปยอดขาย,,,\n";
        csvContent += "ช่วงเวลา,ยอดรวม (บาท),เงินสด,เงินโอน\n";
        csvContent += `วันนี้,${summary.today.total},${summary.today.cash},${summary.today.transfer}\n`;
        csvContent += `สัปดาห์นี้,${summary.week.total},${summary.week.cash},${summary.week.transfer}\n`;
        csvContent += `เดือนนี้,${summary.month.total},${summary.month.cash},${summary.month.transfer}\n`;
        csvContent += `ปีนี้,${summary.year.total},${summary.year.cash},${summary.year.transfer}\n\n\n`;

        csvContent += "รายละเอียดออเดอร์,,,\n";
        csvContent += "วัน-เวลา,ชื่อเมนู,ส่วนเพิ่มเติม,จำนวน,ราคารวม (บาท),ช่องทางการชำระเงิน\n";

        let lastDateSeen = ""; 

        orders.forEach((o) => {
            const currentDateOnly = o.created_at.split(',')[0].trim();

            // เปลี่ยนจาก "ขีดเส้น" เป็น "เว้นบรรทัดว่าง" เมื่อขึ้นวันใหม่ (ถ้าไม่ใช่รายการแรก)
            if (lastDateSeen !== "" && lastDateSeen !== currentDateOnly) {
                csvContent += "\n"; // เว้น 1 บรรทัดให้ดูสะอาดตา
            }

            csvContent += `${o.created_at},${o.menu_name},"${o.options || ''}",${o.qty},${o.total_price},${o.payment_method}\n`;
            
            lastDateSeen = currentDateOnly;
        });

        // --- 3. ดาวน์โหลดไฟล์ ---
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `สรุปยอดขาย_${todayStr}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (err) {
        alert("❌ เกิดข้อผิดพลาดในการส่งออก: " + err.message);
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

window.onpopstate = function(event) {
    if (document.getElementById('back-page').style.display === 'block') saveAndExit(); 
};