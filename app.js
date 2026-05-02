const STORAGE_KEY = "oa_inventory_state_v1";
const SESSION_KEY = "oa_inventory_session_v1";
const ALL_VIEWS = ["dashboard", "products", "inventory", "purchases", "sales", "shipping", "liveSales", "live", "knitters", "partners", "staff", "contracts", "leave", "tracking", "production", "settings"];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const today = () => new Date().toISOString().slice(0, 10);
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const money = (value) => Number(value || 0).toLocaleString("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 });
const number = (value) => Number(value || 0).toLocaleString("zh-TW");
const ceilNumber = (value) => Math.ceil(Number(value || 0));
const zhMap = {
  "時": "时", "線": "线", "進": "进", "銷": "销", "總": "总", "覽": "览", "庫": "库", "存": "存", "貨": "货",
  "單": "单", "號": "号", "國": "国", "內": "内", "類": "类", "別": "别", "廠": "厂", "團": "团", "數": "数",
  "會": "会", "計": "计", "師": "师", "聯": "联", "絡": "络", "電話": "电话", "話": "话", "範": "范", "資": "资",
  "料": "料", "報": "报", "錶": "表", "表": "表", "列": "列", "印": "印", "產": "产", "產品": "产品", "品": "品",
  "稱": "称", "號": "号", "額": "额", "態": "态", "備": "备", "註": "注", "審": "审", "批": "批", "職": "职",
  "離": "离", "員": "员", "門": "门", "達": "达", "義": "义", "灣": "湾", "體": "体", "織": "织", "間": "间",
  "選": "选", "擇": "择", "顯": "显", "舊": "旧", "開": "开", "關": "关", "寫": "写", "輸": "输", "補": "补",
  "餘": "余", "風": "风", "險": "险", "預": "预", "應": "应", "對": "对", "發": "发", "擊": "击", "萬": "万",
};
const zhReverseMap = Object.fromEntries(Object.entries(zhMap).map(([key, value]) => [value, key]));

const defaultState = () => ({
  products: [],
  partners: [],
  purchases: [],
  sales: [],
  yarnTracks: [],
  liveShows: [],
  liveSales: [],
  knitters: [],
  samples: [],
  shipments: [],
  staff: [],
  leaveRequests: [],
  announcements: [],
  settings: {
    positions: ["負責人", "主管", "執行負責", "品牌助理"],
    users: [],
  },
  meta: {
    updatedAt: 0,
  },
});

let state = normalizeState(loadState());
let activeView = "dashboard";
let searchTerm = "";
let productTab = "saleGoods";
let currentLang = "zh-TW";
let staffTab = "regular";
let knitterTab = "profiles";
let currentUser = null;

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultState();
  } catch {
    return defaultState();
  }
}

async function loadCloudState() {
  try {
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) return;
    const cloudState = await response.json();
    const localState = normalizeState(loadState());
    if (!isMeaningfulState(cloudState) && isMeaningfulState(localState)) {
      state = localState;
      saveState();
      return;
    }
    if (isMeaningfulState(cloudState)) {
      state = normalizeState(cloudState);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Offline/local-file fallback keeps using localStorage.
  }
}

function isMeaningfulState(value) {
  return Boolean(
    value &&
    (
      (value.settings?.users || []).length ||
      (value.products || []).length ||
      (value.partners || []).length ||
      (value.purchases || []).length ||
      (value.sales || []).length ||
      (value.liveSales || []).length ||
      (value.knitters || []).length ||
      (value.samples || []).length
    )
  );
}

function normalizeState(saved) {
  const next = { ...defaultState(), ...(saved || {}) };
  next.settings = {
    ...defaultState().settings,
    ...(saved?.settings || {}),
  };
  next.meta = {
    updatedAt: Number(saved?.meta?.updatedAt || 0),
  };
  next.settings.users = next.settings.users || [];
  next.settings.positions = [...new Set([...(next.settings.positions || []), ...((next.staff || []).map((item) => item.title).filter(Boolean))])];
  next.products = (next.products || []).map((product) => ({
    ...product,
    type: product.type || "office",
    factoryWeight: Number(product.factoryWeight ?? product.initialQty ?? 0),
    productQty: Number(product.productQty ?? product.initialQty ?? 0),
    packSize: Number(product.packSize || 1),
    packageCount: Number(product.packageCount || ceilNumber(Number(product.productQty ?? product.initialQty ?? 0) / Number(product.packSize || 1))),
    initialQty: Number(product.packageCount || ceilNumber(Number(product.productQty ?? product.initialQty ?? 0) / Number(product.packSize || 1))),
    minStock: Number(product.minStock || 0),
    cost: Number(product.cost || 0),
    price: Number(product.price || 0),
    unit: product.type === "sale" ? "包" : product.unit,
    imageData: product.imageData || "",
  }));
  next.partners = (next.partners || []).map((partner) => ({
    ...partner,
    factoryType: partner.factoryType || (partner.type === "supplier" ? "原料廠" : ""),
    partnerType: partner.partnerType || (partner.type === "customer" ? "批發商" : ""),
    customerName: partner.customerName || (partner.type === "customer" ? partner.name : ""),
    email: partner.email || "",
    accountant: partner.accountant || "",
    owner: partner.owner || "",
    nationality: partner.nationality || "台灣",
  }));
  next.purchases = (next.purchases || []).map((doc) => ({ ...doc, vat: doc.vat || findProductIn(saved, doc.productId)?.vat || "" }));
  next.sales = (next.sales || []).map((doc) => ({ ...doc, vat: doc.vat || "" }));
  next.shipments = (next.shipments || []).map((doc) => ({
    ...doc,
    partnerId: doc.partnerId || "",
    productId: doc.productId || "",
    vat: doc.vat || "",
  }));
  next.liveSales = (next.liveSales || []).map((item) => ({
    ...item,
    revenue: Number(item.revenue ?? (Number(item.qty || 0) * Number(item.price || 0))),
    refund: Number(item.refund || 0),
    netRevenue: Number(item.netRevenue ?? (Number(item.revenue ?? (Number(item.qty || 0) * Number(item.price || 0))) - Number(item.refund || 0))),
  }));
  next.knitters = (next.knitters || []).map((item) => ({
    ...item,
    styles: Array.isArray(item.styles) ? item.styles : String(item.styles || "").split("、").filter(Boolean),
    prices: item.prices || {},
    leadTime: Number(item.leadTime || 0),
  }));
  next.samples = (next.samples || []).map((item) => ({
    ...item,
    price: Number(item.price || 0),
    imageData: item.imageData || "",
  }));
  return next;
}

function findProductIn(saved, id) {
  return (saved?.products || []).find((item) => item.id === id);
}

function saveState() {
  state.meta = { ...(state.meta || {}), updatedAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  fetch("/api/state", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(state),
  }).catch(() => {});
}

function loadSession() {
  const username = localStorage.getItem(SESSION_KEY);
  currentUser = state.settings.users.find((user) => user.username === username) || null;
}

function saveSession(username) {
  localStorage.setItem(SESSION_KEY, username);
  loadSession();
}

function hasPermission(view) {
  if (!currentUser) return false;
  if (currentUser.role === "admin") return true;
  return (currentUser.permissions || []).includes(view);
}

function applyPermissions() {
  const authed = Boolean(currentUser);
  $("#authScreen").classList.toggle("hidden", authed);
  document.body.classList.toggle("locked", !authed);
  if (!authed) return;
  $$(".nav-item").forEach((button) => {
    button.hidden = !hasPermission(button.dataset.view);
  });
  if (!hasPermission(activeView)) {
    const next = ALL_VIEWS.find(hasPermission) || "dashboard";
    setView(next);
  }
}

function registerUser(form) {
  const data = Object.fromEntries(new FormData(form));
  const username = data.username.trim();
  if (state.settings.users.some((user) => user.username === username)) return toast("帳號已存在");
  const isFirst = state.settings.users.length === 0;
  const user = {
    id: uid("usr"),
    name: data.name.trim(),
    username,
    password: data.password,
    role: isFirst ? "admin" : "user",
    permissions: isFirst ? [...ALL_VIEWS] : ["dashboard"],
  };
  state.settings.users.push(user);
  saveState();
  saveSession(username);
  form.reset();
  toast(isFirst ? "已註冊管理者帳號" : "註冊完成，請由管理者設定權限");
  renderAll();
  applyPermissions();
}

function loginUser(form) {
  const data = Object.fromEntries(new FormData(form));
  const user = state.settings.users.find((item) => item.username === data.username.trim() && item.password === data.password);
  if (!user) return toast("帳號或密碼錯誤");
  saveSession(user.username);
  form.reset();
  toast("登入成功");
  renderAll();
  applyPermissions();
}

function logoutUser() {
  localStorage.removeItem(SESSION_KEY);
  currentUser = null;
  applyPermissions();
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2200);
}

function productStock(productId) {
  const product = findProduct(productId);
  const inQty = state.purchases.filter((doc) => doc.productId === productId).reduce((sum, doc) => sum + Number(doc.qty), 0);
  const outQty = state.sales.filter((doc) => doc.productId === productId).reduce((sum, doc) => sum + Number(doc.qty), 0);
  return Number(product?.packageCount ?? product?.initialQty ?? 0) + inQty - outQty;
}

function generateSaleSku(existingId = "") {
  const now = new Date();
  const prefix = `MIT-${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}-`;
  const maxSeq = state.products
    .filter((product) => product.id !== existingId && product.type === "sale" && product.sku?.startsWith(prefix))
    .map((product) => Number(product.sku.slice(prefix.length)))
    .filter(Number.isFinite)
    .reduce((max, seq) => Math.max(max, seq), 0);
  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}

function migrateSaleProductSkus() {
  let changed = false;
  const now = new Date();
  const prefix = `MIT-${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}-`;
  let nextSeq = state.products
    .filter((product) => product.type === "sale" && product.sku?.startsWith(prefix))
    .map((product) => Number(product.sku.slice(prefix.length)))
    .filter(Number.isFinite)
    .reduce((max, seq) => Math.max(max, seq), 0) + 1;
  state.products = state.products.map((product) => {
    if (product.type !== "sale" || product.sku?.startsWith("MIT-")) return product;
    changed = true;
    const sku = `${prefix}${String(nextSeq).padStart(3, "0")}`;
    nextSeq += 1;
    return { ...product, sku };
  });
  if (changed) saveState();
}

function findProduct(id) {
  return state.products.find((item) => item.id === id);
}

function findPartner(id) {
  return state.partners.find((item) => item.id === id);
}

function monthTotal(docs) {
  const ym = today().slice(0, 7);
  return docs
    .filter((doc) => doc.date?.startsWith(ym))
    .reduce((sum, doc) => sum + Number(doc.qty) * Number(doc.price), 0);
}

function liveSalesTotal() {
  const ym = today().slice(0, 7);
  return (state.liveSales || [])
    .filter((doc) => doc.date?.startsWith(ym))
    .reduce((sum, doc) => sum + liveNet(doc), 0);
}

function currentRows(rows) {
  if (!searchTerm) return rows;
  const term = searchTerm.toLowerCase();
  return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(term));
}

function productOptions(select, mode) {
  const rows = state.products.filter((product) => product.type === "sale");
  const options = rows.map((product) => {
    const stock = productStock(product.id);
    const suffix = `，庫存 ${stock} 包`;
    return `<option value="${product.id}">${product.sku} ${product.name}${suffix}</option>`;
  });
  select.innerHTML = options.join("") || `<option value="">請先建立銷售產品</option>`;
}

function partnerOptions(select, mode) {
  const rows = state.partners.filter((partner) => mode === "factory" ? partner.factoryType : partner.partnerType || partner.customerName);
  select.innerHTML = rows.map((partner) => {
    const label = mode === "factory"
      ? `${partner.factoryType} · ${partner.name || partner.customerName}`
      : `${partner.partnerType || "合作商"} · ${partner.customerName || partner.name}`;
    return `<option value="${partner.id}">${label}</option>`;
  }).join("") || `<option value="">請先建立${mode === "factory" ? "工廠單位" : "國內合作商"}</option>`;
}

function liveShowOptions(select) {
  const rows = state.liveShows || [];
  select.innerHTML = rows.map((show) => `<option value="${show.id}">${show.code} · ${show.date} · ${show.productName}</option>`).join("") || `<option value="">未指定直播場次</option>`;
}

function positionOptions(select) {
  select.innerHTML = (state.settings?.positions || []).map((name) => `<option value="${name}">${name}</option>`).join("") || `<option value="">請先建立職位</option>`;
}

function vatOptions(select, productId) {
  const product = findProduct(productId);
  const vats = [...new Set([
    ...(state.purchases || []).filter((doc) => doc.productId === productId && doc.vat).map((doc) => doc.vat),
    product?.vat,
  ].filter(Boolean))];
  select.innerHTML = vats.map((vat) => `<option value="${vat}">${vat}</option>`).join("") || `<option value="">尚無進貨缸號</option>`;
}

function productImage(product) {
  return product?.imageData || "";
}

function productThumb(product, size = "table") {
  const image = productImage(product);
  const label = product?.name || "產品";
  return image
    ? `<img class="product-thumb ${size}" src="${image}" alt="${label}" loading="lazy" />`
    : `<span class="product-thumb empty-thumb ${size}">無圖</span>`;
}

function imageThumb(src, label = "圖片", size = "table") {
  return src
    ? `<img class="product-thumb ${size}" src="${src}" alt="${label}" loading="lazy" />`
    : `<span class="product-thumb empty-thumb ${size}">無圖</span>`;
}

function liveNet(item) {
  return Number(item.netRevenue ?? (Number(item.revenue || 0) - Number(item.refund || 0)));
}

function knitterName(id) {
  return (state.knitters || []).find((item) => item.id === id)?.name || "-";
}

function knitterOptions(select) {
  if (!select) return;
  const rows = state.knitters || [];
  select.innerHTML = rows.map((item) => `<option value="${item.id}">${item.name}</option>`).join("") || `<option value="">請先建立織女資料</option>`;
}

function syncSelects() {
  productOptions($("#purchaseProduct"), "purchase");
  productOptions($("#saleProduct"), "sale");
  productOptions($("#shipmentProduct"), "shipment");
  partnerOptions($("#purchasePartner"), "factory");
  partnerOptions($("#salePartner"), "customer");
  partnerOptions($("#shipmentPartner"), "customer");
  liveShowOptions($("#liveSaleShow"));
  positionOptions($("#staffTitle"));
  knitterOptions($("#sampleKnitter"));
  renderProductCard($("#purchaseProduct")?.value, "purchaseProductCard");
  renderProductCard($("#saleProduct")?.value, "saleProductCard");
  renderProductCard($("#shipmentProduct")?.value, "shipmentProductCard");
  vatOptions($("#saleVat"), $("#saleProduct")?.value);
  vatOptions($("#shipmentVat"), $("#shipmentProduct")?.value);
  updateDocProduct("purchaseForm", "purchaseProductCard", "cost");
  updateDocProduct("saleForm", "saleProductCard", "price");
  updateDocProduct("shipmentForm", "shipmentProductCard", "price");
}

function renderProductCard(productId, targetId) {
  const target = $(`#${targetId}`);
  if (!target) return;
  const product = findProduct(productId);
  if (!product) {
    target.innerHTML = `<div class="summary-media">${productThumb(null, "card")}</div><div><span>銷售產品</span><strong>請先選擇產品</strong></div>`;
    return;
  }
  target.innerHTML = `
    <div class="summary-media">${productThumb(product, "card")}</div>
    <div><span>產品編號</span><strong>${product.sku}</strong></div>
    <div><span>目前庫存</span><strong>${number(productStock(product.id))} 包</strong></div>
    <div><span>紗號 / 色號</span><strong>${product.yarnNo || "-"} / ${product.color || "-"}</strong></div>
    <div><span>缸號</span><strong>${product.vat || "-"}</strong></div>
    <div><span>工廠生產重量</span><strong>${number(product.factoryWeight)} KG</strong></div>
    <div><span>產品數量</span><strong>${number(product.productQty)} 團</strong></div>
    <div><span>單包團數</span><strong>${number(product.packSize)} 團</strong></div>
    <div><span>產品包數</span><strong>${number(product.packageCount)} 包</strong></div>
  `;
}

function renderDashboard() {
  const saleProducts = state.products.filter((product) => product.type === "sale");
  const stockValue = saleProducts.reduce((sum, product) => sum + productStock(product.id) * Number(product.cost), 0);
  const lowStocks = saleProducts.filter((product) => productStock(product.id) <= Number(product.minStock));
  const trackingRows = state.yarnTracks || [];
  const liveRows = state.liveShows || [];
  $("#stockValue").textContent = money(stockValue);
  $("#monthPurchase").textContent = money(monthTotal(state.purchases));
  $("#monthSale").textContent = money(monthTotal(state.sales) + liveSalesTotal());
  $("#lowStockCount").textContent = lowStocks.length + trackingRows.filter((item) => item.status !== "已完成").length;

  $("#lowStockRows").innerHTML = lowStocks.map((product) => {
    const stock = productStock(product.id);
    return `<tr>
      <td>${product.name}</td>
      <td>${number(stock)} 包</td>
      <td>${number(product.minStock)}</td>
      <td>${stock <= 0 ? tag("缺貨", "out") : tag("補貨", "warn")}</td>
    </tr>`;
  }).join("") || emptyRow(4);

  const docs = [
    ...state.purchases.map((doc) => ({ ...doc, kind: "進貨", icon: "truck" })),
    ...state.sales.map((doc) => ({ ...doc, kind: "銷貨", icon: "shopping-cart" })),
    ...(state.liveSales || []).map((doc) => ({ ...doc, no: "LIVE-SALE", kind: "直播間銷售", icon: "badge-dollar-sign", partnerId: "", price: liveNet(doc), qty: 1 })),
    ...liveRows.map((doc) => ({ ...doc, no: doc.code, kind: "直播", icon: "radio", partnerId: "", productId: "", price: doc.targetGmv, qty: 1 })),
    ...trackingRows.map((doc) => ({ ...doc, no: doc.code, kind: "貨品", icon: "route", partnerId: "", productId: "", price: 0, qty: 0 })),
  ].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
  $("#recentDocs").innerHTML = docs.map((doc) => {
    const product = findProduct(doc.productId);
    const partner = findPartner(doc.partnerId);
    return `<div class="activity-item">
      <span class="activity-icon"><i data-lucide="${doc.icon}"></i></span>
      <div><strong>${doc.kind} ${doc.no}</strong><span>${partner?.name || doc.host || "-"} · ${product?.name || doc.productName || doc.name || "-"}</span></div>
      <strong>${money(Number(doc.qty) * Number(doc.price))}</strong>
    </div>`;
  }).join("") || `<p class="empty">尚無單據</p>`;
  renderDashboardExtras();
}

function renderDashboardExtras() {
  const announcements = currentRows(state.announcements || []).sort((a, b) => b.createdAt - a.createdAt);
  $("#announcementCount").textContent = `${announcements.length} 則`;
  $("#announcementForm").classList.toggle("hidden", currentUser?.role !== "admin");
  $("#announcementRows").innerHTML = announcements.map((item) => `
    <article class="announcement-item">
      <div><strong>${item.title}</strong><span>${new Date(item.createdAt).toLocaleString("zh-TW")} · ${item.author || "管理者"}</span></div>
      <p>${item.content}</p>
      ${currentUser?.role === "admin" ? rowActions("announcement", item.id) : ""}
    </article>
  `).join("") || `<p class="empty">尚無公告</p>`;

  const dashboardLiveSales = (state.liveSales || []).slice().sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`)).slice(0, 6);
  $("#dashboardLiveSaleCount").textContent = `${dashboardLiveSales.length} 筆`;
  $("#dashboardLiveSaleRows").innerHTML = dashboardLiveSales.map((item) => `
    <tr><td>${item.date || "-"}</td><td>${item.room || "-"}</td><td>${item.host || "-"}</td><td class="num">${money(item.revenue)}</td><td class="num">${money(item.refund)}</td><td class="num">${money(liveNet(item))}</td></tr>
  `).join("") || emptyRow(6);

  const liveSimple = (state.liveShows || []).slice().sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  $("#simpleLiveCount").textContent = `${liveSimple.length} 場`;
  $("#simpleLiveRows").innerHTML = liveSimple.map((item) => `
    <tr><td>${item.date || "-"} ${item.time || ""}</td><td>${item.host || "-"}</td><td>${tag(item.status || "未開始", item.status === "已完成" ? "ok" : "blue")}</td></tr>
  `).join("") || emptyRow(3);

  const sampleRows = (state.samples || []).slice().sort((a, b) => `${b.receivedDate}${b.createdAt}`.localeCompare(`${a.receivedDate}${a.createdAt}`)).slice(0, 6);
  $("#dashboardSampleCount").textContent = `${sampleRows.length} 件`;
  $("#dashboardSampleRows").innerHTML = sampleRows.map((item) => `
    <tr><td>${item.receivedDate || "-"}</td><td>${knitterName(item.knitterId)}</td><td>${item.style || "-"}</td><td>${tag(item.status || "-", item.status === "已到貨" ? "ok" : "blue")}</td><td>${item.hasTutorial || "-"}</td><td class="num">${money(item.price)}</td></tr>
  `).join("") || emptyRow(6);
  $("#dashboardSampleInventoryCount").textContent = `${sampleRows.length} 件`;
  $("#dashboardSampleInventoryRows").innerHTML = sampleRows.map((item) => `
    <tr><td>${item.style || "-"}</td><td>${knitterName(item.knitterId)}</td><td>${tag(item.status || "-", item.status === "已到貨" ? "ok" : "blue")}</td><td>${tag(item.settled || "未支付", item.settled === "已結清" ? "ok" : "warn")}</td><td>${item.receivedDate || "-"}</td></tr>
  `).join("") || emptyRow(5);
}

function tag(text, type = "") {
  return `<span class="tag ${type}">${text}</span>`;
}

function emptyRow(colspan) {
  return `<tr><td class="empty" colspan="${colspan}">尚無資料</td></tr>`;
}

function rowActions(type, id, editable = false) {
  return `<div class="row-actions">
    ${editable ? `<button class="small-btn" data-edit="${type}" data-id="${id}" aria-label="編輯"><i data-lucide="pencil"></i></button>` : ""}
    <button class="small-btn delete" data-delete="${type}" data-id="${id}" aria-label="刪除"><i data-lucide="trash-2"></i></button>
  </div>`;
}

function renderProducts() {
  const saleRows = currentRows(state.products.filter((product) => product.type === "sale"));
  const officeRows = currentRows(state.products.filter((product) => product.type !== "sale"));
  $("#productListTitle").textContent = productTab === "saleGoods" ? "銷售產品清單" : "一般產品清單";
  $("#productCount").textContent = `${productTab === "saleGoods" ? saleRows.length : officeRows.length} 筆`;
  $("#sellProductRows").innerHTML = saleRows.map((product) => `<tr>
    <td>${productThumb(product)}</td>
    <td>${product.sku}</td>
    <td>${product.name}</td>
    <td>${product.yarnNo || "-"}</td>
    <td>${product.count || "-"}</td>
    <td>${product.composition || "-"}</td>
    <td>${product.color || "-"}</td>
    <td>${product.vat || "-"}</td>
    <td>${number(product.factoryWeight)} KG</td>
    <td>${number(product.productQty)} 團</td>
    <td>${number(product.packSize)} 團</td>
    <td>${number(product.packageCount)} 包</td>
    <td class="num">${money(product.price)}</td>
    <td>${rowActions("product", product.id, true)}</td>
  </tr>`).join("") || emptyRow(14);
  $("#productRows").innerHTML = officeRows.map((product) => `<tr>
    <td>${product.sku}</td>
    <td>${product.name}</td>
    <td>${product.category || "-"}</td>
    <td class="num">${money(product.cost)}</td>
    <td class="num">${money(product.price)}</td>
    <td>${number(product.minStock)}</td>
    <td>${rowActions("product", product.id, true)}</td>
  </tr>`).join("") || emptyRow(7);
}

function renderPartners() {
  const rows = currentRows(state.partners);
  $("#partnerCount").textContent = `${rows.length} 筆`;
  $("#partnerRows").innerHTML = rows.map((partner) => `<tr>
    <td>${partner.factoryType ? tag(partner.factoryType, "blue") : "-"}</td>
    <td>${partner.partnerType ? tag(partner.partnerType, "ok") : "-"}</td>
    <td>${partner.customerName || "-"}</td>
    <td>${partner.name}</td>
    <td>${partner.contact || "-"}</td>
    <td>${partner.phone || "-"}</td>
    <td>${partner.email || "-"}</td>
    <td>${partner.accountant || "-"}</td>
    <td>${partner.owner || "-"}</td>
    <td>${partner.nationality || "-"}</td>
    <td>${rowActions("partner", partner.id, true)}</td>
  </tr>`).join("") || emptyRow(11);
}

function renderDocs(kind) {
  const docs = kind === "purchase" ? state.purchases : state.sales;
  const rows = currentRows(docs.map((doc) => ({
    ...doc,
    productName: findProduct(doc.productId)?.name || "",
    productSku: findProduct(doc.productId)?.sku || "",
    yarnNo: findProduct(doc.productId)?.yarnNo || "",
    color: findProduct(doc.productId)?.color || "",
    partnerName: findPartner(doc.partnerId)?.customerName || findPartner(doc.partnerId)?.name || "",
  }))).sort((a, b) => `${b.date}${b.no}`.localeCompare(`${a.date}${a.no}`));
  const tbody = kind === "purchase" ? $("#purchaseRows") : $("#saleRows");
  const count = kind === "purchase" ? $("#purchaseCount") : $("#saleCount");
  count.textContent = `${rows.length} 筆`;
  tbody.innerHTML = rows.map((doc) => `<tr>
    <td>${productThumb(findProduct(doc.productId))}</td>
    <td>${doc.no}</td>
    <td>${doc.date}</td>
    <td>${doc.partnerName || "-"}</td>
    <td>${doc.productSku || "-"}</td>
    <td>${doc.productName || "-"}</td>
    <td>${doc.yarnNo || "-"}</td>
    <td>${doc.color || "-"}</td>
    <td>${doc.vat || "-"}</td>
    <td>${number(doc.qty)} 包</td>
    <td class="num">${money(doc.price)}</td>
    <td class="num">${money(Number(doc.qty) * Number(doc.price))}</td>
    <td>${rowActions(kind, doc.id)}</td>
  </tr>`).join("") || emptyRow(13);
}

function renderInventory() {
  const rows = currentRows(state.products.filter((product) => product.type === "sale"));
  $("#inventoryCount").textContent = `${rows.length} 品項`;
  $("#inventoryRows").innerHTML = rows.map((product) => {
    const stock = productStock(product.id);
    const status = stock <= 0 ? tag("缺貨", "out") : stock <= Number(product.minStock) ? tag("偏低", "warn") : tag("正常", "ok");
    return `<tr>
      <td>${productThumb(product)}</td>
      <td>${product.sku}</td>
      <td>${product.name}</td>
      <td>${product.yarnNo || "-"}</td>
      <td>${product.color || "-"}</td>
      <td>${number(product.factoryWeight)} KG</td>
      <td>${number(product.packageCount)} 包</td>
      <td>${number(stock)} 包</td>
      <td>${number(product.minStock)}</td>
      <td class="num">${money(stock * Number(product.cost))}</td>
      <td>${status}</td>
    </tr>`;
  }).join("") || emptyRow(11);
}

function progressMark(status, step) {
  const order = ["胚紗生產中", "染色中", "打包中", "已完成"];
  return order.indexOf(status) >= order.indexOf(step) ? "●" : "";
}

function daysLeft(dateText) {
  if (!dateText) return "";
  const end = new Date(`${dateText}T00:00:00`);
  const now = new Date(`${today()}T00:00:00`);
  return Math.ceil((end - now) / 86400000);
}

function riskTag(item) {
  if (item.status === "已完成") return tag("完成", "ok");
  const left = daysLeft(item.dueDate);
  if (left === "") return tag("未排程");
  if (left < 0) return tag("逾期", "out");
  if (left <= 3) return tag("注意", "warn");
  return tag("正常", "ok");
}

function renderTracking() {
  const rows = currentRows(state.yarnTracks || []);
  $("#trackingCount").textContent = `${rows.length} 筆`;
  $("#trackingRows").innerHTML = rows.map((item) => `<tr>
    <td>${item.code}</td>
    <td>${item.name}</td>
    <td>${item.yarnNo}</td>
    <td>${item.color || "-"}</td>
    <td>${item.vat || "-"}</td>
    <td>${number(item.qty)} ${item.unit || ""}</td>
    <td>${tag(item.status, item.status === "已完成" ? "ok" : "warn")}</td>
    <td>${item.dueDate || "-"}</td>
    <td>${rowActions("tracking", item.id)}</td>
  </tr>`).join("") || emptyRow(9);
}

function renderProduction() {
  const rows = currentRows(state.yarnTracks || []);
  $("#productionCount").textContent = `${rows.length} 批次`;
  $("#productionRows").innerHTML = rows.map((item) => {
    const left = daysLeft(item.dueDate);
    return `<tr>
      <td>${item.code}</td>
      <td>${item.name}</td>
      <td>${item.status}</td>
      <td>${progressMark(item.status, "胚紗生產中")}</td>
      <td>${progressMark(item.status, "染色中")}</td>
      <td>${progressMark(item.status, "打包中")}</td>
      <td>${progressMark(item.status, "已完成")}</td>
      <td>${item.dueDate || "-"}</td>
      <td>${left === "" ? "-" : `${left} 天`}</td>
      <td>${riskTag(item)}</td>
    </tr>`;
  }).join("") || emptyRow(10);
}

function renderLive() {
  const rows = currentRows(state.liveShows || []).sort((a, b) => `${b.date}${b.code}`.localeCompare(`${a.date}${a.code}`));
  $("#liveCount").textContent = `${rows.length} 場`;
  $("#liveRows").innerHTML = rows.map((item) => `<tr>
    <td>${item.code}</td>
    <td>${item.date}</td>
    <td>${item.time || "-"}</td>
    <td>${item.host || "-"}</td>
    <td>${item.productName}</td>
    <td class="num">${money(item.targetGmv)}</td>
    <td>${tag(item.status, item.status === "已完成" ? "ok" : item.status === "取消" ? "out" : "warn")}</td>
    <td>${rowActions("live", item.id)}</td>
  </tr>`).join("") || emptyRow(8);
}

function renderShipments() {
  const rows = currentRows(state.shipments || []).sort((a, b) => `${b.date}${b.no}`.localeCompare(`${a.date}${a.no}`));
  $("#shipmentCount").textContent = `${rows.length} 筆`;
  $("#shipmentRows").innerHTML = rows.map((item) => {
    const product = findProduct(item.productId);
    const partner = findPartner(item.partnerId);
    return `<tr>
    <td>${productThumb(product)}</td>
    <td>${item.no}</td>
    <td>${item.date}</td>
    <td>${partner?.customerName || partner?.name || item.customer || "-"}</td>
    <td>${product?.sku || "-"}</td>
    <td>${product?.name || item.productName || "-"}</td>
    <td>${item.vat || "-"}</td>
    <td>${number(item.qty)} 包</td>
    <td class="num">${money(item.price)}</td>
    <td class="num">${money(Number(item.qty) * Number(item.price))}</td>
    <td>${tag(item.status || "待出貨", "blue")}</td>
    <td>${rowActions("shipment", item.id)}</td>
  </tr>`;
  }).join("") || emptyRow(12);
}

function renderLiveSales() {
  const rows = currentRows(state.liveSales || []).sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`));
  $("#liveSaleCount").textContent = `${rows.length} 筆`;
  $("#liveSaleRows").innerHTML = rows.map((item) => `<tr>
      <td>${item.date}</td>
      <td>${item.room || "-"}</td>
      <td>${item.host || "-"}</td>
      <td class="num">${money(item.revenue)}</td>
      <td class="num">${money(item.refund)}</td>
      <td class="num">${money(liveNet(item))}</td>
      <td>${item.note || "-"}</td>
      <td>${rowActions("liveSale", item.id)}</td>
    </tr>`).join("") || emptyRow(8);
}

function renderKnitters() {
  const knitters = currentRows(state.knitters || []);
  $("#knitterCount").textContent = `${knitters.length} 筆`;
  $("#knitterRows").innerHTML = knitters.map((item) => {
    const styles = item.styles || [];
    const priceText = styles.map((style) => `${style} ${money(item.prices?.[style] || 0)}`).join("、") || "-";
    return `<tr>
      <td>${item.contractDate || "-"}</td>
      <td>${item.name || "-"}</td>
      <td>${styles.join("、") || "-"}</td>
      <td>${priceText}</td>
      <td>${number(item.leadTime)} 天</td>
      <td>${item.tutorialAvailable || "-"}</td>
      <td>${item.settlementDate || "-"}</td>
      <td>${rowActions("knitter", item.id)}</td>
    </tr>`;
  }).join("") || emptyRow(8);

  const samples = currentRows(state.samples || []).sort((a, b) => `${b.receivedDate}${b.createdAt}`.localeCompare(`${a.receivedDate}${a.createdAt}`));
  $("#sampleCount").textContent = `${samples.length} 筆`;
  $("#sampleRows").innerHTML = samples.map((item) => `<tr>
    <td>${imageThumb(item.imageData, item.style)}</td>
    <td>${knitterName(item.knitterId)}</td>
    <td>${item.receivedDate || "-"}</td>
    <td>${tag(item.status || "-", item.status === "已到貨" ? "ok" : "blue")}</td>
    <td>${item.style || "-"}</td>
    <td>${item.hasTutorial || "-"}</td>
    <td class="num">${money(item.price)}</td>
    <td>${tag(item.settled || "未支付", item.settled === "已結清" ? "ok" : "warn")}</td>
    <td>${rowActions("sample", item.id)}</td>
  </tr>`).join("") || emptyRow(9);

  $("#sampleInventoryCount").textContent = `${samples.length} 件`;
  $("#sampleInventoryRows").innerHTML = samples.map((item) => `<tr>
    <td>${imageThumb(item.imageData, item.style)}</td>
    <td>${item.style || "-"}</td>
    <td>${knitterName(item.knitterId)}</td>
    <td>${item.receivedDate || "-"}</td>
    <td>${tag(item.status || "-", item.status === "已到貨" ? "ok" : "blue")}</td>
    <td>${item.hasTutorial || "-"}</td>
    <td class="num">${money(item.price)}</td>
    <td>${tag(item.settled || "未支付", item.settled === "已結清" ? "ok" : "warn")}</td>
  </tr>`).join("") || emptyRow(8);
}

function renderSettings() {
  const rows = currentRows(state.settings?.positions || []);
  $("#positionCount").textContent = `${rows.length} 筆`;
  $("#positionRows").innerHTML = rows.map((name) => `<tr>
    <td>${name}</td>
    <td>${rowActions("position", name)}</td>
  </tr>`).join("") || emptyRow(2);
  const users = state.settings.users || [];
  $("#permissionCount").textContent = `${users.length} 人`;
  $("#permissionRows").innerHTML = users.map((user) => `
    <article class="permission-card">
      <div><strong>${user.name}</strong><span>${user.username} · ${user.role === "admin" ? "管理者" : "一般帳號"}</span></div>
      <div class="permission-grid">
        ${ALL_VIEWS.map((view) => `<label><input type="checkbox" data-permission-user="${user.id}" value="${view}" ${user.role === "admin" || (user.permissions || []).includes(view) ? "checked" : ""} ${user.role === "admin" ? "disabled" : ""}>${viewLabel(view)}</label>`).join("")}
      </div>
    </article>
  `).join("") || `<p class="empty">尚無帳號</p>`;
}

function viewLabel(view) {
  return $(`.nav-item[data-view="${view}"] span`)?.textContent || view;
}

function renderStaff() {
  const rows = currentRows(state.staff || []);
  $("#staffCount").textContent = `${rows.length} 人`;
  $("#staffRows").innerHTML = rows.map((item) => `<tr>
    <td>${tag(staffTypeLabel(item.employeeType), item.employeeType === "partner" ? "warn" : item.employeeType === "core" ? "blue" : "ok")}</td>
    <td>${item.code}</td>
    <td>${item.name}</td>
    <td>${item.dept}</td>
    <td>${item.title || "-"}</td>
    <td>${tag(item.role, "blue")}</td>
    <td>${item.phone || "-"}</td>
    <td>${tag(item.status || "在職", item.status === "離職" ? "out" : "ok")}</td>
    <td>${rowActions("staff", item.id, true)}</td>
  </tr>`).join("") || emptyRow(9);
}

function staffTypeLabel(type) {
  return { regular: "一般", core: "核心", partner: "合夥" }[type || "regular"] || "一般";
}

function renderLeave() {
  const rows = currentRows(state.leaveRequests || []).sort((a, b) => `${b.startDate}${b.code}`.localeCompare(`${a.startDate}${a.code}`));
  $("#leaveCount").textContent = `${rows.length} 筆`;
  $("#leaveRows").innerHTML = rows.map((item) => `<tr>
    <td>${item.code}</td>
    <td>${item.name}</td>
    <td>${item.type || "-"}</td>
    <td>${item.startDate} ~ ${item.endDate}</td>
    <td>${number(item.days)}</td>
    <td>${tag(item.status, item.status === "已通過" ? "ok" : item.status === "已駁回" ? "out" : "warn")}</td>
    <td>${item.approver || "-"}</td>
    <td>${rowActions("leave", item.id)}</td>
  </tr>`).join("") || emptyRow(8);
}

function renderAll() {
  syncSelects();
  renderDashboard();
  renderProducts();
  renderPartners();
  renderDocs("purchase");
  renderDocs("sale");
  renderInventory();
  renderTracking();
  renderProduction();
  renderLive();
  renderShipments();
  renderLiveSales();
  renderKnitters();
  renderStaff();
  renderLeave();
  renderSettings();
  if (window.lucide) window.lucide.createIcons();
  if (currentLang === "zh-CN") applyLanguage();
}

function setView(view) {
  activeView = view;
  $$(".view").forEach((el) => el.classList.toggle("active", el.id === view));
  $$(".nav-item").forEach((el) => el.classList.toggle("active", el.dataset.view === view));
  const label = $(`.nav-item[data-view="${view}"] span`)?.textContent || "總覽";
  $("#viewTitle").textContent = label;
}

function setProductTab(tab) {
  productTab = tab;
  $$("[data-product-tab]").forEach((button) => button.classList.toggle("active", button.dataset.productTab === tab));
  $$("[data-product-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.productPanel === tab));
  renderProducts();
  if (window.lucide) window.lucide.createIcons();
}

function setSettingTab(tab) {
  $$("[data-setting-tab]").forEach((button) => button.classList.toggle("active", button.dataset.settingTab === tab));
  $$("[data-setting-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.settingPanel === tab));
}

function setKnitterTab(tab) {
  knitterTab = tab;
  $$("[data-knitter-tab]").forEach((button) => button.classList.toggle("active", button.dataset.knitterTab === tab));
  $$("[data-knitter-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.knitterPanel === tab));
  renderKnitters();
}

function setAuthTab(tab) {
  $$("[data-auth-tab]").forEach((button) => button.classList.toggle("active", button.dataset.authTab === tab));
  $$("[data-auth-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.authPanel === tab));
}

function setStaffTab(tab) {
  staffTab = tab;
  $("#staffEmployeeType").value = tab;
  $$("[data-staff-tab]").forEach((button) => button.classList.toggle("active", button.dataset.staffTab === tab));
  $$("[data-staff-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.staffPanel === tab));
}

function fillForm(form, data) {
  Object.entries(data).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value;
  });
  if (form.id === "sellProductForm") {
    updatePackageCount();
    renderProductImagePreview(form.elements.imageData.value);
  }
}

function resetForm(form) {
  form.reset();
  if (form.elements.id) form.elements.id.value = "";
  if (form.elements.date) form.elements.date.value = today();
  if (form.elements.contractDate) form.elements.contractDate.value = today();
  if (form.elements.receivedDate) form.elements.receivedDate.value = today();
  if (form.id === "sellProductForm") {
    form.elements.sku.value = generateSaleSku();
    form.elements.imageData.value = "";
    updatePackageCount();
    renderProductImagePreview("");
  }
  if (form.id === "partnerForm") {
    form.elements.nationality.value = "台灣";
  }
  if (form.id === "staffForm") {
    setStaffTab(staffTab);
  }
  if (form.id === "sampleForm") {
    form.elements.imageData.value = "";
    renderImagePreview("sampleImagePreview", "");
  }
  if (form.id === "liveSaleForm") {
    updateLiveSaleNet();
  }
}

function updatePackageCount() {
  const form = $("#sellProductForm");
  if (!form) return;
  const qty = Number(form.elements.productQty.value || 0);
  const packSize = Number(form.elements.packSize.value || 0);
  form.elements.packageCount.value = packSize > 0 ? ceilNumber(qty / packSize) : 0;
}

function renderProductImagePreview(src) {
  const preview = $("#productImagePreview");
  if (!preview) return;
  preview.innerHTML = src
    ? `<img src="${src}" alt="產品圖片預覽" />`
    : "尚未選擇圖片";
}

function renderImagePreview(targetId, src) {
  const preview = $(`#${targetId}`);
  if (!preview) return;
  preview.innerHTML = src
    ? `<img src="${src}" alt="圖片預覽" />`
    : "尚未選擇圖片";
}

function handleImageUpload(event, formId, previewId) {
  const file = event.target.files?.[0];
  const form = $(`#${formId}`);
  if (!file || !form) return;
  if (!file.type.startsWith("image/")) {
    toast("請選擇圖片檔");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    form.elements.imageData.value = reader.result;
    renderImagePreview(previewId, reader.result);
  };
  reader.readAsDataURL(file);
}

function handleProductImage(event) {
  const file = event.target.files?.[0];
  const form = $("#sellProductForm");
  if (!file || !form) return;
  if (!file.type.startsWith("image/")) {
    toast("請選擇圖片檔");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    form.elements.imageData.value = reader.result;
    renderProductImagePreview(reader.result);
  };
  reader.readAsDataURL(file);
}

function updateLiveSaleNet() {
  const form = $("#liveSaleForm");
  if (!form) return;
  const revenue = Number(form.elements.revenue.value || 0);
  const refund = Number(form.elements.refund.value || 0);
  form.elements.netRevenue.value = Math.max(0, revenue - refund);
}

function updateDocProduct(formId, cardId, priceType) {
  const form = $(`#${formId}`);
  if (!form) return;
  const product = findProduct(form.elements.productId.value);
  renderProductCard(product?.id, cardId);
  if (product) form.elements.price.value = priceType === "cost" ? product.cost : product.price;
}

function upsertProduct(form) {
  const data = Object.fromEntries(new FormData(form));
  const payload = {
    id: data.id || uid("prd"),
    type: "office",
    sku: data.sku.trim(),
    name: data.name.trim(),
    category: data.category.trim(),
    unit: data.unit.trim(),
    cost: Number(data.cost),
    price: Number(data.price),
    minStock: Number(data.minStock),
    imageData: data.imageData || "",
  };
  state.products = data.id ? state.products.map((item) => item.id === data.id ? payload : item) : [...state.products, payload];
  saveState();
  resetForm(form);
  toast("商品已儲存");
  renderAll();
}

function upsertSellProduct(form) {
  const data = Object.fromEntries(new FormData(form));
  const productQty = Number(data.productQty || 0);
  const packSize = Math.max(1, Number(data.packSize || 1));
  const payload = {
    id: data.id || uid("sale-prd"),
    type: "sale",
    sku: data.sku.trim() || generateSaleSku(data.id),
    yarnNo: data.yarnNo.trim(),
    count: data.count.trim(),
    composition: data.composition.trim(),
    name: data.name.trim(),
    color: data.color.trim(),
    vat: data.vat.trim(),
    factoryWeight: Number(data.factoryWeight || 0),
    productQty,
    packSize,
    packageCount: ceilNumber(productQty / packSize),
    initialQty: productQty,
    unit: "包",
    cost: Number(data.cost || 0),
    price: Number(data.price),
    minStock: Number(data.minStock || 0),
    note: data.note.trim(),
    imageData: data.imageData || "",
  };
  state.products = data.id ? state.products.map((item) => item.id === data.id ? payload : item) : [...state.products, payload];
  saveState();
  resetForm(form);
  toast("銷售產品已儲存");
  renderAll();
}

function upsertPartner(form) {
  const data = Object.fromEntries(new FormData(form));
  const customerName = data.customerName.trim();
  const companyName = data.name.trim();
  if (!customerName && !companyName) {
    toast("客戶名稱與公司名稱至少填寫一個");
    return;
  }
  const payload = {
    id: data.id || uid("par"),
    type: data.partnerType || customerName ? "customer" : "supplier",
    factoryType: data.factoryType,
    partnerType: data.partnerType,
    customerName,
    name: companyName,
    contact: data.contact.trim(),
    phone: data.phone.trim(),
    email: data.email.trim(),
    accountant: data.accountant.trim(),
    owner: data.owner.trim(),
    nationality: data.nationality,
    address: data.address.trim(),
  };
  state.partners = data.id ? state.partners.map((item) => item.id === data.id ? payload : item) : [...state.partners, payload];
  saveState();
  resetForm(form);
  toast("單位已儲存");
  renderAll();
}

function upsertStaff(form) {
  const data = Object.fromEntries(new FormData(form));
  const payload = {
    id: data.id || uid("stf"),
    code: data.code.trim(),
    name: data.name.trim(),
    dept: data.dept,
    title: data.title,
    role: data.role,
    phone: data.phone.trim(),
    joinDate: data.joinDate,
    status: data.status,
    employeeType: data.employeeType || staffTab,
    regularNote: data.regularNote?.trim() || "",
    coreDuty: data.coreDuty?.trim() || "",
    bonusPlan: data.bonusPlan?.trim() || "",
    partnerLevel: data.partnerLevel?.trim() || "",
    profitShare: data.profitShare?.trim() || "",
    partnerDuty: data.partnerDuty?.trim() || "",
    note: data.note.trim(),
    createdAt: data.id ? (state.staff.find((item) => item.id === data.id)?.createdAt || Date.now()) : Date.now(),
  };
  state.staff = data.id ? state.staff.map((item) => item.id === data.id ? payload : item) : [...state.staff, payload];
  saveState();
  resetForm(form);
  toast(data.id ? "員工資料已修改" : "員工資料已新增");
  renderAll();
}

function addDoc(form, kind) {
  const data = Object.fromEntries(new FormData(form));
  const product = findProduct(data.productId);
  if (!product) return toast("請先建立商品");
  if (!findPartner(data.partnerId)) return toast(kind === "purchase" ? "請先建立工廠單位" : "請先建立國內合作商");
  if (kind === "sale" && Number(data.qty) > productStock(data.productId)) return toast("庫存不足，無法建立銷貨單");

  const list = kind === "purchase" ? state.purchases : state.sales;
  const prefix = kind === "purchase" ? "PO" : "SO";
  const doc = {
    id: uid(kind === "purchase" ? "pur" : "sal"),
    no: `${prefix}-${today().replaceAll("-", "")}-${String(list.length + 1).padStart(3, "0")}`,
    partnerId: data.partnerId,
    productId: data.productId,
    vat: data.vat || product.vat || "",
    qty: Number(data.qty),
    price: Number(data.price),
    date: data.date,
    createdAt: Date.now(),
  };
  list.push(doc);
  saveState();
  resetForm(form);
  toast(kind === "purchase" ? "進貨單已新增" : "銷貨單已新增");
  renderAll();
}

function deleteItem(type, id) {
  if (type === "position") {
    if ((state.staff || []).some((item) => item.title === id)) return toast("已有員工使用此職位，請先調整人事資料");
    state.settings.positions = (state.settings.positions || []).filter((name) => name !== id);
    saveState();
    toast("職位已刪除");
    renderAll();
    return;
  }
  const hasDoc = type === "product"
    ? state.purchases.some((doc) => doc.productId === id) || state.sales.some((doc) => doc.productId === id)
    : type === "partner"
      ? state.purchases.some((doc) => doc.partnerId === id) || state.sales.some((doc) => doc.partnerId === id)
      : false;
  if (hasDoc) return toast("已有單據使用，請保留資料");
  const map = { product: "products", partner: "partners", purchase: "purchases", sale: "sales", tracking: "yarnTracks", live: "liveShows", liveSale: "liveSales", shipment: "shipments", staff: "staff", leave: "leaveRequests", announcement: "announcements", knitter: "knitters", sample: "samples" };
  state[map[type]] = state[map[type]].filter((item) => item.id !== id);
  saveState();
  toast("資料已刪除");
  renderAll();
}

function addGeneric(form, key, prefix, transform = (data) => data) {
  const data = Object.fromEntries(new FormData(form));
  const payload = transform(data);
  state[key] = [...(state[key] || []), { id: uid(prefix), createdAt: Date.now(), ...payload }];
  saveState();
  resetForm(form);
  toast("資料已新增");
  renderAll();
}

function addKnitter(form) {
  const data = Object.fromEntries(new FormData(form));
  const styles = new FormData(form).getAll("styles");
  if (!styles.length) return toast("請至少選擇一個樣衣款式");
  const prices = Object.fromEntries(styles.map((style) => [style, Number(data[`price_${style}`] || 0)]));
  state.knitters = [...(state.knitters || []), {
    id: uid("knitter"),
    contractDate: data.contractDate,
    name: data.name.trim(),
    styles,
    prices,
    leadTime: Number(data.leadTime || 0),
    tutorialAvailable: data.tutorialAvailable,
    settlementDate: data.settlementDate,
    createdAt: Date.now(),
  }];
  saveState();
  resetForm(form);
  toast("織女資料已新增");
  renderAll();
}

function addSample(form) {
  const data = Object.fromEntries(new FormData(form));
  if (!data.knitterId) return toast("請先建立織女資料");
  state.samples = [...(state.samples || []), {
    id: uid("sample"),
    knitterId: data.knitterId,
    receivedDate: data.receivedDate,
    imageData: data.imageData || "",
    status: data.status,
    style: data.style,
    hasTutorial: data.hasTutorial,
    price: Number(data.price || 0),
    settled: data.settled,
    createdAt: Date.now(),
  }];
  saveState();
  resetForm(form);
  toast("樣衣&配件已新增");
  renderAll();
}

function addLiveSale(form) {
  const data = Object.fromEntries(new FormData(form));
  const show = (state.liveShows || []).find((item) => item.id === data.liveId);
  const revenue = Number(data.revenue || 0);
  const refund = Number(data.refund || 0);
  state.liveSales = [...(state.liveSales || []), {
    id: uid("live-sale"),
    liveId: data.liveId,
    date: data.date,
    room: data.room.trim(),
    host: data.host.trim() || show?.host || "",
    revenue,
    refund,
    netRevenue: Math.max(0, revenue - refund),
    note: data.note.trim(),
    createdAt: Date.now(),
  }];
  saveState();
  resetForm(form);
  toast("直播間銷售已新增");
  renderAll();
}

function addPosition(form) {
  const data = Object.fromEntries(new FormData(form));
  const name = data.name.trim();
  if (!name) return;
  if ((state.settings.positions || []).includes(name)) return toast("職位已存在");
  state.settings.positions = [...(state.settings.positions || []), name];
  saveState();
  resetForm(form);
  toast("職位已新增");
  renderAll();
}

function addAnnouncement(form) {
  if (currentUser?.role !== "admin") return toast("只有管理者可以新增公告");
  const data = Object.fromEntries(new FormData(form));
  state.announcements = [...(state.announcements || []), {
    id: uid("ann"),
    title: data.title.trim(),
    content: data.content.trim(),
    author: currentUser.name,
    createdAt: Date.now(),
  }];
  saveState();
  form.reset();
  toast("公告已新增");
  renderAll();
}

const contractNames = {
  adminEmployee: "行政員工合同",
  salesEmployee: "銷售員工合同",
  wholesalePartner: "批發商合作合同",
  dealerPartner: "經銷商合作合同",
  influencerPartner: "達人合作合同",
  factoryPartner: "工廠合作合同",
  knitterPartner: "織女合作合同",
  partnerEmployee: "合夥人員工合同",
};

function buildContract(data) {
  const name = contractNames[data.type] || "合作合同";
  const partyA = data.partyA || "秦時線";
  const partyB = data.partyB || "乙方";
  const idLine = data.partyBId ? `乙方證件/登記號碼：${data.partyBId}` : "乙方證件/登記號碼：__________";
  const role = data.role || "雙方約定事項";
  const start = data.startDate || "____年__月__日";
  const end = data.endDate || "____年__月__日";
  const pay = data.payment || "按雙方確認的標準結算";
  const location = data.location || "中國境內或雙方另行約定地點";
  const extra = data.extra || "無";
  const laborClause = data.type.includes("Employee") || data.type === "partnerEmployee"
    ? `三、工作內容與管理\n1. 乙方擔任「${role}」，接受甲方依法制定的規章制度與工作安排。\n2. 甲方依法保障乙方休息休假、勞動保護、薪酬支付及社會保險等權益。\n3. 乙方應遵守工作紀律、保密制度、數據與客戶資料管理要求。`
    : `三、合作內容\n1. 乙方就「${role}」與甲方開展合作，按甲方品牌、產品、價格、交付與服務標準執行。\n2. 乙方不得擅自使用甲方商標、素材、客戶資料或超越授權範圍對外承諾。\n3. 雙方應保存訂單、對帳、交付、售後等憑證。`;
  const special = {
    salesEmployee: "銷售提成、退貨扣回、客戶歸屬與業績認定以甲方公布或雙方書面確認的制度為準。",
    wholesalePartner: "乙方作為批發商，應遵守最低銷售價格、渠道秩序、貨品流向與售後規範。",
    dealerPartner: "乙方作為經銷商，應在授權區域/渠道內銷售，不得竄貨、低價傾銷或損害品牌形象。",
    influencerPartner: "乙方作為達人合作方，應確保直播/短視頻內容真實合法，不得虛假宣傳。",
    factoryPartner: "乙方作為工廠合作方，應按約定品質、工期、包裝、檢驗與交付標準完成生產。",
    knitterPartner: "乙方作為織女合作方，應按樣品、工藝、交期及品質標準完成編織交付。",
    partnerEmployee: "合夥收益、分潤、虧損承擔、退出機制與保密義務以本合同及附件約定為準。",
  }[data.type] || "乙方應依誠信原則履約，維護甲方商譽與商業秘密。";

  return `${name}\n\n甲方：${partyA}\n乙方：${partyB}\n${idLine}\n\n重要提示：本合同為業務模板，簽署前應由具備中國法律執業資格的律師依實際交易、用工地與最新法律政策審核。\n\n一、合同期限\n本合同自 ${start} 起至 ${end} 止。期滿需續約的，雙方應另行書面確認。\n\n二、履行地點\n履行地點為：${location}。\n\n${laborClause}\n\n四、報酬與結算\n1. 薪資、服務費、貨款或分潤方式：${pay}。\n2. 涉及發票、稅費、退款、扣款、對帳週期的，按雙方書面確認或甲方制度執行。\n\n五、專項約定\n${special}\n\n六、保密與知識產權\n乙方對在合作或任職期間獲悉的產品資料、客戶資料、價格政策、供應鏈資料、設計圖稿、直播腳本、營運數據負有保密義務。除法律規定或甲方書面同意外，不得披露、複製、轉讓或用於本合同之外目的。\n\n七、違約責任\n任何一方違反本合同，應賠償守約方因此遭受的直接損失；涉及商譽、商業秘密、知識產權或客戶資料的，守約方有權要求停止侵害、消除影響並追究相應責任。\n\n八、解除與終止\n雙方可協商解除。本合同因期滿、目的達成、法定或約定事由終止。員工類合同的解除、終止及經濟補償依《中華人民共和國勞動合同法》等相關法律法規執行。\n\n九、爭議解決\n因本合同產生爭議，雙方應先友好協商；協商不成的，提交甲方所在地有管轄權的人民法院處理，或由雙方另行書面約定仲裁機構。\n\n十、補充條款\n${extra}\n\n甲方（蓋章/簽字）：______________\n乙方（蓋章/簽字）：______________\n簽署日期：____年__月__日`;
}

function generateContract(form) {
  const data = Object.fromEntries(new FormData(form));
  const text = buildContract(data);
  $("#contractPreview").textContent = text;
  downloadContractWord(text, contractNames[data.type] || "合同");
}

function contractWordHtml(text) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>秦時線合同</title>
  <style>
    body { font-family: "Microsoft JhengHei", "SimSun", serif; line-height: 1.8; font-size: 12pt; }
    h1 { text-align: center; font-size: 18pt; }
    pre { white-space: pre-wrap; font-family: "Microsoft JhengHei", "SimSun", serif; }
  </style>
</head>
<body><pre>${escapeHtml(text)}</pre></body>
</html>`;
}

function downloadContractWord(text, title = "合同") {
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, "_");
  const blob = new Blob(["\ufeff", contractWordHtml(text)], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `秦時線_${safeTitle}_${today()}.doc`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function editItem(type, id) {
  if (type === "product") {
    const product = state.products.find((item) => item.id === id);
    setProductTab(product?.type === "sale" ? "saleGoods" : "officeGoods");
    fillForm(product?.type === "sale" ? $("#sellProductForm") : $("#productForm"), product);
    setView("products");
  }
  if (type === "partner") {
    fillForm($("#partnerForm"), state.partners.find((item) => item.id === id));
    setView("partners");
  }
  if (type === "staff") {
    const staff = state.staff.find((item) => item.id === id);
    setStaffTab(staff?.employeeType || "regular");
    fillForm($("#staffForm"), staff);
    setView("staff");
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function reportTable(headers, rows) {
  return `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${
    rows.length
      ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")
      : `<tr><td colspan="${headers.length}" class="empty-cell">尚無資料</td></tr>`
  }</tbody></table>`;
}

function docRows(kind) {
  const docs = kind === "purchase" ? state.purchases : state.sales;
  return docs.map((doc) => {
    const partner = findPartner(doc.partnerId);
    const product = findProduct(doc.productId);
    return [
      doc.no,
      doc.date,
      kind === "purchase" ? `${partner?.factoryType || ""} ${partner?.name || partner?.customerName || ""}`.trim() : `${partner?.partnerType || ""} ${partner?.customerName || partner?.name || ""}`.trim(),
      product?.name || "",
      product?.sku || "",
      product?.yarnNo || "",
      product?.color || "",
      doc.vat || "",
      `${number(doc.qty)} 包`,
      money(doc.price),
      money(Number(doc.qty) * Number(doc.price)),
    ];
  });
}

function reportContent(view) {
  const titles = {
    dashboard: "總覽報表",
    products: productTab === "saleGoods" ? "銷售產品報表" : "一般產品報表",
    partners: "往來單位報表",
    purchases: "進貨報表",
    sales: "銷貨報表",
    inventory: "銷售產品庫存報表",
    tracking: "貨品追蹤報表",
    production: "生產圖報表",
    live: "直播對應報表",
    liveSales: "直播間銷售報表",
    knitters: "織女系統報表",
    shipping: "出貨單報表",
    staff: "人事資料報表",
    leave: "請假申請報表",
    settings: "資料設定報表",
  };
  const saleProducts = state.products.filter((product) => product.type === "sale");
  const officeProducts = state.products.filter((product) => product.type !== "sale");
  const stockValue = saleProducts.reduce((sum, product) => sum + productStock(product.id) * Number(product.cost), 0);
  const lowStocks = saleProducts.filter((product) => productStock(product.id) <= Number(product.minStock));

  if (view === "dashboard") {
    return {
      title: titles[view],
      body: `
        <div class="kpis">
          <div><span>銷售產品庫存成本</span><strong>${money(stockValue)}</strong></div>
          <div><span>本月進貨</span><strong>${money(monthTotal(state.purchases))}</strong></div>
          <div><span>本月銷貨</span><strong>${money(monthTotal(state.sales))}</strong></div>
          <div><span>低庫存銷售產品</span><strong>${lowStocks.length}</strong></div>
        </div>
        ${reportTable(["銷售產品", "現有庫存", "安全量", "狀態"], lowStocks.map((product) => [product.name, `${number(productStock(product.id))} 包`, number(product.minStock), productStock(product.id) <= 0 ? "缺貨" : "補貨"]))}
      `,
    };
  }

  if (view === "products") {
    const rows = productTab === "saleGoods" ? saleProducts : officeProducts;
    return {
      title: titles[view],
      body: productTab === "saleGoods"
        ? reportTable(["編號", "品名", "紗號", "支數", "成分", "色號", "缸號", "工廠生產重量", "產品數量", "單包團數", "產品包數", "售價"], rows.map((p) => [p.sku, p.name, p.yarnNo, p.count, p.composition, p.color, p.vat, `${number(p.factoryWeight)} KG`, `${number(p.productQty)} 團`, `${number(p.packSize)} 團`, `${number(p.packageCount)} 包`, money(p.price)]))
        : reportTable(["品號", "品名", "分類", "單位", "進價", "售價", "安全庫存"], rows.map((p) => [p.sku, p.name, p.category, p.unit, money(p.cost), money(p.price), number(p.minStock)])),
    };
  }

  const reports = {
    partners: () => reportTable(["工廠類別", "合作商類別", "客戶名稱", "公司名稱", "聯絡人", "電話", "E-MAIL", "會計師", "老闆", "國籍"], state.partners.map((p) => [p.factoryType, p.partnerType, p.customerName, p.name, p.contact, p.phone, p.email, p.accountant, p.owner, p.nationality])),
    purchases: () => reportTable(["單號", "日期", "工廠單位", "銷售產品", "產品編號", "紗號", "色號", "缸號", "包數", "單包進價", "金額"], docRows("purchase")),
    sales: () => reportTable(["單號", "日期", "國內合作商", "銷售產品", "產品編號", "紗號", "色號", "缸號", "包數", "單包售價", "金額"], docRows("sale")),
    inventory: () => reportTable(["編號", "銷售產品", "紗號", "色號", "現有庫存", "安全量", "庫存成本"], saleProducts.map((p) => [p.sku, p.name, p.yarnNo, p.color, `${number(productStock(p.id))} 包`, number(p.minStock), money(productStock(p.id) * Number(p.cost))])),
    tracking: () => reportTable(["追蹤編號", "品名", "紗號", "色號", "缸號", "數量", "進度", "預計完成", "備註"], (state.yarnTracks || []).map((p) => [p.code, p.name, p.yarnNo, p.color, p.vat, `${number(p.qty)} ${p.unit || ""}`, p.status, p.dueDate, p.note])),
    production: () => reportTable(["追蹤編號", "品名", "目前進度", "預計完成", "剩餘天數", "風險"], (state.yarnTracks || []).map((p) => [p.code, p.name, p.status, p.dueDate, daysLeft(p.dueDate) === "" ? "" : `${daysLeft(p.dueDate)} 天`, p.status === "已完成" ? "完成" : daysLeft(p.dueDate) < 0 ? "逾期" : "正常"])),
    live: () => reportTable(["場次", "日期", "時段", "主播", "主推品", "紗號", "目標GMV", "狀態"], (state.liveShows || []).map((p) => [p.code, p.date, p.time, p.host, p.productName, p.yarnNo, money(p.targetGmv), p.status])),
    liveSales: () => reportTable(["日期", "直播間", "主播", "營收", "退款", "淨營收", "備註"], (state.liveSales || []).map((p) => [p.date, p.room, p.host, money(p.revenue), money(p.refund), money(liveNet(p)), p.note])),
    knitters: () => reportTable(["類型", "日期", "姓名/織女", "款式", "狀態", "單價/金額"], [
      ...(state.knitters || []).map((p) => ["織女資料", p.contractDate, p.name, (p.styles || []).join("、"), p.tutorialAvailable, (p.styles || []).map((style) => `${style} ${money(p.prices?.[style] || 0)}`).join("、")]),
      ...(state.samples || []).map((p) => ["樣衣&配件", p.receivedDate, knitterName(p.knitterId), p.style, p.status, money(p.price)]),
    ]),
    shipping: () => reportTable(["單號", "日期", "國內合作商", "產品編號", "銷售產品", "缸號", "出貨包數", "單包價格", "小計", "狀態"], (state.shipments || []).map((p) => { const product = findProduct(p.productId); const partner = findPartner(p.partnerId); return [p.no, p.date, partner?.customerName || partner?.name || p.customer, product?.sku, product?.name || p.productName, p.vat, `${number(p.qty)} 包`, money(p.price), money(Number(p.qty) * Number(p.price)), p.status]; })),
    staff: () => reportTable(["編號", "姓名", "部門", "職位", "角色", "電話", "狀態"], (state.staff || []).map((p) => [p.code, p.name, p.dept, p.title, p.role, p.phone, p.status])),
    leave: () => reportTable(["編號", "姓名", "類型", "開始日期", "結束日期", "天數", "狀態", "審批人"], (state.leaveRequests || []).map((p) => [p.code, p.name, p.type, p.startDate, p.endDate, p.days, p.status, p.approver])),
    settings: () => reportTable(["職位名稱"], (state.settings?.positions || []).map((name) => [name])),
  };

  return { title: titles[view] || "報表", body: reports[view]?.() || "<p>尚無報表資料</p>" };
}

function openReport(view = activeView) {
  const report = reportContent(view);
  const generatedAt = new Date().toLocaleString("zh-TW");
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) return toast("瀏覽器封鎖了報表視窗，請允許彈出視窗");
  reportWindow.document.write(`<!doctype html>
    <html lang="zh-Hant">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>秦時線 · ${escapeHtml(report.title)}</title>
        <style>
          body { margin: 0; padding: 28px; color: #211d19; background: #f8f3e9; font-family: "Microsoft JhengHei", "Noto Sans TC", sans-serif; }
          header { display: flex; justify-content: space-between; gap: 18px; align-items: start; border-bottom: 2px solid #9f2f24; padding-bottom: 16px; margin-bottom: 22px; }
          h1 { margin: 0 0 6px; font-family: "DFKai-SB", "KaiTi", serif; }
          .meta { color: #766f62; font-size: 13px; }
          button { height: 38px; border: 0; border-radius: 6px; padding: 0 14px; color: white; background: #9f2f24; font-weight: 700; cursor: pointer; }
          table { width: 100%; border-collapse: collapse; background: white; }
          th, td { border: 1px solid #ddd2bf; padding: 9px 10px; text-align: left; font-size: 13px; }
          th { background: #efe4d2; }
          .empty-cell { text-align: center; color: #766f62; }
          .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
          .kpis div { background: white; border: 1px solid #ddd2bf; padding: 14px; }
          .kpis span { display: block; color: #766f62; font-size: 12px; margin-bottom: 8px; }
          .kpis strong { font-size: 22px; color: #5e2119; }
          @media print { body { background: white; padding: 0; } button { display: none; } header { margin-top: 0; } }
        </style>
      </head>
      <body>
        <header>
          <div>
            <h1>秦時線 · ${escapeHtml(report.title)}</h1>
            <div class="meta">製表時間：${escapeHtml(generatedAt)}</div>
          </div>
          <button onclick="window.print()">列印</button>
        </header>
        ${report.body}
      </body>
    </html>`);
  reportWindow.document.close();
}

function convertText(text, map) {
  return Object.keys(map)
    .sort((a, b) => b.length - a.length)
    .reduce((next, key) => next.replaceAll(key, map[key]), text);
}

function applyLanguage() {
  const map = currentLang === "zh-CN" ? zhMap : zhReverseMap;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ["SCRIPT", "STYLE", "INPUT", "TEXTAREA", "OPTION"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    node.nodeValue = convertText(node.nodeValue, map);
  });
  $$("input[placeholder]").forEach((input) => {
    input.placeholder = convertText(input.placeholder, map);
  });
  $("#langBtn span").textContent = currentLang === "zh-CN" ? "繁體" : "简体";
}

function toggleLanguage() {
  currentLang = currentLang === "zh-TW" ? "zh-CN" : "zh-TW";
  document.documentElement.lang = currentLang === "zh-CN" ? "zh-Hans" : "zh-Hant";
  applyLanguage();
}

function seedData() {
  state = {
    products: [
      { id: "prd-yunjin", type: "sale", sku: "MIT-2605-001", yarnNo: "YJ-26S", count: "2/26NM", composition: "100% 羊絨", name: "雲錦羊絨", color: "米杏 103", vat: "A260501", factoryWeight: 120, productQty: 600, packSize: 5, packageCount: 120, initialQty: 120, unit: "包", cost: 1200, price: 1880, minStock: 10, note: "高單價主推" },
      { id: "prd-qingyu", type: "sale", sku: "MIT-2605-002", yarnNo: "QY-18S", count: "18S/2", composition: "棉麻混紡", name: "青玉棉麻", color: "青玉 207", vat: "B260422", factoryWeight: 85, productQty: 425, packSize: 5, packageCount: 85, initialQty: 85, unit: "包", cost: 520, price: 860, minStock: 8, note: "夏季直播款" },
      { id: "prd-moxue", type: "sale", sku: "MIT-2605-003", yarnNo: "MX-28S", count: "2/28NM", composition: "美麗諾羊毛", name: "墨雪美麗諾", color: "墨灰 802", vat: "D260401", factoryWeight: 160, productQty: 800, packSize: 5, packageCount: 160, initialQty: 160, unit: "包", cost: 760, price: 1280, minStock: 12, note: "可排直播" },
      { id: "prd-a4", type: "office", sku: "P-001", name: "A4 影印紙", category: "辦公用品", unit: "箱", cost: 680, price: 880, minStock: 12 },
      { id: "prd-toner", type: "office", sku: "P-002", name: "雷射碳粉匣", category: "耗材", unit: "支", cost: 1150, price: 1680, minStock: 8 },
      { id: "prd-chair", type: "office", sku: "P-003", name: "人體工學椅", category: "設備", unit: "張", cost: 2800, price: 4200, minStock: 3 },
    ],
    partners: [
      { id: "par-s1", type: "supplier", factoryType: "原料廠", partnerType: "", customerName: "", name: "雲州原料廠", contact: "林先生", phone: "02-2345-6789", email: "raw@example.com", accountant: "何會計", owner: "林老闆", nationality: "台灣", address: "台北市中正區" },
      { id: "par-s2", type: "supplier", factoryType: "染廠", partnerType: "", customerName: "", name: "青墨染廠", contact: "陳小姐", phone: "03-555-8899", email: "dye@example.com", accountant: "周會計", owner: "陳老闆", nationality: "台灣", address: "新竹市東區" },
      { id: "par-s3", type: "supplier", factoryType: "倒筒廠", partnerType: "", customerName: "", name: "順線倒筒廠", contact: "許先生", phone: "04-2233-8899", email: "cone@example.com", accountant: "許會計", owner: "許老闆", nationality: "台灣", address: "台中市北區" },
      { id: "par-s4", type: "supplier", factoryType: "打團廠", partnerType: "", customerName: "", name: "圓滿打團廠", contact: "吳小姐", phone: "06-2211-7788", email: "ball@example.com", accountant: "吳會計", owner: "吳老闆", nationality: "台灣", address: "台南市安平區" },
      { id: "par-c1", type: "customer", factoryType: "", partnerType: "批發商", customerName: "宏遠科技", name: "宏遠批發合作", contact: "張主任", phone: "02-8765-4321", email: "hongyuan@example.com", accountant: "張會計", owner: "張老闆", nationality: "台灣", address: "新北市板橋區" },
      { id: "par-c2", type: "customer", factoryType: "", partnerType: "經銷商", customerName: "星禾設計", name: "星禾經銷合作", contact: "黃小姐", phone: "04-2222-1234", email: "star@example.com", accountant: "黃會計", owner: "黃老闆", nationality: "台灣", address: "台中市西區" },
      { id: "par-c3", type: "customer", factoryType: "", partnerType: "達人", customerName: "秋線手作", name: "秋線達人合作", contact: "周逸秋", phone: "09-1111-2222", email: "maker@example.com", accountant: "陳會計", owner: "周老師", nationality: "台灣", address: "台北市大同區" },
      { id: "par-c4", type: "customer", factoryType: "", partnerType: "分店", customerName: "秦時線台中店", name: "台中分店", contact: "江紫薇", phone: "04-3333-6666", email: "branch@example.com", accountant: "江會計", owner: "王昱傑", nationality: "台灣", address: "台中市南屯區" },
    ],
    purchases: [
      { id: "pur-1", no: "PO-20260502-001", partnerId: "par-s1", productId: "prd-yunjin", vat: "A260501", qty: 30, price: 1200, date: today(), createdAt: Date.now() - 50000 },
      { id: "pur-2", no: "PO-20260502-002", partnerId: "par-s2", productId: "prd-qingyu", vat: "B260422", qty: 10, price: 520, date: today(), createdAt: Date.now() - 40000 },
      { id: "pur-3", no: "PO-20260502-003", partnerId: "par-s3", productId: "prd-moxue", vat: "D260401", qty: 5, price: 760, date: today(), createdAt: Date.now() - 30000 },
    ],
    sales: [
      { id: "sal-1", no: "SO-20260502-001", partnerId: "par-c1", productId: "prd-moxue", vat: "D260401", qty: 16, price: 1280, date: today(), createdAt: Date.now() - 20000 },
      { id: "sal-2", no: "SO-20260502-002", partnerId: "par-c2", productId: "prd-qingyu", vat: "B260422", qty: 4, price: 860, date: today(), createdAt: Date.now() - 10000 },
    ],
    yarnTracks: [
      { id: "trk-1", code: "QSX-001", yarnNo: "YJ-26S", count: "2/26NM", composition: "100% 羊絨", name: "雲錦羊絨", color: "米杏 103", vat: "A260501", qty: 120, unit: "KG", status: "胚紗生產中", dueDate: "2026-05-10", note: "高單價主推", createdAt: Date.now() - 90000 },
      { id: "trk-2", code: "QSX-002", yarnNo: "QY-18S", count: "18S/2", composition: "棉麻混紡", name: "青玉棉麻", color: "青玉 207", vat: "B260422", qty: 85, unit: "KG", status: "染色中", dueDate: "2026-05-07", note: "夏季直播款", createdAt: Date.now() - 85000 },
      { id: "trk-3", code: "QSX-003", yarnNo: "ZS-32S", count: "3/32NM", composition: "70% 羊毛 30% 尼龍", name: "朱砂暖羊毛", color: "朱砂 601", vat: "C260418", qty: 210, unit: "LBS", status: "打包中", dueDate: "2026-05-05", note: "需拍色卡", createdAt: Date.now() - 80000 },
      { id: "trk-4", code: "QSX-004", yarnNo: "MX-28S", count: "2/28NM", composition: "美麗諾羊毛", name: "墨雪美麗諾", color: "墨灰 802", vat: "D260401", qty: 160, unit: "KG", status: "已完成", dueDate: "2026-05-01", note: "可排直播", createdAt: Date.now() - 75000 },
      { id: "trk-5", code: "QSX-005", yarnNo: "CY-24S", count: "24S/2", composition: "羊駝混紡", name: "長雲羊駝", color: "駝色 311", vat: "E260425", qty: 72, unit: "KG", status: "染色中", dueDate: "2026-05-08", note: "注意色差", createdAt: Date.now() - 70000 },
      { id: "trk-6", code: "QSX-006", yarnNo: "XH-16S", count: "16S/3", composition: "羊毛腈綸", name: "星河粗紡", color: "夜藍 905", vat: "F260429", qty: 98, unit: "LBS", status: "胚紗生產中", dueDate: "2026-05-12", note: "秋冬備貨", createdAt: Date.now() - 65000 },
    ],
    liveShows: [
      { id: "live-1", code: "LIVE-001", date: "2026-05-03", time: "20:00-22:00", host: "周逸秋", productName: "墨雪美麗諾", yarnNo: "MX-28S", color: "墨灰 802", batch: "D260401", targetGmv: 30000, status: "準備中", note: "主打成衣質感", createdAt: Date.now() - 60000 },
      { id: "live-2", code: "LIVE-002", date: "2026-05-05", time: "19:30-21:30", host: "周逸秋", productName: "青玉棉麻", yarnNo: "QY-18S", color: "青玉 207", batch: "B260422", targetGmv: 25000, status: "未開始", note: "夏季鉤織場", createdAt: Date.now() - 55000 },
      { id: "live-3", code: "LIVE-003", date: "2026-05-07", time: "20:30-22:30", host: "周逸秋", productName: "雲錦羊絨", yarnNo: "YJ-26S", color: "米杏 103", batch: "A260501", targetGmv: 45000, status: "未開始", note: "高客單專場", createdAt: Date.now() - 50000 },
    ],
    liveSales: [
      { id: "livesale-1", liveId: "live-1", date: today(), room: "小紅書", host: "周逸秋", revenue: 7680, refund: 860, netRevenue: 6820, note: "主推色直播", createdAt: Date.now() - 48000 },
    ],
    knitters: [
      { id: "knitter-1", contractDate: "2026-05-02", name: "蘇雲娘", styles: ["無袖", "背心"], prices: { "無袖": 1200, "背心": 980 }, leadTime: 14, tutorialAvailable: "可", settlementDate: "2026-05-31", createdAt: Date.now() - 47000 },
    ],
    samples: [
      { id: "sample-1", knitterId: "knitter-1", receivedDate: today(), imageData: "", status: "已到貨", style: "背心", hasTutorial: "是", price: 980, settled: "未支付", createdAt: Date.now() - 46000 },
    ],
    announcements: [
      { id: "ann-1", title: "秦時線 OA 上線", content: "請各部門每日更新進貨、銷貨、直播與出貨資料。", author: "管理者", createdAt: Date.now() - 60000 },
    ],
    shipments: [
      { id: "ship-1", no: "QSX-SHIP-001", partnerId: "par-c1", productId: "prd-moxue", vat: "D260401", customer: "宏遠科技", phone: "", date: "2026-05-02", address: "", productName: "墨雪美麗諾", qty: 10, price: 1280, status: "草稿", createdAt: Date.now() - 45000 },
    ],
    staff: [
      { id: "stf-1", code: "P001", name: "王昱傑", dept: "總經辦", title: "負責人", role: "老闆", phone: "", joinDate: "2026-01-01", status: "在職", note: "", createdAt: Date.now() - 40000 },
      { id: "stf-2", code: "P002", name: "周逸秋", dept: "直播營運部", title: "主管", role: "主管", phone: "", joinDate: "2026-01-01", status: "在職", note: "", createdAt: Date.now() - 35000 },
      { id: "stf-3", code: "P003", name: "李軒", dept: "執行部", title: "執行負責", role: "管理員", phone: "", joinDate: "2026-01-01", status: "在職", note: "", createdAt: Date.now() - 30000 },
      { id: "stf-4", code: "P004", name: "江紫薇", dept: "品牌部", title: "品牌助理", role: "員工", phone: "", joinDate: "2026-01-01", status: "在職", note: "", createdAt: Date.now() - 25000 },
    ],
    leaveRequests: [
      { id: "lev-1", code: "L001", name: "江紫薇", type: "事假", startDate: "2026-05-02", endDate: "2026-05-02", days: 1, reason: "私事", status: "待審批", approver: "周逸秋", comment: "", createdAt: Date.now() - 20000 },
      { id: "lev-2", code: "L002", name: "李軒", type: "外出", startDate: "2026-05-01", endDate: "2026-05-01", days: 0.5, reason: "採買直播道具", status: "已通過", approver: "王昱傑", comment: "", createdAt: Date.now() - 15000 },
    ],
    settings: {
      positions: ["負責人", "主管", "執行負責", "品牌助理"],
    },
  };
  saveState();
  toast("範例資料已載入");
  renderAll();
}

function bindEvents() {
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $$("[data-action='goto']").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $$("[data-product-tab]").forEach((button) => button.addEventListener("click", () => setProductTab(button.dataset.productTab)));
  $$("[data-knitter-tab]").forEach((button) => button.addEventListener("click", () => setKnitterTab(button.dataset.knitterTab)));
  $$("[data-setting-tab]").forEach((button) => button.addEventListener("click", () => setSettingTab(button.dataset.settingTab)));
  $$("[data-staff-tab]").forEach((button) => button.addEventListener("click", () => setStaffTab(button.dataset.staffTab)));
  $$("[data-auth-tab]").forEach((button) => button.addEventListener("click", () => setAuthTab(button.dataset.authTab)));
  $("#quickSaleBtn").addEventListener("click", () => setView("sales"));
  $("#reportBtn").addEventListener("click", () => openReport(activeView));
  $("#langBtn").addEventListener("click", toggleLanguage);
  $("#logoutBtn").addEventListener("click", logoutUser);
  $("#loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    loginUser(event.currentTarget);
  });
  $("#registerForm").addEventListener("submit", (event) => {
    event.preventDefault();
    registerUser(event.currentTarget);
  });
  $("#announcementForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addAnnouncement(event.currentTarget);
  });
  $("#sellProductForm").elements.productQty.addEventListener("input", updatePackageCount);
  $("#sellProductForm").elements.packSize.addEventListener("input", updatePackageCount);
  $("#productImageInput").addEventListener("change", handleProductImage);
  $("#sampleImageInput").addEventListener("change", (event) => handleImageUpload(event, "sampleForm", "sampleImagePreview"));
  $("#liveSaleRevenue").addEventListener("input", updateLiveSaleNet);
  $("#liveSaleRefund").addEventListener("input", updateLiveSaleNet);
  $("#globalSearch").addEventListener("input", (event) => {
    searchTerm = event.target.value.trim();
    renderAll();
  });
  $("#seedBtn").addEventListener("click", seedData);
  $("#resetBtn").addEventListener("click", () => {
    if (!confirm("確定清空所有資料？")) return;
    state = defaultState();
    saveState();
    renderAll();
    toast("資料已清空");
  });

  $("#productForm").addEventListener("submit", (event) => {
    event.preventDefault();
    upsertProduct(event.currentTarget);
  });
  $("#sellProductForm").addEventListener("submit", (event) => {
    event.preventDefault();
    upsertSellProduct(event.currentTarget);
  });
  $("#partnerForm").addEventListener("submit", (event) => {
    event.preventDefault();
    upsertPartner(event.currentTarget);
  });
  $("#purchaseForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addDoc(event.currentTarget, "purchase");
  });
  $("#saleForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addDoc(event.currentTarget, "sale");
  });
  $("#trackingForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addGeneric(event.currentTarget, "yarnTracks", "trk", (data) => ({ ...data, qty: Number(data.qty) }));
  });
  $("#liveForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addGeneric(event.currentTarget, "liveShows", "live", (data) => ({ ...data, targetGmv: Number(data.targetGmv || 0) }));
  });
  $("#shipmentForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addGeneric(event.currentTarget, "shipments", "ship", (data) => ({ ...data, qty: Number(data.qty), price: Number(data.price || 0), status: "待出貨" }));
  });
  $("#liveSaleForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addLiveSale(event.currentTarget);
  });
  $("#knitterForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addKnitter(event.currentTarget);
  });
  $("#sampleForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addSample(event.currentTarget);
  });
  $("#staffForm").addEventListener("submit", (event) => {
    event.preventDefault();
    upsertStaff(event.currentTarget);
  });
  $("#contractForm").addEventListener("submit", (event) => {
    event.preventDefault();
    generateContract(event.currentTarget);
  });
  $("#copyContractBtn").addEventListener("click", async () => {
    const text = $("#contractPreview").textContent;
    try {
      await navigator.clipboard.writeText(text);
      toast("合同內容已複製");
    } catch {
      toast("瀏覽器不允許複製，請手動選取預覽文字");
    }
  });
  $("#downloadContractBtn").addEventListener("click", () => {
    const text = $("#contractPreview").textContent;
    if (!text || text.includes("請先填寫")) return toast("請先生成合同");
    const type = $("#contractType").value;
    downloadContractWord(text, contractNames[type] || "合同");
  });
  $("#positionForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addPosition(event.currentTarget);
  });
  $("#leaveForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addGeneric(event.currentTarget, "leaveRequests", "lev", (data) => ({ ...data, days: Number(data.days) }));
  });

  document.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit]");
    const del = event.target.closest("[data-delete]");
    if (edit) editItem(edit.dataset.edit, edit.dataset.id);
    if (del) deleteItem(del.dataset.delete, del.dataset.id);
  });
  document.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-permission-user]");
    if (!checkbox) return;
    const user = state.settings.users.find((item) => item.id === checkbox.dataset.permissionUser);
    if (!user || user.role === "admin") return;
    const set = new Set(user.permissions || []);
    checkbox.checked ? set.add(checkbox.value) : set.delete(checkbox.value);
    user.permissions = [...set];
    saveState();
    toast("權限已更新");
    loadSession();
    applyPermissions();
  });

  $("#purchaseProduct").addEventListener("change", (event) => {
    updateDocProduct("purchaseForm", "purchaseProductCard", "cost");
    const product = findProduct(event.target.value);
    if (product) $("#purchaseVat").value = product.vat || "";
  });
  $("#saleProduct").addEventListener("change", (event) => {
    updateDocProduct("saleForm", "saleProductCard", "price");
    vatOptions($("#saleVat"), event.target.value);
  });
  $("#shipmentProduct").addEventListener("change", (event) => {
    updateDocProduct("shipmentForm", "shipmentProductCard", "price");
    vatOptions($("#shipmentVat"), event.target.value);
  });
  $("#liveSaleShow").addEventListener("change", (event) => {
    const show = (state.liveShows || []).find((item) => item.id === event.target.value);
    if (!show) return;
    const form = $("#liveSaleForm");
    form.elements.date.value = show.date || today();
    form.elements.host.value = show.host || "";
  });
}

async function init() {
  await loadCloudState();
  migrateSaleProductSkus();
  loadSession();
  bindEvents();
  resetForm($("#sellProductForm"));
  resetForm($("#purchaseForm"));
  resetForm($("#saleForm"));
  resetForm($("#trackingForm"));
  resetForm($("#liveForm"));
  resetForm($("#shipmentForm"));
  resetForm($("#liveSaleForm"));
  resetForm($("#knitterForm"));
  resetForm($("#sampleForm"));
  resetForm($("#staffForm"));
  resetForm($("#leaveForm"));
  renderAll();
  setView(activeView);
  applyPermissions();
}

init();
