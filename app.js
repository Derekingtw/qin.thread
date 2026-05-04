const STORAGE_KEY = "oa_inventory_state_v1";
const SESSION_KEY = "oa_inventory_session_v1";
const ALL_VIEWS = ["dashboard", "products", "partners", "inventory", "purchases", "sales", "shipping", "invoices", "tracking", "production", "contracts", "liveSales", "live", "knitters", "staff", "leave", "approvals", "payroll", "intl", "growth", "settings"];
const ERP_VIEWS = ["products", "partners", "inventory", "purchases", "sales", "shipping", "invoices", "tracking", "production", "contracts"];
const ERP_TAB_LABELS = { products: "商品", partners: "往來單位", inventory: "庫存", purchases: "進貨", sales: "銷貨", shipping: "出貨單", invoices: "發票上傳", tracking: "貨品追蹤", production: "生產圖", contracts: "合同" };
const LIVE_SYSTEM_VIEWS = ["live", "liveSales"];
const VIEW_LABELS = { dashboard: "總覽", knitters: "織女系統", staff: "人事資料", leave: "請假申請", approvals: "審批系統", payroll: "會計系統", intl: "國貿系統", growth: "養成系統", settings: "資料設定" };

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const today = () => new Date().toISOString().slice(0, 10);
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const money = (value) => Number(value || 0).toLocaleString("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 });
const number = (value) => Number(value || 0).toLocaleString("zh-TW");
const ceilNumber = (value) => Math.ceil(Number(value || 0));
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_INVOICE_FILE_BYTES = 8 * 1024 * 1024;
const MAX_BACKGROUND_BYTES = 2 * 1024 * 1024;
const normalizePhone = (value) => String(value || "").replace(/[^\d+]/g, "").trim();
const phoneDigits = (value) => normalizePhone(value).replace(/\D/g, "");
const staffRoleAliases = {
  管理者: "管理員",
  老闆: "管理員",
  管理員: "管理員",
  主管: "代理管理員",
  員工: "普通人員",
};
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
  invoiceUploads: [],
  yarnTracks: [],
  liveShows: [],
  liveSales: [],
  knitters: [],
  samples: [],
  yarnShipments: [],
  shipments: [],
  staff: [],
  leaveRequests: [],
  tripRequests: [],
  purchaseRequests: [],
  proposalRequests: [],
  adminPayrolls: [],
  livePayrolls: [],
  partnerBonuses: [],
  tradeDocs: [],
  growthRecords: [],
  announcements: [],
  settings: {
    positions: ["負責人", "主管", "執行負責", "品牌助理"],
    users: [],
    growthLevelNames: {},
    appearance: {
      backgroundColor: "#fffaf0",
      backgroundImage: "",
      backgroundImageName: "",
      backgroundImageSize: 0,
      backgroundImageWidth: 0,
      backgroundImageHeight: 0,
    },
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
let approvalTab = "overview";
let payrollTab = "admin";
let intlTab = "setup";
let tradeLineDrafts = [];
let yarnShipmentLineDrafts = [];
let activeTradeDocId = "";
let editingStaffId = "";
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
      (value.invoiceUploads || []).length ||
      (value.liveSales || []).length ||
      (value.knitters || []).length ||
      (value.samples || []).length ||
      (value.tradeDocs || []).length ||
      (value.growthRecords || []).length
    )
  );
}

function normalizeState(saved) {
  const next = { ...defaultState(), ...(saved || {}) };
  next.settings = {
    ...defaultState().settings,
    ...(saved?.settings || {}),
  };
  next.settings.appearance = {
    ...defaultState().settings.appearance,
    ...(saved?.settings?.appearance || {}),
  };
  next.meta = {
    updatedAt: Number(saved?.meta?.updatedAt || 0),
  };
  next.settings.users = (next.settings.users || []).map((user) => ({
    ...user,
    phone: normalizePhone(user.phone || user.username || ""),
    username: normalizePhone(user.phone || user.username || ""),
    systemRole: user.systemRole || (user.role === "admin" ? "管理員" : "普通人員"),
  }));
  next.settings.positions = [...new Set(["待補資料", ...(next.settings.positions || []), ...((next.staff || []).map((item) => item.title).filter(Boolean))])];
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
  next.invoiceUploads = (next.invoiceUploads || []).map((item) => ({
    ...item,
    totalAmount: Number(item.totalAmount || 0),
    taxAmount: Number(item.taxAmount || 0),
    totalWithTax: Number(item.totalWithTax || 0),
    fileData: item.fileData || "",
    fileName: item.fileName || "",
    fileType: item.fileType || "",
    lines: Array.isArray(item.lines) ? item.lines.map((line) => ({
      itemName: line.itemName || "",
      spec: line.spec || "",
      unit: line.unit || "",
      qty: Number(line.qty || 0),
      unitPrice: Number(line.unitPrice || 0),
      amount: Number(line.amount || 0),
      taxRate: line.taxRate || "",
      taxAmount: Number(line.taxAmount || 0),
    })) : [],
  }));
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
    studioName: item.studioName || "",
    identityCode: item.identityCode || "",
    contactPhone: item.contactPhone || "",
    wechat: item.wechat || "",
    qq: item.qq || "",
    contactAddress: item.contactAddress || "",
  }));
  next.samples = (next.samples || []).map((item) => ({
    ...item,
    price: Number(item.price || 0),
    leadDays: Number(item.leadDays || findKnitterIn(next, item.knitterId)?.leadTime || 0),
    sendDate: item.sendDate || "",
    imageData: item.imageData || "",
  }));
  next.yarnShipments = (next.yarnShipments || []).map((item) => ({
    ...item,
    lines: Array.isArray(item.lines) ? item.lines.map((line) => ({
      yarnNo: line.yarnNo || "",
      name: line.name || "",
      color: line.color || "",
      qty: Number(line.qty || 0),
      unit: line.unit || "KG",
    })) : [],
    imageData: item.imageData || "",
  }));
  next.leaveRequests = (next.leaveRequests || []).map((item) => ({
    ...item,
    staffId: item.staffId || findStaffIdByName(next, item.name),
    approverId: item.approverId || findApproverIdByName(next, item.approver),
    status: item.status || "待審批",
  }));
  next.tripRequests = (next.tripRequests || []).map((item) => ({ ...item, amount: Number(item.amount || 0), status: item.status || "待審批" }));
  next.purchaseRequests = (next.purchaseRequests || []).map((item) => ({ ...item, qty: Number(item.qty || 1), amount: Number(item.amount || 0), status: item.status || "待審批" }));
  next.proposalRequests = (next.proposalRequests || []).map((item) => ({ ...item, status: item.status || "待審批" }));
  next.staff = (next.staff || []).map((item) => ({ ...item, gender: item.gender || "女", role: normalizeStaffRole(item.role), avatarData: item.avatarData || "" }));
  const staffIds = new Set((next.staff || []).map((item) => item.id).filter(Boolean));
  if (staffIds.size) {
    next.settings.users = (next.settings.users || []).filter((user) => !user.staffId || staffIds.has(user.staffId));
  }
  next.adminPayrolls = (next.adminPayrolls || []).map((item) => ({ ...item, ...payrollNumbers(item) }));
  next.livePayrolls = (next.livePayrolls || []).map((item) => ({ ...item, ...payrollNumbers(item), commission: Number(item.commission || 0), netRevenue: Number(item.netRevenue || 0) }));
  next.partnerBonuses = (next.partnerBonuses || []).map((item) => ({ ...item, netProfit: Number(item.netProfit || 0), bonusRate: Number(item.bonusRate || 0), bonusAmount: Number(item.bonusAmount || 0) }));
  next.tradeDocs = (next.tradeDocs || []).map((doc) => ({
    ...doc,
    no: normalizeTradeNo(doc.no),
    lines: (doc.lines || []).map((line) => ({
      ...line,
      nw: Number(line.nw || 0),
      gw: Number(line.gw || 0),
      unitPrice: Number(line.unitPrice || 0),
      packages: Number(line.packages || 0),
    })),
  }));
  next.growthRecords = (next.growthRecords || []).map((record) => ({
    ...record,
    xp: Number(record.xp || 0),
  }));
  return next;
}

function findStaffIdByName(saved, name) {
  return (saved?.staff || []).find((item) => item.name === name)?.id || "";
}

function findApproverIdByName(saved, name) {
  return (saved?.staff || []).find((item) => item.name === name || item.title === name || item.role === name)?.id || "";
}

function findProductIn(saved, id) {
  return (saved?.products || []).find((item) => item.id === id);
}

function findKnitterIn(saved, id) {
  return (saved?.knitters || []).find((item) => item.id === id);
}

function normalizeStaffRole(role) {
  return staffRoleAliases[role] || role || "普通人員";
}

function permissionsForStaffRole(role) {
  const normalized = normalizeStaffRole(role);
  if (normalized === "管理員") return [...ALL_VIEWS];
  if (normalized === "代理管理員") return ALL_VIEWS.filter((view) => view !== "settings");
  if (normalized === "核心人員") {
    return ["dashboard", "products", "partners", "inventory", "purchases", "sales", "shipping", "invoices", "liveSales", "live", "knitters", "staff", "leave", "approvals", "payroll", "intl", "tracking", "production", "growth"];
  }
  return ["dashboard", "products", "inventory", "sales", "invoices", "liveSales", "leave", "growth"];
}

function navViewFor(view) {
  if (ERP_VIEWS.includes(view)) return "products";
  if (LIVE_SYSTEM_VIEWS.includes(view)) return "live";
  return view;
}

function accountRoleForStaffRole(role) {
  return normalizeStaffRole(role) === "管理員" ? "admin" : "user";
}

function generateStaffCode() {
  const maxSeq = (state.staff || [])
    .map((item) => Number(String(item.code || "").replace(/\D/g, "")))
    .filter(Number.isFinite)
    .reduce((max, seq) => Math.max(max, seq), 0);
  return `P${String(maxSeq + 1).padStart(3, "0")}`;
}

function ensureStaffForUser(user) {
  const phone = normalizePhone(user.phone || user.username);
  const name = String(user.name || "").trim();
  let staff = (state.staff || []).find((item) => normalizePhone(item.phone) === phone && phone);
  if (!staff && name) {
    staff = (state.staff || []).find((item) => item.name === name && !normalizePhone(item.phone));
  }
  if (staff) {
    staff.name = staff.name || name;
    staff.phone = staff.phone || phone;
    return staff.id;
  }
  const nextStaff = {
    id: uid("stf"),
    code: generateStaffCode(),
    name,
    gender: "",
    dept: "待補資料",
    title: "待補資料",
    role: user.systemRole || (user.role === "admin" ? "管理員" : "普通人員"),
    phone,
    joinDate: today(),
    status: "在職",
    employeeType: "regular",
    regularNote: "註冊自動建立，待人工補齊資料",
    note: "",
  };
  state.staff = [...(state.staff || []), nextStaff];
  return nextStaff.id;
}

function syncUserAccountFromStaff(staff, previousPhone = "", password = "") {
  const phone = normalizePhone(staff.phone);
  if (!phone) return;
  const oldPhone = normalizePhone(previousPhone);
  let linkedFound = false;
  state.settings.users = (state.settings.users || []).map((user) => {
    const accountPhone = normalizePhone(user.phone || user.username);
    const linked = user.staffId === staff.id || accountPhone === phone || (oldPhone && accountPhone === oldPhone);
    linkedFound = linkedFound || linked;
    if (!linked) return user;
    return {
      ...user,
      name: staff.name || user.name,
      phone,
      username: phone,
      password: password || user.password,
      staffId: staff.id,
      systemRole: normalizeStaffRole(staff.role),
      role: accountRoleForStaffRole(staff.role),
      permissions: permissionsForStaffRole(staff.role),
    };
  });
  if (!linkedFound && password) {
    state.settings.users.push({
      id: uid("usr"),
      name: staff.name,
      username: phone,
      phone,
      password,
      staffId: staff.id,
      systemRole: normalizeStaffRole(staff.role),
      role: accountRoleForStaffRole(staff.role),
      permissions: permissionsForStaffRole(staff.role),
    });
  }
  if (currentUser?.staffId === staff.id || (oldPhone && normalizePhone(currentUser?.phone || currentUser?.username) === oldPhone)) {
    saveSession(phone);
  }
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

function applyAppearanceSettings() {
  const appearance = state.settings?.appearance || {};
  const color = appearance.backgroundColor || "#fffaf0";
  document.documentElement.style.setProperty("--oa-bg-color", color);
  document.documentElement.style.setProperty("--oa-bg-image", appearance.backgroundImage ? `url("${appearance.backgroundImage}")` : "none");
}

function loadSession() {
  const sessionPhone = normalizePhone(localStorage.getItem(SESSION_KEY));
  if (!sessionPhone) {
    currentUser = null;
    return;
  }
  currentUser = state.settings.users.find((user) => normalizePhone(user.phone || user.username) === sessionPhone) || null;
}

function saveSession(phone) {
  localStorage.setItem(SESSION_KEY, normalizePhone(phone));
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
  const phone = normalizePhone(data.phone || data.username);
  const name = String(data.name || "").trim();
  if (!phone) return toast("請輸入手機號");
  if (phoneDigits(phone).length < 8) return toast("手機號格式不正確");
  if (!name) return toast("請輸入姓名");
  if (state.settings.users.some((user) => normalizePhone(user.phone || user.username) === phone)) return toast("手機號已存在");
  const isFirst = state.settings.users.length === 0;
  const user = {
    id: uid("usr"),
    name,
    username: phone,
    phone,
    password: data.password,
    role: isFirst ? "admin" : "user",
    systemRole: isFirst ? "管理員" : "普通人員",
    permissions: isFirst ? [...ALL_VIEWS] : ["dashboard"],
  };
  user.staffId = ensureStaffForUser(user);
  state.settings.users.push(user);
  saveState();
  saveSession(phone);
  form.reset();
  toast(isFirst ? "已註冊管理者帳號" : "註冊完成，請由管理者設定權限");
  renderAll();
  applyPermissions();
}

function loginUser(form) {
  const data = Object.fromEntries(new FormData(form));
  const phone = normalizePhone(data.phone || data.username);
  if (!phone) return toast("請輸入手機號");
  const user = state.settings.users.find((item) => normalizePhone(item.phone || item.username) === phone && item.password === data.password);
  if (!user) return toast("手機號或密碼錯誤");
  user.phone = normalizePhone(user.phone || user.username);
  user.username = user.phone;
  user.staffId = user.staffId || ensureStaffForUser(user);
  saveState();
  saveSession(user.phone);
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

function renderGrowthLevelNameInputs() {
  const target = $("#growthLevelNameGrid");
  if (!target) return;
  target.innerHTML = Array.from({ length: MAX_GROWTH_LEVEL }, (_, index) => {
    const level = index + 1;
    return `<label><span>Lv.${level}</span><input name="level_${level}" value="${escapeHtml(growthLevelName(level))}" /></label>`;
  }).join("");
}

function staffOptions(select, supervisorsOnly = false) {
  if (!select) return;
  const rows = (state.staff || []).filter((item) => {
    if (item.status === "離職") return false;
    if (!supervisorsOnly) return true;
    return ["管理員", "代理管理員"].includes(normalizeStaffRole(item.role)) || ["負責人", "主管"].some((key) => String(item.title || "").includes(key));
  });
  select.innerHTML = rows.map((item) => `<option value="${item.id}">${item.name} · ${item.title || item.role || "人事"}</option>`).join("") || `<option value="">請先建立人事資料</option>`;
}

function staffName(id, fallback = "-") {
  return (state.staff || []).find((item) => item.id === id)?.name || fallback;
}

function staffById(id) {
  return (state.staff || []).find((item) => item.id === id);
}

function pruneUserAccountsForDeletedStaff(staffId, staffPhone = "") {
  const phone = normalizePhone(staffPhone);
  const users = state.settings?.users || [];
  state.settings.users = users.filter((user) => {
    const sameStaff = staffId && user.staffId === staffId;
    const samePhone = phone && normalizePhone(user.phone || user.username || "") === phone;
    return !sameStaff && !samePhone;
  });
  if (currentUser?.id && !state.settings.users.some((user) => user.id === currentUser.id)) {
    localStorage.removeItem(SESSION_KEY);
    currentUser = null;
  }
}

function avatarMarkup(staff, size = "md") {
  const name = staff?.name || "?";
  const initial = escapeHtml(String(name).slice(0, 1) || "?");
  return `<span class="avatar ${size}">${staff?.avatarData ? `<img src="${staff.avatarData}" alt="${escapeHtml(name)}頭像" />` : initial}</span>`;
}

const MAX_GROWTH_LEVEL = 100;
const XP_PER_LEVEL = 100;

function defaultGrowthLevelName(level) {
  if (level >= 100) return "合夥人";
  if (level >= 80) return "合夥候選";
  if (level >= 60) return "主管";
  if (level >= 35) return "核心";
  if (level >= 15) return "熟手";
  return "新人";
}

function growthLevelName(level) {
  return state.settings?.growthLevelNames?.[level] || defaultGrowthLevelName(level);
}

function staffXp(staffId) {
  return Math.max(0, (state.growthRecords || []).filter((record) => record.staffId === staffId).reduce((sum, record) => sum + Number(record.xp || 0), 0));
}

function tenureXp(staff) {
  if (!staff?.joinDate || staff.status === "離職") return 0;
  const start = new Date(`${staff.joinDate}T00:00:00`);
  const now = new Date(`${today()}T00:00:00`);
  const days = Math.max(0, Math.floor((now - start) / 86400000) + 1);
  return days * 2;
}

function totalStaffXp(staff) {
  return staffXp(staff?.id) + tenureXp(staff);
}

function growthLevel(xp) {
  const level = Math.min(MAX_GROWTH_LEVEL, Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1);
  const currentMin = (level - 1) * XP_PER_LEVEL;
  const nextMin = level * XP_PER_LEVEL;
  const progress = level >= MAX_GROWTH_LEVEL ? 100 : Math.min(100, Math.round(((xp - currentMin) / (nextMin - currentMin)) * 100));
  return {
    index: level,
    name: growthLevelName(level),
    next: level < MAX_GROWTH_LEVEL ? { index: level + 1, min: nextMin, name: growthLevelName(level + 1) } : null,
    progress,
  };
}

function currentUserStaff() {
  return staffById(currentUser?.staffId) || (state.staff || []).find((item) => normalizePhone(item.phone) === normalizePhone(currentUser?.phone || currentUser?.username));
}

function updateLoginGrowthStrip() {
  const staff = currentUserStaff();
  const name = staff?.name || currentUser?.name || "未登入";
  const xp = staff ? totalStaffXp(staff) : 0;
  const level = growthLevel(xp);
  const nameEl = $("#loginUserName");
  if (!nameEl) return;
  nameEl.textContent = name;
  $("#loginUserLevel").textContent = `Lv.${level.index} ${level.name}`;
  $("#loginUserXpBar").style.width = `${level.progress}%`;
  $("#loginUserXpPercent").textContent = `${level.progress}%`;
  const strip = $("#userGrowthStrip");
  if (strip) strip.style.setProperty("--avatar", staff?.avatarData ? `url("${staff.avatarData}")` : "none");
}

function staffGender(id) {
  return staffById(id)?.gender || "";
}

function payrollNumbers(item) {
  return {
    baseSalary: Number(item.baseSalary || 0),
    mealAllowance: Number(item.mealAllowance || 0),
    housingAllowance: Number(item.housingAllowance || 0),
    transportAllowance: Number(item.transportAllowance || 0),
    otherAllowance1: Number(item.otherAllowance1 || 0),
    otherAllowance2: Number(item.otherAllowance2 || 0),
    otherAllowance3: Number(item.otherAllowance3 || 0),
    insurance: Number(item.insurance || 0),
    netSalary: Number(item.netSalary || 0),
  };
}

function insuranceFromBase(baseSalary) {
  return Math.round(Number(baseSalary || 0) * 0.105);
}

function socialDetail(baseSalary) {
  const base = Number(baseSalary || 0);
  return `養老 ${money(base * 0.08)}、醫療 ${money(base * 0.02)}、失業 ${money(base * 0.005)}、公積金 ${money(base * 0.07)}`;
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

function findKnitter(id) {
  return (state.knitters || []).find((item) => item.id === id);
}

function knitterLabel(id) {
  const knitter = findKnitter(id);
  if (!knitter) return "-";
  return knitter.name || knitter.studioName || "-";
}

function knitterStudio(id) {
  return findKnitter(id)?.studioName || "-";
}

function dayDiff(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.round((end - start) / 86400000);
}

function sampleDeliveryInfo(sample) {
  const leadDays = Number(sample.leadDays || findKnitter(sample.knitterId)?.leadTime || 0);
  if (!sample.sendDate || !sample.receivedDate || !leadDays) {
    return { leadDays, diff: null, text: "待計算", rating: "待到貨", ratingType: "blue", suggestion: "" };
  }
  const usedDays = dayDiff(sample.sendDate, sample.receivedDate);
  if (usedDays === null) return { leadDays, diff: null, text: "待計算", rating: "待到貨", ratingType: "blue", suggestion: "" };
  const overtime = usedDays - leadDays;
  const text = overtime < 0 ? `提前 ${Math.abs(overtime)} 天` : overtime === 0 ? "準時" : `超時 ${overtime} 天`;
  const rating = overtime <= 0 ? "優" : overtime <= 2 ? "中等" : "劣跡";
  const ratingType = rating === "優" ? "ok" : rating === "中等" ? "warn" : "out";
  return { leadDays, diff: overtime, text, rating, ratingType, suggestion: "" };
}

function knitterRankings() {
  return (state.knitters || []).map((knitter) => {
    const samples = (state.samples || []).filter((item) => item.knitterId === knitter.id && sampleDeliveryInfo(item).diff !== null);
    const stats = samples.reduce((acc, sample) => {
      const info = sampleDeliveryInfo(sample);
      if (info.rating === "優") acc.good += 1;
      if (info.rating === "中等") acc.medium += 1;
      if (info.rating === "劣跡") acc.bad += 1;
      acc.overtime += Math.max(0, Number(info.diff || 0));
      return acc;
    }, { good: 0, medium: 0, bad: 0, overtime: 0 });
    return {
      knitter,
      total: samples.length,
      ...stats,
      avgOvertime: samples.length ? stats.overtime / samples.length : 0,
      suggestion: stats.bad > 3 ? "淘汰建議" : "正常合作",
    };
  }).sort((a, b) => b.good * 3 + b.medium - b.bad * 3 - b.avgOvertime - (a.good * 3 + a.medium - a.bad * 3 - a.avgOvertime));
}

function knitterOptions(select) {
  if (!select) return;
  const rows = state.knitters || [];
  select.innerHTML = rows.map((item) => `<option value="${item.id}">${escapeHtml(item.name || item.studioName || "未命名織女")}</option>`).join("") || `<option value="">請先新增織女資料</option>`;
  select.disabled = !rows.length;
  return;
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
  renderGrowthLevelNameInputs();
  ["leaveStaff", "tripStaff", "purchaseRequestStaff", "proposalStaff", "growthStaff"].forEach((id) => staffOptions($(`#${id}`)));
  ["adminPayrollStaff", "livePayrollStaff", "partnerBonusStaff"].forEach((id) => staffOptions($(`#${id}`)));
  ["leaveApprover", "tripApprover", "purchaseRequestApprover", "proposalApprover"].forEach((id) => staffOptions($(`#${id}`), true));
  knitterOptions($("#sampleKnitter"));
  knitterOptions($("#yarnShipmentKnitter"));
  updateYarnShipmentStudio();
  updateSampleLeadDays();
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
  $("#announcementForm").classList.toggle("hidden", currentUser?.role !== "admin" && currentUser?.systemRole !== "管理員");
  $("#announcementRows").innerHTML = announcements.map((item) => `
    <article class="announcement-item">
      <div><strong>${item.title}</strong><span>${new Date(item.createdAt).toLocaleString("zh-TW")} · ${item.author || "管理者"}</span></div>
      <p>${item.content}</p>
      ${currentUser?.role === "admin" || currentUser?.systemRole === "管理員" ? rowActions("announcement", item.id) : ""}
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
    <tr><td>${item.receivedDate || "-"}</td><td>${knitterLabel(item.knitterId)}</td><td>${knitterStudio(item.knitterId)}</td><td>${item.style || "-"}</td><td>${tag(item.status || "-", item.status === "已到貨" ? "ok" : "blue")}</td><td>${item.hasTutorial || "-"}</td><td class="num">${money(item.price)}</td></tr>
  `).join("") || emptyRow(7);
  $("#dashboardSampleInventoryCount").textContent = `${sampleRows.length} 件`;
  $("#dashboardSampleInventoryRows").innerHTML = sampleRows.map((item) => `
    <tr><td>${item.style || "-"}</td><td>${knitterLabel(item.knitterId)}</td><td>${knitterStudio(item.knitterId)}</td><td>${tag(item.status || "-", item.status === "已到貨" ? "ok" : "blue")}</td><td>${tag(item.settled || "未支付", item.settled === "已結清" ? "ok" : "warn")}</td><td>${item.receivedDate || "-"}</td></tr>
  `).join("") || emptyRow(6);

  const rankingRows = knitterRankings().slice(0, 6);
  $("#dashboardKnitterRankCount").textContent = `${rankingRows.length} 人`;
  $("#dashboardKnitterRankRows").innerHTML = rankingRows.map((item, index) => `
    <tr><td>${index + 1}</td><td>${item.knitter.name || "-"}</td><td>${item.knitter.studioName || "-"}</td><td>${item.total}</td><td>${item.good}</td><td>${item.medium}</td><td>${item.bad}</td><td>${tag(item.suggestion, item.suggestion === "淘汰建議" ? "out" : "ok")}</td></tr>
  `).join("") || emptyRow(8);
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

function inlineDate(value, type, id, field) {
  return `<input class="table-control" type="date" value="${escapeHtml(value || "")}" data-inline-update="${type}" data-id="${id}" data-field="${field}" />`;
}

function inlineSelect(value, type, id, field, options) {
  return `<select class="table-control" data-inline-update="${type}" data-id="${id}" data-field="${field}">
    ${options.map((option) => `<option value="${escapeHtml(option)}" ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
  </select>`;
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

function invoiceLineSummary(lines = []) {
  return lines.map((line) => `${line.itemName || "-"} ${line.spec || ""} ${number(line.qty)}${line.unit || ""} 稅率${line.taxRate || "-"}`).join("；") || "-";
}

function renderInvoices() {
  const rows = currentRows(state.invoiceUploads || []).sort((a, b) => `${b.invoiceDate}${b.createdAt}`.localeCompare(`${a.invoiceDate}${a.createdAt}`));
  $("#invoiceUploadCount").textContent = `${rows.length} 筆`;
  $("#invoiceUploadRows").innerHTML = rows.map((item) => `<tr>
    <td>${item.fileName ? `<a href="${item.fileData}" download="${escapeHtml(item.fileName)}">${escapeHtml(item.fileName)}</a>` : "-"}</td>
    <td>${item.invoiceType || "-"}</td>
    <td>${item.invoiceNo || "-"}</td>
    <td>${item.invoiceDate || "-"}</td>
    <td>${item.buyerName || "-"}</td>
    <td>${item.buyerTaxId || "-"}</td>
    <td>${item.sellerName || "-"}</td>
    <td class="num">${money(item.totalAmount)}</td>
    <td class="num">${money(item.taxAmount)}</td>
    <td class="num">${money(item.totalWithTax)}</td>
    <td>${invoiceLineSummary(item.lines)}</td>
    <td>${rowActions("invoiceUpload", item.id)}</td>
  </tr>`).join("") || emptyRow(12);
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
      <td>${item.studioName || "-"}</td>
      <td>${item.contactPhone || "-"}</td>
      <td>${item.wechat || "-"}</td>
      <td>${item.qq || "-"}</td>
      <td>${item.identityCode || "-"}</td>
      <td>${item.contactAddress || "-"}</td>
      <td>${styles.join("、") || "-"}</td>
      <td>${priceText}</td>
      <td>${number(item.leadTime)} 天</td>
      <td>${item.tutorialAvailable || "-"}</td>
      <td>${item.settlementDate || "-"}</td>
      <td>${rowActions("knitter", item.id, true)}</td>
    </tr>`;
  }).join("") || emptyRow(14);

  const samples = currentRows(state.samples || []).sort((a, b) => `${b.receivedDate}${b.createdAt}`.localeCompare(`${a.receivedDate}${a.createdAt}`));
  $("#sampleCount").textContent = `${samples.length} 筆`;
  $("#sampleRows").innerHTML = samples.map((item) => {
    const delivery = sampleDeliveryInfo(item);
    return `<tr>
      <td>${imageThumb(item.imageData, item.style)}</td>
      <td>${knitterLabel(item.knitterId)}</td>
      <td>${knitterStudio(item.knitterId)}</td>
      <td>${item.sendDate || "-"}</td>
      <td>${number(delivery.leadDays)} 天</td>
      <td>${inlineDate(item.receivedDate, "sample", item.id, "receivedDate")}</td>
      <td>${delivery.text}</td>
      <td>${tag(delivery.rating, delivery.ratingType)}</td>
      <td>${inlineSelect(item.status || "編織中", "sample", item.id, "status", ["編織中", "寄送中", "已到貨"])}</td>
      <td>${item.style || "-"}</td>
      <td>${item.hasTutorial || "-"}</td>
      <td class="num">${money(item.price)}</td>
      <td>${tag(item.settled || "未支付", item.settled === "已結清" ? "ok" : "warn")}</td>
      <td>${rowActions("sample", item.id, true)}</td>
    </tr>`;
  }).join("") || emptyRow(14);

  $("#sampleInventoryCount").textContent = `${samples.length} 件`;
  $("#sampleInventoryRows").innerHTML = samples.map((item) => {
    const delivery = sampleDeliveryInfo(item);
    return `<tr>
      <td>${imageThumb(item.imageData, item.style)}</td>
      <td>${item.style || "-"}</td>
      <td>${knitterLabel(item.knitterId)}</td>
      <td>${knitterStudio(item.knitterId)}</td>
      <td>${item.sendDate || "-"}</td>
      <td>${number(delivery.leadDays)} 天</td>
      <td>${item.receivedDate || "-"}</td>
      <td>${delivery.text}</td>
      <td>${tag(delivery.rating, delivery.ratingType)}</td>
      <td>${tag(item.status || "-", item.status === "已到貨" ? "ok" : "blue")}</td>
      <td>${item.hasTutorial || "-"}</td>
      <td class="num">${money(item.price)}</td>
      <td>${tag(item.settled || "未支付", item.settled === "已結清" ? "ok" : "warn")}</td>
    </tr>`;
  }).join("") || emptyRow(13);

  const yarnRows = currentRows(state.yarnShipments || []).sort((a, b) => `${b.sendDate}${b.createdAt}`.localeCompare(`${a.sendDate}${a.createdAt}`));
  $("#yarnShipmentCount").textContent = `${yarnRows.length} 筆`;
  $("#yarnShipmentRows").innerHTML = yarnRows.map((item) => {
    const lines = (item.lines || []).map((line) => `${line.yarnNo || "-"} ${line.name || ""} ${line.color || ""} ${number(line.qty)} ${line.unit || ""}`.trim()).join("；");
    return `<tr>
      <td>${imageThumb(item.imageData, item.trackingNo)}</td>
      <td>${knitterLabel(item.knitterId)}</td>
      <td>${knitterStudio(item.knitterId)}</td>
      <td>${item.trackingNo || "-"}</td>
      <td>${item.sendDate || "-"}</td>
      <td>${lines || "-"}</td>
      <td>${item.note || "-"}</td>
      <td>${rowActions("yarnShipment", item.id)}</td>
    </tr>`;
  }).join("") || emptyRow(8);

  const rankingRows = knitterRankings();
  $("#knitterRankingCount").textContent = `${rankingRows.length} 人`;
  $("#knitterRankingRows").innerHTML = rankingRows.map((item, index) => `<tr>
    <td>${index + 1}</td>
    <td>${item.knitter.name || "-"}</td>
    <td>${item.knitter.studioName || "-"}</td>
    <td>${item.total}</td>
    <td>${item.good}</td>
    <td>${item.medium}</td>
    <td>${item.bad}</td>
    <td>${item.avgOvertime ? `${item.avgOvertime.toFixed(1)} 天` : "-"}</td>
    <td>${tag(item.suggestion, item.suggestion === "淘汰建議" ? "out" : "ok")}</td>
  </tr>`).join("") || emptyRow(9);
}

function renderSettings() {
  const rows = currentRows(state.settings?.positions || []);
  $("#positionCount").textContent = `${rows.length} 筆`;
  $("#positionRows").innerHTML = rows.map((name) => `<tr>
    <td>${name}</td>
    <td>${rowActions("position", name, true)}</td>
  </tr>`).join("") || emptyRow(2);
  const users = (state.settings.users || []).filter((user) => !user.staffId || staffById(user.staffId));
  $("#permissionCount").textContent = `${users.length} 人`;
  $("#permissionRows").innerHTML = users.map((user) => `
    <article class="permission-card">
      <div><strong>${user.name}</strong><span>${user.phone || user.username} · ${user.systemRole || (user.role === "admin" ? "管理員" : "普通人員")}</span></div>
      <div class="permission-grid">
        ${ALL_VIEWS.map((view) => `<label><input type="checkbox" data-permission-user="${user.id}" value="${view}" ${user.role === "admin" || (user.permissions || []).includes(view) ? "checked" : ""} ${user.role === "admin" ? "disabled" : ""}>${permissionLabel(view)}</label>`).join("")}
      </div>
    </article>
  `).join("") || `<p class="empty">尚無帳號</p>`;
  renderAppearanceSettings();
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return "-";
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function renderAppearanceSettings() {
  const appearance = state.settings?.appearance || {};
  const form = $("#appearanceForm");
  if (form) {
    form.elements.backgroundColor.value = appearance.backgroundColor || "#fffaf0";
    form.elements.backgroundImage.value = appearance.backgroundImage || "";
  }
  renderBackgroundPreview();
}

function renderBackgroundPreview() {
  const appearance = state.settings?.appearance || {};
  const preview = $("#backgroundPreview");
  const meta = $("#backgroundMeta");
  if (preview) {
    preview.innerHTML = appearance.backgroundImage
      ? `<img src="${appearance.backgroundImage}" alt="背景圖片預覽" />`
      : `<span>尚未上傳背景圖</span>`;
  }
  if (meta) {
    const size = formatBytes(appearance.backgroundImageSize);
    const dimensions = appearance.backgroundImageWidth && appearance.backgroundImageHeight
      ? `${appearance.backgroundImageWidth} × ${appearance.backgroundImageHeight}px`
      : "-";
    meta.textContent = appearance.backgroundImage ? `目前圖片：${appearance.backgroundImageName || "背景圖"}｜檔案大小 ${size}｜尺寸 ${dimensions}` : "目前未使用背景圖";
  }
}

function viewLabel(view) {
  if (ERP_VIEWS.includes(view)) return "ERP系統";
  if (LIVE_SYSTEM_VIEWS.includes(view)) return "直播系統";
  return VIEW_LABELS[view] || $(`.nav-item[data-view="${view}"] span`)?.textContent || view;
}

function permissionLabel(view) {
  if (ERP_VIEWS.includes(view)) return `ERP系統 / ${ERP_TAB_LABELS[view]}`;
  if (LIVE_SYSTEM_VIEWS.includes(view)) return `直播系統 / ${view === "live" ? "直播對應" : "直播間銷售"}`;
  return VIEW_LABELS[view] || viewLabel(view);
}

function ensureErpTabs() {
  $$(".system-tabs").forEach((tabs) => {
    const hasErpButton = [...tabs.querySelectorAll("[data-system-tab]")].some((button) => ERP_VIEWS.includes(button.dataset.systemTab));
    if (!hasErpButton) return;
    ERP_VIEWS.forEach((view) => {
      if (tabs.querySelector(`[data-system-tab="${view}"]`)) return;
      const button = document.createElement("button");
      button.className = "section-tab";
      button.dataset.systemTab = view;
      button.type = "button";
      button.textContent = ERP_TAB_LABELS[view];
      tabs.appendChild(button);
    });
  });
}

function renderGrowth() {
  const staffRows = currentRows(state.staff || []).filter((item) => item.status !== "離職");
  $("#growthProfileCount").textContent = `${staffRows.length} 人`;
  $("#growthProfiles").innerHTML = staffRows.map((staff) => {
    const recordXp = staffXp(staff.id);
    const workXp = tenureXp(staff);
    const xp = recordXp + workXp;
    const level = growthLevel(xp);
    const nextText = level.next ? `距離 Lv.${level.next.index} ${level.next.name} 還差 ${number(level.next.min - xp)} EXP` : "已達最高等級";
    return `<article class="growth-card">
      <div class="growth-card-head">${avatarMarkup(staff)}<div><strong>${staff.name}</strong><small>${staff.title || "待補職位"} · ${staff.dept || "待補部門"}</small></div><span>Lv.${level.index} ${level.name}</span></div>
      <div class="growth-progress"><i style="width:${level.progress}%"></i></div>
      <div class="growth-meta"><span>${number(xp)} EXP</span><b>${level.progress}%</b></div>
      <small class="growth-source">紀錄 ${number(recordXp)} EXP · 在職 ${number(workXp)} EXP</small>
      <p>${nextText}</p>
    </article>`;
  }).join("") || `<p class="empty">尚無人事資料</p>`;

  const records = currentRows(state.growthRecords || []).sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`));
  $("#growthRecordCount").textContent = `${records.length} 筆`;
  $("#growthRows").innerHTML = records.map((record) => `<tr>
    <td>${record.date || "-"}</td>
    <td>${staffName(record.staffId)}</td>
    <td>${tag(record.category || "-", "blue")}</td>
    <td class="num">${Number(record.xp) > 0 ? "+" : ""}${number(record.xp)} EXP</td>
    <td>${record.note || "-"}</td>
    <td>${rowActions("growthRecord", record.id)}</td>
  </tr>`).join("") || emptyRow(6);
  updateLoginGrowthStrip();
}

function renderStaff() {
  const rows = currentRows(state.staff || []);
  $("#staffCount").textContent = `${rows.length} 人`;
  $("#staffRows").innerHTML = rows.map((item) => `<tr>
    <td>${tag(staffTypeLabel(item.employeeType), item.employeeType === "partner" ? "warn" : item.employeeType === "core" ? "blue" : "ok")}</td>
    <td>${item.code}</td>
    <td>${item.name}</td>
    <td>${item.gender || "-"}</td>
    <td>${item.dept}</td>
    <td>${item.title || "-"}</td>
    <td>${tag(item.role, "blue")}</td>
    <td><span class="account-cell">${item.phone || "-"}</span></td>
    <td>${tag(item.status || "在職", item.status === "離職" ? "out" : "ok")}</td>
    <td>${rowActions("staff", item.id, true)}</td>
  </tr>`).join("") || emptyRow(10);
}

function staffTypeLabel(type) {
  return { regular: "一般", core: "核心", partner: "合夥" }[type || "regular"] || "一般";
}

function renderLeave() {
  const rows = currentRows(state.leaveRequests || []).sort((a, b) => `${b.startDate}${b.code}`.localeCompare(`${a.startDate}${a.code}`));
  $("#leaveCount").textContent = `${rows.length} 筆`;
  $("#leaveRows").innerHTML = rows.map((item) => `<tr>
    <td>${item.code}</td>
    <td>${staffName(item.staffId, item.name || "-")}</td>
    <td>${item.type || "-"}</td>
    <td>${item.startDate} ~ ${item.endDate}</td>
    <td>${number(item.days)}</td>
    <td>${tag(item.status, item.status === "已通過" ? "ok" : item.status === "已駁回" ? "out" : "warn")}</td>
    <td>${staffName(item.approverId, item.approver || "-")}</td>
    <td>${rowActions("leave", item.id)}</td>
  </tr>`).join("") || emptyRow(8);
}

function approvalStatusActions(type, id, status) {
  if (status !== "待審批") return "";
  return `<button class="small-btn" data-approve="${type}" data-id="${id}" aria-label="通過"><i data-lucide="check"></i></button><button class="small-btn delete" data-reject="${type}" data-id="${id}" aria-label="駁回"><i data-lucide="x"></i></button>`;
}

function approvalRows() {
  return [
    ...(state.leaveRequests || []).map((item) => ({ type: "leave", typeName: "請假", id: item.id, code: item.code, staffId: item.staffId, title: item.type || "請假申請", date: `${item.startDate || "-"} ~ ${item.endDate || "-"}`, amount: `${number(item.days)} 天`, approverId: item.approverId, status: item.status || "待審批", createdAt: item.createdAt || 0 })),
    ...(state.tripRequests || []).map((item) => ({ type: "trip", typeName: "出差", id: item.id, code: item.code, staffId: item.staffId, title: item.destination, date: `${item.startDate || "-"} ~ ${item.endDate || "-"}`, amount: money(item.amount), approverId: item.approverId, status: item.status || "待審批", createdAt: item.createdAt || 0 })),
    ...(state.purchaseRequests || []).map((item) => ({ type: "purchaseRequest", typeName: "採購", id: item.id, code: item.code, staffId: item.staffId, title: item.item, date: "-", amount: money(item.amount), approverId: item.approverId, status: item.status || "待審批", createdAt: item.createdAt || 0 })),
    ...(state.proposalRequests || []).map((item) => ({ type: "proposal", typeName: "提案", id: item.id, code: item.code, staffId: item.staffId, title: item.title, date: "-", amount: item.benefit || "-", approverId: item.approverId, status: item.status || "待審批", createdAt: item.createdAt || 0 })),
  ].sort((a, b) => b.createdAt - a.createdAt);
}

function renderApprovals() {
  const allRows = currentRows(approvalRows());
  $("#approvalCount").textContent = `${allRows.length} 筆`;
  $("#approvalRows").innerHTML = allRows.map((item) => `<tr>
    <td>${item.typeName}</td><td>${item.code}</td><td>${staffName(item.staffId)}</td><td>${item.title || "-"}</td><td>${item.date}</td><td>${item.amount}</td><td>${staffName(item.approverId)}</td>
    <td>${tag(item.status, item.status === "已通過" ? "ok" : item.status === "已駁回" ? "out" : "warn")}</td>
    <td><div class="row-actions">${approvalStatusActions(item.type, item.id, item.status)}</div></td>
  </tr>`).join("") || emptyRow(9);

  const trips = currentRows(state.tripRequests || []).sort((a, b) => b.createdAt - a.createdAt);
  $("#tripCount").textContent = `${trips.length} 筆`;
  $("#tripRows").innerHTML = trips.map((item) => `<tr><td>${item.code}</td><td>${staffName(item.staffId)}</td><td>${item.destination}</td><td>${item.startDate} ~ ${item.endDate}</td><td class="num">${money(item.amount)}</td><td>${staffName(item.approverId)}</td><td>${tag(item.status, item.status === "已通過" ? "ok" : item.status === "已駁回" ? "out" : "warn")}</td><td>${rowActions("trip", item.id)}</td></tr>`).join("") || emptyRow(8);

  const purchases = currentRows(state.purchaseRequests || []).sort((a, b) => b.createdAt - a.createdAt);
  $("#purchaseRequestCount").textContent = `${purchases.length} 筆`;
  $("#purchaseRequestRows").innerHTML = purchases.map((item) => `<tr><td>${item.code}</td><td>${staffName(item.staffId)}</td><td>${item.item}</td><td>${number(item.qty)}</td><td class="num">${money(item.amount)}</td><td>${staffName(item.approverId)}</td><td>${tag(item.status, item.status === "已通過" ? "ok" : item.status === "已駁回" ? "out" : "warn")}</td><td>${rowActions("purchaseRequest", item.id)}</td></tr>`).join("") || emptyRow(8);

  const proposals = currentRows(state.proposalRequests || []).sort((a, b) => b.createdAt - a.createdAt);
  $("#proposalCount").textContent = `${proposals.length} 筆`;
  $("#proposalRows").innerHTML = proposals.map((item) => `<tr><td>${item.code}</td><td>${staffName(item.staffId)}</td><td>${item.title}</td><td>${item.benefit || "-"}</td><td>${staffName(item.approverId)}</td><td>${tag(item.status, item.status === "已通過" ? "ok" : item.status === "已駁回" ? "out" : "warn")}</td><td>${rowActions("proposal", item.id)}</td></tr>`).join("") || emptyRow(7);
}

function allowanceTotal(item, includeTransport = true) {
  return Number(item.mealAllowance || 0) + Number(item.housingAllowance || 0) + (includeTransport ? Number(item.transportAllowance || 0) : 0) + Number(item.otherAllowance1 || 0) + Number(item.otherAllowance2 || 0) + Number(item.otherAllowance3 || 0);
}

function renderPayroll() {
  const admins = currentRows(state.adminPayrolls || []);
  $("#adminPayrollCount").textContent = `${admins.length} 筆`;
  $("#adminPayrollRows").innerHTML = admins.map((item) => `<tr>
    <td>${staffName(item.staffId)}</td><td>${item.gender || staffGender(item.staffId) || "-"}</td><td>${item.employmentStatus || "-"}</td><td class="num">${money(item.baseSalary)}</td><td class="num">${money(allowanceTotal(item))}</td><td class="num">${money(item.insurance)}</td><td class="num">${money(item.netSalary)}</td><td>每月 ${item.payDay || 10} 日</td><td>${rowActions("adminPayroll", item.id)}</td>
  </tr>`).join("") || emptyRow(9);

  const lives = currentRows(state.livePayrolls || []);
  $("#livePayrollCount").textContent = `${lives.length} 筆`;
  $("#livePayrollRows").innerHTML = lives.map((item) => `<tr>
    <td>${staffName(item.staffId)}</td><td>${item.gender || staffGender(item.staffId) || "-"}</td><td class="num">${money(item.baseSalary)}</td><td>${number(item.commission)}%</td><td class="num">${money(item.netRevenue)}</td><td class="num">${money(allowanceTotal(item, false))}</td><td class="num">${money(item.insurance)}</td><td class="num">${money(item.netSalary)}</td><td>${rowActions("livePayroll", item.id)}</td>
  </tr>`).join("") || emptyRow(9);

  const bonuses = currentRows(state.partnerBonuses || []);
  $("#partnerBonusCount").textContent = `${bonuses.length} 筆`;
  $("#partnerBonusRows").innerHTML = bonuses.map((item) => `<tr>
    <td>${staffName(item.staffId)}</td><td>${item.gender || staffGender(item.staffId) || "-"}</td><td class="num">${money(item.netProfit)}</td><td>${number(item.bonusRate)}%</td><td class="num">${money(item.bonusAmount)}</td><td>每月 10 日</td><td>${rowActions("partnerBonus", item.id)}</td>
  </tr>`).join("") || emptyRow(7);
}

function tradePrefix() {
  const now = new Date();
  return `MIT-${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}-`;
}

function normalizeTradeNo(no = "") {
  return String(no || "").replace(/^MIT-(\d{2})-(\d{2})-(\d{3})$/, "MIT-$1$2-$3");
}

function generateTradeNo(existingId = "") {
  const prefix = tradePrefix();
  const maxSeq = (state.tradeDocs || [])
    .map((doc) => ({ ...doc, no: normalizeTradeNo(doc.no) }))
    .filter((doc) => doc.id !== existingId && doc.no?.startsWith(prefix))
    .map((doc) => Number(doc.no.slice(prefix.length)))
    .filter(Number.isFinite)
    .reduce((max, seq) => Math.max(max, seq), 0);
  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}

function tradeTotals(lines = []) {
  return lines.reduce((totals, line) => ({
    nw: totals.nw + Number(line.nw || 0),
    gw: totals.gw + Number(line.gw || 0),
    amount: totals.amount + Number(line.nw || 0) * Number(line.unitPrice || 0),
  }), { nw: 0, gw: 0, amount: 0 });
}

function tradeLinesFromForm(form) {
  const formData = new FormData(form);
  return tradeLineValuesFromForm(formData).filter((line) => line.yarnNo || line.count || line.composition || line.color || line.nw || line.gw || line.unitPrice || line.packages);
}

function tradeLineValuesFromForm(formData = new FormData($("#tradeForm"))) {
  return formData.getAll("yarnNo").map((_, index) => ({
    yarnNo: formData.getAll("yarnNo")[index]?.trim() || "",
    count: formData.getAll("count")[index]?.trim() || "",
    composition: formData.getAll("composition")[index]?.trim() || "",
    color: formData.getAll("color")[index]?.trim() || "",
    nw: Number(formData.getAll("nw")[index] || 0),
    gw: Number(formData.getAll("gw")[index] || 0),
    unitPrice: Number(formData.getAll("unitPrice")[index] || 0),
    packages: Number(formData.getAll("packages")[index] || 0),
  }));
}

function updateTradeAutoFields() {
  const form = $("#tradeForm");
  if (!form) return;
  const totals = tradeTotals(tradeLinesFromForm(form));
  const deposit = Number(form.elements.deposit.value || 0);
  form.elements.totalValue.value = Math.max(0, totals.amount - deposit).toFixed(2);
}

function renderTradeLineInputs(lines = [], minRows = 5) {
  const rowCount = Math.max(lines.length, minRows);
  tradeLineDrafts = Array.from({ length: rowCount }, (_, index) => lines[index] || {});
  $("#tradeLineInputs").innerHTML = tradeLineDrafts.map((line, index) => `<div class="trade-line-row" data-trade-line="${index}">
    <span class="trade-line-no">${index + 1}</span>
    <input class="shared-field" name="yarnNo" value="${escapeHtml(line.yarnNo || "")}" placeholder="共用 H-28956" />
    <input class="shared-field" name="count" value="${escapeHtml(line.count || "")}" placeholder="共用 35MM" />
    <input class="shared-field" name="composition" value="${escapeHtml(line.composition || "")}" placeholder="共用 VISCOSE100%" />
    <input class="shared-field" name="color" value="${escapeHtml(line.color || "")}" placeholder="共用 #105" />
    <input class="shared-field" name="nw" type="number" min="0" step="0.01" value="${line.nw || ""}" placeholder="共用" />
    <input class="invoice-field" name="unitPrice" type="number" min="0" step="0.01" value="${line.unitPrice || ""}" placeholder="INVOICE" />
    <input class="auto-field invoice-field" readonly value="${Number(line.nw || 0) && Number(line.unitPrice || 0) ? (Number(line.nw || 0) * Number(line.unitPrice || 0)).toFixed(2) : "自動生成"}" />
    <input class="packing-field" name="gw" type="number" min="0" step="0.01" value="${line.gw || ""}" placeholder="PACKING" />
    <input class="packing-field" name="packages" type="number" min="0" step="1" value="${line.packages || ""}" placeholder="PACKING" />
    <button class="small-btn delete" data-remove-trade-line="${index}" type="button" aria-label="刪除此列"><i data-lucide="trash-2"></i></button>
  </div>`).join("");
  if (window.lucide) window.lucide.createIcons();
  updateTradeAutoFields();
}

function currentTradeLineDrafts() {
  return tradeLineValuesFromForm(new FormData($("#tradeForm")));
}

function addTradeLines(count = 1) {
  renderTradeLineInputs([...currentTradeLineDrafts(), ...Array.from({ length: count }, () => ({}))], 0);
}

function removeTradeLine(index) {
  const rows = currentTradeLineDrafts();
  rows.splice(index, 1);
  renderTradeLineInputs(rows.length ? rows : [{}], 0);
}

function renderYarnShipmentLineInputs(lines = [], minRows = 1) {
  const rowCount = Math.max(lines.length, minRows);
  yarnShipmentLineDrafts = Array.from({ length: rowCount }, (_, index) => lines[index] || {});
  $("#yarnShipmentLineInputs").innerHTML = yarnShipmentLineDrafts.map((line, index) => `<div class="yarn-line-row" data-yarn-line="${index}">
    <input name="yarnNo" value="${escapeHtml(line.yarnNo || "")}" placeholder="紗號" />
    <input name="name" value="${escapeHtml(line.name || "")}" placeholder="品名" />
    <input name="color" value="${escapeHtml(line.color || "")}" placeholder="顏色" />
    <input name="qty" type="number" min="0" step="0.01" value="${line.qty || ""}" placeholder="數量" />
    <select name="unit">
      ${["KG", "包", "團"].map((unit) => `<option value="${unit}" ${unit === (line.unit || "KG") ? "selected" : ""}>${unit}</option>`).join("")}
    </select>
    <button class="small-btn delete" data-remove-yarn-line="${index}" type="button" aria-label="刪除明細"><i data-lucide="x"></i></button>
  </div>`).join("");
  if (window.lucide) window.lucide.createIcons();
}

function currentYarnShipmentLineDrafts() {
  return [...document.querySelectorAll("[data-yarn-line]")].map((row) => ({
    yarnNo: row.querySelector("[name='yarnNo']").value.trim(),
    name: row.querySelector("[name='name']").value.trim(),
    color: row.querySelector("[name='color']").value.trim(),
    qty: Number(row.querySelector("[name='qty']").value || 0),
    unit: row.querySelector("[name='unit']").value,
  })).filter((line) => line.yarnNo || line.name || line.color || line.qty);
}

function addYarnShipmentLine(count = 1) {
  renderYarnShipmentLineInputs([...currentYarnShipmentLineDrafts(), ...Array.from({ length: count }, () => ({}))], 0);
}

function invoiceLineTemplate() {
  return `<div class="invoice-line-row" data-invoice-line>
    <input name="lineItemName" placeholder="項目名稱" />
    <input name="lineSpec" placeholder="規格型號" />
    <input name="lineUnit" placeholder="單位" />
    <input name="lineQty" type="number" min="0" step="0.01" placeholder="數量" />
    <input name="lineUnitPrice" type="number" min="0" step="0.01" placeholder="單價" />
    <input name="lineAmount" type="number" min="0" step="0.01" placeholder="金額" />
    <input name="lineTaxRate" placeholder="稅率" value="13%" />
    <input name="lineTaxAmount" type="number" min="0" step="0.01" placeholder="稅額" />
    <button class="small-btn delete" data-remove-invoice-line type="button" aria-label="刪除明細"><i data-lucide="x"></i></button>
  </div>`;
}

function addInvoiceLine() {
  $("#invoiceLineInputs").insertAdjacentHTML("beforeend", invoiceLineTemplate());
  if (window.lucide) window.lucide.createIcons();
}

function removeYarnShipmentLine(index) {
  const rows = currentYarnShipmentLineDrafts();
  rows.splice(index, 1);
  renderYarnShipmentLineInputs(rows.length ? rows : [{}], 0);
}

function activeTradeDoc() {
  const docs = state.tradeDocs || [];
  return docs.find((doc) => doc.id === activeTradeDocId) || docs[0] || null;
}

function setActiveTradeDoc(id, openPreview = false) {
  if (!id) return;
  activeTradeDocId = id;
  const doc = state.tradeDocs.find((item) => item.id === id);
  if (doc && $("#tradeForm")) {
    fillForm($("#tradeForm"), doc);
    renderTradeLineInputs(doc.lines || [], 5);
  }
  if (openPreview && intlTab === "setup") setIntlTab("invoice");
  renderIntl();
}

function tradeCell(value) {
  return escapeHtml(value || "");
}

function renderTradeSheet(doc, mode = intlTab) {
  if (!doc) return `<p class="empty">尚無國貿單據</p>`;
  const lines = Array.from({ length: Math.max(20, doc.lines?.length || 0) }, (_, index) => doc.lines?.[index] || {});
  const totals = tradeTotals(doc.lines || []);
  const isPacking = mode === "packing";
  const title = isPacking ? "COMMERCIAL PACKING" : "COMMERCIAL INVOICE";
  $("#tradePreviewTitle").textContent = title;
  return `<div class="trade-document ${isPacking ? "packing" : ""}">
    <div class="trade-doc-title">${title}</div>
    <div class="trade-doc-meta">NO: ${tradeCell(normalizeTradeNo(doc.no))}</div>
    <div class="trade-info-grid">
      <div class="trade-box buyer">
        <h3>${isPacking ? "BUYER (Linked from Invoice)" : "BUYER INFORMATION"}</h3>
        <p><b>Company:</b><span>${tradeCell(doc.company)}</span></p>
        <p><b>Consignee:</b><span>${tradeCell(doc.consignee)}</span></p>
        <p><b>Phone:</b><span>${tradeCell(doc.phone)}</span></p>
        <p><b>Address:</b><span>${tradeCell(doc.address)}</span></p>
      </div>
      <div class="trade-box traffic">
        <h3>Traffic information</h3>
        <p><b>DATE:</b><span>${tradeCell(doc.date?.replaceAll("-", "/"))}</span></p>
        <p><b>FROM:</b><span>${tradeCell(doc.from)}</span></p>
        <p><b>PRODUCT:</b><span>${tradeCell(doc.product)}</span></p>
        <p><b>TRANSACTION:</b><span>${tradeCell(doc.transaction)}</span></p>
      </div>
      <div class="trade-box mark">
        <h3>Shipping Mark:</h3>
        <pre>${tradeCell(doc.shippingMark)}</pre>
      </div>
    </div>
    <table class="trade-doc-table">
      <thead><tr><th>No.</th><th>Yarn No.</th><th>Count</th><th>Composition</th><th>Color</th><th>N.W(KG)</th>${isPacking ? "<th>G.W(KG)</th><th>Packages</th>" : "<th>Unit Price</th><th>Amount</th>"}</tr></thead>
      <tbody>${lines.map((line, index) => {
        const amount = Number(line.nw || 0) * Number(line.unitPrice || 0);
        return `<tr><td>${index + 1}</td><td>${tradeCell(line.yarnNo)}</td><td>${tradeCell(line.count)}</td><td>${tradeCell(line.composition)}</td><td>${tradeCell(line.color)}</td><td>${number(line.nw || 0)}</td>${isPacking ? `<td>${number(line.gw || 0)}</td><td>${line.packages ? number(line.packages) : ""}</td>` : `<td>${line.unitPrice ? number(line.unitPrice) : ""}</td><td>${amount ? number(amount) : "0"}</td>`}</tr>`;
      }).join("")}</tbody>
      <tfoot><tr><td colspan="5">TOTAL:</td><td>${number(totals.nw)}</td>${isPacking ? `<td>${number(totals.gw)}</td><td></td>` : `<td></td><td>${number(totals.amount)}</td>`}</tr></tfoot>
    </table>
    ${isPacking ? "" : `<div class="trade-summary-boxes"><div><h3>Deposit</h3><p>USD <b>${number(doc.deposit || 0)}</b></p></div><div><h3>Total Value</h3><p>USD <b>${number(doc.totalValue || Math.max(0, totals.amount - Number(doc.deposit || 0)))}</b></p></div></div>`}
  </div>`;
}

function renderIntl() {
  const docs = currentRows(state.tradeDocs || []).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  if (!activeTradeDocId && docs[0]) activeTradeDocId = docs[0].id;
  if (activeTradeDocId && !docs.some((doc) => doc.id === activeTradeDocId)) activeTradeDocId = docs[0]?.id || "";
  $("#tradeDocCount").textContent = `${docs.length} 筆`;
  $("#tradeDocRows").innerHTML = docs.map((doc) => {
    const totals = tradeTotals(doc.lines || []);
    return `<tr class="${doc.id === activeTradeDocId ? "selected-row" : ""}" data-trade-select="${doc.id}"><td>${normalizeTradeNo(doc.no)}</td><td>${doc.date || "-"}</td><td>${doc.company || "-"}</td><td>${doc.from || "-"}</td><td>${doc.product || "-"}</td><td class="num">${number(totals.nw)}</td><td class="num">${number(totals.amount)}</td><td><div class="row-actions"><button class="small-btn" data-select-trade-doc="${doc.id}" type="button" aria-label="瀏覽"><i data-lucide="eye"></i></button>${rowActions("tradeDoc", doc.id, true)}</div></td></tr>`;
  }).join("") || emptyRow(8);
  const select = $("#tradeDocSelect");
  if (select) {
    select.innerHTML = docs.map((doc) => `<option value="${doc.id}" ${doc.id === activeTradeDocId ? "selected" : ""}>${normalizeTradeNo(doc.no)}｜${doc.date || "-"}｜${escapeHtml(doc.company || "-")}</option>`).join("") || `<option value="">尚無單據</option>`;
    select.disabled = !docs.length;
  }
  const previewMode = intlTab === "packing" ? "packing" : "invoice";
  $("#tradePreview").innerHTML = renderTradeSheet(activeTradeDoc() || docs[0], previewMode);
}

function tradeWordHtml(doc, mode) {
  const title = mode === "packing" ? "COMMERCIAL PACKING" : "COMMERCIAL INVOICE";
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>${tradeWordStyles()}</style>
</head>
<body>${renderTradeSheet(doc, mode)}</body>
</html>`;
}

function tradeWordStyles() {
  return `
    @page { size: A4 landscape; margin: 8mm; }
    body { margin: 0; font-family: "Courier New", "Microsoft JhengHei", monospace; color: #101010; background: #fff; }
    .trade-document { width: 100%; box-sizing: border-box; padding: 7mm; font-weight: 700; border: 2px solid #1f527c; }
    .trade-doc-title { padding: 10px 12px; background: #1f527c; color: #fff; text-align: center; font-size: 24pt; letter-spacing: 2px; border-bottom: 4px solid #d9d3b8; }
    .trade-doc-meta { padding: 8px 0; text-align: right; color: #1f527c; font-size: 12pt; }
    .trade-info-grid { display: table; width: 100%; table-layout: fixed; margin: 10px 0 16px; border-spacing: 8px 0; }
    .trade-box { display: table-cell; width: 33.33%; vertical-align: top; border: 1px solid #1f527c; }
    .trade-box h3 { margin: 0; padding: 7px; text-align: center; background: #bed8ee; font-size: 13pt; border-bottom: 1px solid #1f527c; }
    .trade-box.traffic h3 { background: #d9d3b8; }
    .trade-box.mark h3 { background: #dfd9e9; }
    .trade-box.mark pre { min-height: 74px; margin: 0; padding: 8px; background: #ffe79d; text-align: center; white-space: pre-wrap; font: inherit; }
    .trade-box p { margin: 0; }
    .trade-box b { display: inline-block; width: 34%; padding: 4px; box-sizing: border-box; background: #f4f4f4; }
    .trade-box span { display: inline-block; width: 64%; padding: 4px; box-sizing: border-box; background: #fff; word-break: break-word; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #000; padding: 4px; text-align: center; font-size: 8.5pt; word-break: break-word; }
    th { background: #1f527c; color: #fff; }
    tbody tr:nth-child(even) td { background: #f8fbfb; }
    .trade-document.packing tbody tr td { background: #fff6d8; }
    tfoot td { font-weight: 900; }
    .auto-note { display: none; }
    .trade-summary-boxes { display: table; margin-top: 14px; }
    .trade-summary-boxes div { display: table-cell; min-width: 180px; padding: 8px 20px 8px 0; }
  `;
}

function downloadTradeWord() {
  const doc = activeTradeDoc();
  if (!doc) return toast("請先建立國貿單據");
  const mode = intlTab === "packing" ? "packing" : "invoice";
  const title = mode === "packing" ? "PACKING" : "INVOICE";
  const html = tradeWordHtml(doc, mode);
  const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${normalizeTradeNo(doc.no)}_${title}.doc`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function pdfText(doc, text, x, y, options = {}) {
  const maxWidth = options.maxWidth || 30;
  const lines = doc.splitTextToSize(String(text || ""), maxWidth);
  doc.text(lines, x, y, options);
  return y + (lines.length * 4.8);
}

function drawPdfBox(pdf, x, y, w, h, title, rows) {
  pdf.setDrawColor(31, 82, 124);
  pdf.setLineWidth(0.35);
  pdf.rect(x, y, w, h);
  pdf.line(x, y + 9, x + w, y + 9);
  pdf.setFont("courier", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(31, 82, 124);
  pdf.text(title, x + w / 2, y + 6.2, { align: "center" });
  let rowY = y + 15;
  pdf.setFontSize(9);
  rows.forEach(([label, value]) => {
    pdf.setFont("courier", "bold");
    pdf.setTextColor(0, 0, 0);
    pdf.text(label, x + 3, rowY);
    pdf.setFont("courier", "normal");
    pdf.text(pdf.splitTextToSize(String(value || ""), w - 32), x + 30, rowY);
    rowY += 7;
  });
}

function drawTradePdfHeader(pdf, tradeDoc, mode) {
  const isPacking = mode === "packing";
  const title = isPacking ? "COMMERCIAL PACKING" : "COMMERCIAL INVOICE";
  pdf.setFont("courier", "bold");
  pdf.setDrawColor(31, 82, 124);
  pdf.setLineWidth(0.5);
  pdf.line(10, 10, 287, 10);
  pdf.line(10, 25, 287, 25);
  pdf.setTextColor(31, 82, 124);
  pdf.setFontSize(20);
  pdf.text(title, 148.5, 20, { align: "center" });
  pdf.setTextColor(31, 82, 124);
  pdf.setFontSize(11);
  pdf.text(`NO: ${normalizeTradeNo(tradeDoc.no)}`, 285, 32, { align: "right" });
  drawPdfBox(pdf, 10, 36, 86, 48, isPacking ? "BUYER (Linked from Invoice)" : "BUYER INFORMATION", [
    ["Company:", tradeDoc.company],
    ["Consignee:", tradeDoc.consignee],
    ["Phone:", tradeDoc.phone],
    ["Address:", tradeDoc.address],
  ]);
  drawPdfBox(pdf, 106, 36, 82, 48, "Traffic information", [
    ["DATE:", String(tradeDoc.date || "").replaceAll("-", "/")],
    ["FROM:", tradeDoc.from],
    ["PRODUCT:", tradeDoc.product],
    ["TRANS:", tradeDoc.transaction],
  ]);
  drawPdfBox(pdf, 198, 36, 89, 48, "Shipping Mark:", []);
  pdf.setTextColor(0, 0, 0);
  pdf.setFont("courier", "bold");
  pdf.setFontSize(11);
  pdf.text(pdf.splitTextToSize(String(tradeDoc.shippingMark || ""), 76), 242.5, 54, { align: "center" });
}

function drawTradePdfTable(pdf, tradeDoc, mode) {
  const isPacking = mode === "packing";
  const lines = tradeDoc.lines || [];
  const totals = tradeTotals(lines);
  const columns = isPacking
    ? [
      ["No.", 12], ["Yarn No.", 42], ["Count", 24], ["Composition", 70], ["Color", 28], ["N.W(KG)", 28], ["G.W(KG)", 28], ["Packages", 35],
    ]
    : [
      ["No.", 12], ["Yarn No.", 42], ["Count", 24], ["Composition", 70], ["Color", 28], ["N.W(KG)", 28], ["Unit Price", 30], ["Amount", 33],
    ];
  let y = 92;
  const x0 = 10;
  const rowH = 8;
  const header = () => {
    let x = x0;
    pdf.setDrawColor(31, 82, 124);
    pdf.setTextColor(31, 82, 124);
    pdf.setFont("courier", "bold");
    pdf.setFontSize(9);
    columns.forEach(([name, width]) => {
      pdf.rect(x, y, width, rowH);
      pdf.text(name, x + width / 2, y + 5.4, { align: "center" });
      x += width;
    });
    y += rowH;
    pdf.setTextColor(0, 0, 0);
  };
  header();
  pdf.setFontSize(8.5);
  const drawRow = (cells) => {
    if (y > 190) {
      pdf.addPage();
      y = 16;
      header();
    }
    let x = x0;
    pdf.setDrawColor(31, 82, 124);
    pdf.setTextColor(0, 0, 0);
    cells.forEach((cell, index) => {
      const width = columns[index][1];
      pdf.rect(x, y, width, rowH);
      pdf.text(pdf.splitTextToSize(String(cell || ""), width - 3), x + width / 2, y + 5.2, { align: "center" });
      x += width;
    });
    y += rowH;
  };
  lines.forEach((line, index) => {
    const amount = Number(line.nw || 0) * Number(line.unitPrice || 0);
    drawRow(isPacking
      ? [index + 1, line.yarnNo, line.count, line.composition, line.color, number(line.nw || 0), number(line.gw || 0), line.packages ? number(line.packages) : ""]
      : [index + 1, line.yarnNo, line.count, line.composition, line.color, number(line.nw || 0), line.unitPrice ? number(line.unitPrice) : "", amount ? number(amount) : "0"]
    );
  });
  drawRow(isPacking ? ["", "", "", "", "TOTAL:", number(totals.nw), number(totals.gw), ""] : ["", "", "", "", "TOTAL:", number(totals.nw), "", number(totals.amount)]);
  if (!isPacking) {
    y += 8;
    pdf.setFont("courier", "bold");
    pdf.setFontSize(10);
    pdf.rect(10, y, 46, 16);
    pdf.text("Deposit", 33, y + 6, { align: "center" });
    pdf.text(`USD ${number(tradeDoc.deposit || 0)}`, 33, y + 13, { align: "center" });
    pdf.rect(76, y, 54, 16);
    pdf.text("Total Value", 103, y + 6, { align: "center" });
    pdf.text(`USD ${number(tradeDoc.totalValue || Math.max(0, totals.amount - Number(tradeDoc.deposit || 0)))}`, 103, y + 13, { align: "center" });
  }
}

function downloadTradePdf() {
  const tradeDoc = activeTradeDoc();
  if (!tradeDoc) return toast("請先建立國貿單據");
  if (!window.jspdf?.jsPDF) return toast("PDF 工具載入中，請稍後再試");
  const mode = intlTab === "packing" ? "packing" : "invoice";
  const title = mode === "packing" ? "PACKING" : "INVOICE";
  const pdf = new window.jspdf.jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  drawTradePdfHeader(pdf, tradeDoc, mode);
  drawTradePdfTable(pdf, tradeDoc, mode);
  pdf.save(`${normalizeTradeNo(tradeDoc.no)}_${title}.pdf`);
}

function renderAll() {
  applyAppearanceSettings();
  syncSelects();
  renderDashboard();
  renderProducts();
  renderPartners();
  renderDocs("purchase");
  renderDocs("sale");
  renderInventory();
  renderInvoices();
  renderTracking();
  renderProduction();
  renderLive();
  renderShipments();
  renderLiveSales();
  renderKnitters();
  renderStaff();
  renderLeave();
  renderApprovals();
  renderPayroll();
  renderIntl();
  renderGrowth();
  renderSettings();
  if (window.lucide) window.lucide.createIcons();
  if (currentLang === "zh-CN") applyLanguage();
}

function setView(view) {
  if (currentUser && !hasPermission(view)) {
    toast("沒有此分頁權限");
    view = ALL_VIEWS.find(hasPermission) || "dashboard";
  }
  activeView = view;
  $$(".view").forEach((el) => el.classList.toggle("active", el.id === view));
  $$(".nav-item").forEach((el) => el.classList.toggle("active", el.dataset.view === navViewFor(view)));
  $$("[data-system-tab]").forEach((el) => el.classList.toggle("active", el.dataset.systemTab === view));
  $("#viewTitle").textContent = viewLabel(view);
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

function setApprovalTab(tab) {
  approvalTab = tab;
  $$("[data-approval-tab]").forEach((button) => button.classList.toggle("active", button.dataset.approvalTab === tab));
  $$("[data-approval-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.approvalPanel === tab));
  renderApprovals();
}

function setPayrollTab(tab) {
  payrollTab = tab;
  $$("[data-payroll-tab]").forEach((button) => button.classList.toggle("active", button.dataset.payrollTab === tab));
  $$("[data-payroll-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.payrollPanel === tab));
  renderPayroll();
}

function setIntlTab(tab) {
  intlTab = tab;
  $$("[data-intl-tab]").forEach((button) => button.classList.toggle("active", button.dataset.intlTab === tab));
  $$("[data-intl-panel]").forEach((panel) => panel.classList.toggle("active", panel.dataset.intlPanel === tab));
  $$("[data-intl-preview]").forEach((panel) => panel.classList.toggle("active", tab === "invoice" || tab === "packing"));
  renderIntl();
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

function setStaffEditMode(editing) {
  $("#addStaffBtn").disabled = editing;
  $("#updateStaffBtn").disabled = !editing;
}

function setPositionEditMode(editing) {
  $("#addPositionBtn").disabled = editing;
  $("#updatePositionBtn").disabled = !editing;
}

function fillForm(form, data) {
  Object.entries(data).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value;
  });
  if (form.id === "sellProductForm") {
    updatePackageCount();
    renderProductImagePreview(form.elements.imageData.value);
  }
  if (form.id === "staffForm") {
    form.elements.role.value = normalizeStaffRole(form.elements.role.value);
    if (form.elements.accountPassword) form.elements.accountPassword.value = "";
    editingStaffId = form.elements.id?.value || "";
    setStaffEditMode(Boolean(form.elements.id?.value));
    renderImagePreview("staffAvatarPreview", form.elements.avatarData?.value || "");
  }
  if (form.id === "positionForm") {
    form.elements.oldName.value = "";
    setPositionEditMode(false);
  }
  if (form.id === "sampleForm") {
    renderImagePreview("sampleImagePreview", form.elements.imageData?.value || "");
  }
}

function resetForm(form) {
  form.reset();
  if (form.elements.id) form.elements.id.value = "";
  if (form.elements.date) form.elements.date.value = today();
  if (form.elements.contractDate) form.elements.contractDate.value = today();
  if (form.elements.receivedDate && form.id !== "sampleForm") form.elements.receivedDate.value = today();
  if (form.elements.startDate) form.elements.startDate.value = today();
  if (form.elements.endDate) form.elements.endDate.value = today();
  if (form.id === "growthForm") {
    form.elements.date.value = today();
    form.elements.xp.value = 10;
  }
  if (form.id === "invoiceUploadForm") {
    form.elements.fileData.value = "";
    form.elements.fileName.value = "";
    form.elements.fileType.value = "";
    $("#invoiceFilePreview").textContent = "支援 JPG、PNG、WEBP、PDF，單檔小於 8MB";
    form.querySelectorAll("[data-invoice-line]").forEach((row, index) => {
      if (index > 0) row.remove();
      row.querySelectorAll("input").forEach((input) => input.value = "");
      row.querySelector("[name='lineTaxRate']").value = "13%";
    });
  }
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
    editingStaffId = "";
    form.elements.avatarData.value = "";
    renderImagePreview("staffAvatarPreview", "");
    setStaffTab(staffTab);
    setStaffEditMode(false);
  }
  if (form.id === "growthLevelForm") {
    renderGrowthLevelNameInputs();
  }
  if (form.id === "positionForm") {
    form.elements.oldName.value = "";
    setPositionEditMode(false);
  }
  if (form.id === "sampleForm") {
    form.elements.imageData.value = "";
    renderImagePreview("sampleImagePreview", "");
  }
  if (form.id === "yarnShipmentForm") {
    form.elements.imageData.value = "";
    renderImagePreview("yarnShipmentImagePreview", "");
    renderYarnShipmentLineInputs([], 1);
    updateYarnShipmentStudio();
  }
  if (form.id === "liveSaleForm") {
    updateLiveSaleNet();
  }
  if (["adminPayrollForm", "livePayrollForm", "partnerBonusForm"].includes(form.id)) {
    updatePayrollStaff(form);
    if (form.id === "adminPayrollForm") updateAdminPayrollCalc();
    if (form.id === "livePayrollForm") updateLivePayrollCalc();
    if (form.id === "partnerBonusForm") updatePartnerBonusCalc();
  }
  if (form.id === "tradeForm") {
    form.elements.no.value = generateTradeNo();
    form.elements.date.value = today();
    form.elements.from.value = "TAIWAN";
    form.elements.product.value = "YARN";
    form.elements.transaction.value = "T/T";
    renderTradeLineInputs([], 5);
    updateTradeAutoFields();
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

function handleImageUpload(event, formId, previewId, fieldName = "imageData") {
  const file = event.target.files?.[0];
  const form = $(`#${formId}`);
  if (!file || !form) return;
  if (!file.type.startsWith("image/")) {
    toast("請選擇圖片檔");
    event.target.value = "";
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    toast("圖片不可超過 2MB");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    form.elements[fieldName].value = reader.result;
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

function handleBackgroundImage(event) {
  const file = event.target.files?.[0];
  const form = $("#appearanceForm");
  if (!file || !form) return;
  if (!file.type.startsWith("image/")) {
    toast("請上傳圖片檔案");
    event.target.value = "";
    return;
  }
  if (file.size > MAX_BACKGROUND_BYTES) {
    toast("背景圖不可超過 2MB");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      form.elements.backgroundImage.value = reader.result;
      state.settings.appearance = {
        ...(state.settings.appearance || {}),
        backgroundColor: form.elements.backgroundColor.value || "#fffaf0",
        backgroundImage: reader.result,
        backgroundImageName: file.name,
        backgroundImageSize: file.size,
        backgroundImageWidth: image.naturalWidth,
        backgroundImageHeight: image.naturalHeight,
      };
      saveState();
      applyAppearanceSettings();
      renderBackgroundPreview();
      toast("背景圖已套用");
    };
    image.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function handleInvoiceFile(event) {
  const file = event.target.files?.[0];
  const form = $("#invoiceUploadForm");
  if (!file || !form) return;
  const allowed = file.type.startsWith("image/") || file.type === "application/pdf";
  if (!allowed) {
    toast("發票附件請上傳圖片或 PDF");
    event.target.value = "";
    return;
  }
  if (file.size > MAX_INVOICE_FILE_BYTES) {
    toast("發票附件不可超過 8MB");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    form.elements.fileData.value = reader.result;
    form.elements.fileName.value = file.name;
    form.elements.fileType.value = file.type;
    $("#invoiceFilePreview").textContent = `${file.name} · ${formatBytes(file.size)}`;
  };
  reader.readAsDataURL(file);
}

function saveAppearanceSettings(form) {
  const data = Object.fromEntries(new FormData(form));
  state.settings.appearance = {
    ...(state.settings.appearance || {}),
    backgroundColor: data.backgroundColor || "#fffaf0",
    backgroundImage: data.backgroundImage || "",
  };
  saveState();
  applyAppearanceSettings();
  renderBackgroundPreview();
  toast("外觀設定已儲存");
}

function updateBackgroundColor(value, persist = false) {
  state.settings.appearance = {
    ...(state.settings.appearance || {}),
    backgroundColor: value || "#fffaf0",
  };
  applyAppearanceSettings();
  if (persist) saveState();
}

function clearBackgroundImage() {
  state.settings.appearance = {
    ...(state.settings.appearance || {}),
    backgroundImage: "",
    backgroundImageName: "",
    backgroundImageSize: 0,
    backgroundImageWidth: 0,
    backgroundImageHeight: 0,
  };
  const form = $("#appearanceForm");
  if (form) {
    form.elements.backgroundImage.value = "";
    $("#backgroundImageInput").value = "";
  }
  saveState();
  applyAppearanceSettings();
  renderBackgroundPreview();
  toast("背景圖已移除");
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
  const existing = data.id ? state.staff.find((item) => item.id === data.id) : null;
  const payload = {
    id: data.id || uid("stf"),
    code: data.code.trim(),
    name: data.name.trim(),
    gender: data.gender || "女",
    dept: data.dept,
    title: data.title,
    role: normalizeStaffRole(data.role),
    phone: normalizePhone(data.phone),
    avatarData: data.avatarData || "",
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
    createdAt: data.id ? (existing?.createdAt || Date.now()) : Date.now(),
  };
  if (payload.phone && phoneDigits(payload.phone).length < 8) return toast("帳號手機號格式不正確");
  if (data.accountPassword && !payload.phone) return toast("請先填寫登入帳號手機號");
  if (payload.phone && state.staff.some((item) => item.id !== payload.id && normalizePhone(item.phone) === payload.phone)) return toast("此帳號手機號已存在於人事資料");
  state.staff = data.id ? state.staff.map((item) => item.id === data.id ? payload : item) : [...state.staff, payload];
  syncUserAccountFromStaff(payload, existing?.phone, data.accountPassword || "");
  saveState();
  resetForm(form);
  toast(data.id ? "員工資料已修改" : "員工資料已新增");
  renderAll();
}

function addStaff(form) {
  if (form.elements.id.value) return toast("目前正在修改人事資料，請先清空再新增");
  upsertStaff(form);
}

function updateStaff(form) {
  if (!form.elements.id.value && editingStaffId) form.elements.id.value = editingStaffId;
  if (!form.elements.id.value) return toast("請先點選人事資料清單中的編輯");
  upsertStaff(form);
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

function invoiceLinesFromForm(form) {
  return [...form.querySelectorAll("[data-invoice-line]")].map((row) => {
    const qty = Number(row.querySelector("[name='lineQty']").value || 0);
    const unitPrice = Number(row.querySelector("[name='lineUnitPrice']").value || 0);
    const amount = Number(row.querySelector("[name='lineAmount']").value || (qty * unitPrice));
    return {
      itemName: row.querySelector("[name='lineItemName']").value.trim(),
      spec: row.querySelector("[name='lineSpec']").value.trim(),
      unit: row.querySelector("[name='lineUnit']").value.trim(),
      qty,
      unitPrice,
      amount,
      taxRate: row.querySelector("[name='lineTaxRate']").value.trim(),
      taxAmount: Number(row.querySelector("[name='lineTaxAmount']").value || 0),
    };
  }).filter((line) => line.itemName || line.spec || line.qty || line.amount || line.taxAmount);
}

function addInvoiceUpload(form) {
  const data = Object.fromEntries(new FormData(form));
  const lines = invoiceLinesFromForm(form);
  if (!data.fileData) return toast("請上傳發票附件");
  if (!data.invoiceNo?.trim()) return toast("請填寫發票號碼");
  if (!data.buyerName?.trim() || !data.buyerTaxId?.trim()) return toast("購買方名稱與納稅識別號/統一社會信用代碼必填");
  if (!data.sellerName?.trim() || !data.sellerTaxId?.trim()) return toast("銷售方名稱與納稅識別號/統一社會信用代碼必填");
  if (!lines.length) return toast("請至少填寫一筆發票明細");
  state.invoiceUploads = [...(state.invoiceUploads || []), {
    id: uid("invoice"),
    invoiceType: data.invoiceType,
    invoiceNo: data.invoiceNo.trim(),
    invoiceCode: data.invoiceCode?.trim() || "",
    invoiceDate: data.invoiceDate,
    checkCode: data.checkCode?.trim() || "",
    buyerName: data.buyerName.trim(),
    buyerTaxId: data.buyerTaxId.trim(),
    buyerAddressPhone: data.buyerAddressPhone?.trim() || "",
    buyerBankAccount: data.buyerBankAccount?.trim() || "",
    sellerName: data.sellerName.trim(),
    sellerTaxId: data.sellerTaxId.trim(),
    sellerAddressPhone: data.sellerAddressPhone?.trim() || "",
    sellerBankAccount: data.sellerBankAccount?.trim() || "",
    totalAmount: Number(data.totalAmount || 0),
    taxAmount: Number(data.taxAmount || 0),
    totalWithTax: Number(data.totalWithTax || 0),
    drawer: data.drawer?.trim() || "",
    payee: data.payee?.trim() || "",
    reviewer: data.reviewer?.trim() || "",
    remark: data.remark?.trim() || "",
    fileData: data.fileData,
    fileName: data.fileName,
    fileType: data.fileType,
    lines,
    createdAt: Date.now(),
  }];
  saveState();
  resetForm(form);
  toast("發票資料已上傳");
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
  const map = { product: "products", partner: "partners", purchase: "purchases", sale: "sales", invoiceUpload: "invoiceUploads", tracking: "yarnTracks", live: "liveShows", liveSale: "liveSales", shipment: "shipments", staff: "staff", leave: "leaveRequests", announcement: "announcements", knitter: "knitters", sample: "samples", yarnShipment: "yarnShipments", trip: "tripRequests", purchaseRequest: "purchaseRequests", proposal: "proposalRequests", adminPayroll: "adminPayrolls", livePayroll: "livePayrolls", partnerBonus: "partnerBonuses", tradeDoc: "tradeDocs", growthRecord: "growthRecords" };
  if (type === "staff") {
    const staff = (state.staff || []).find((item) => item.id === id);
    pruneUserAccountsForDeletedStaff(id, staff?.phone);
    state.growthRecords = (state.growthRecords || []).filter((record) => record.staffId !== id);
    if (editingStaffId === id) editingStaffId = "";
  }
  state[map[type]] = state[map[type]].filter((item) => item.id !== id);
  if (type === "tradeDoc" && activeTradeDocId === id) activeTradeDocId = "";
  saveState();
  toast(type === "staff" ? "人事資料與系統權限已刪除" : "資料已刪除");
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

function addGrowthRecord(form) {
  const data = Object.fromEntries(new FormData(form));
  const xp = Number(data.xp || 0);
  if (!data.staffId) return toast("請先選擇人員");
  if (xp === 0) return toast("經驗值不能為 0，可輸入正數或負數");
  state.growthRecords = [
    { id: uid("grow"), staffId: data.staffId, category: data.category, xp, date: data.date || today(), note: data.note?.trim() || "", createdAt: Date.now() },
    ...(state.growthRecords || []),
  ];
  saveState();
  resetForm(form);
  toast("養成紀錄已新增");
  renderAll();
}

function saveGrowthLevelName(form) {
  const formData = new FormData(form);
  const names = {};
  for (let level = 1; level <= MAX_GROWTH_LEVEL; level += 1) {
    const name = String(formData.get(`level_${level}`) || "").trim();
    if (name) names[level] = name;
  }
  if (!Object.keys(names).length) return toast("請至少輸入一個等級名稱");
  state.settings.growthLevelNames = names;
  saveState();
  renderGrowthLevelNameInputs();
  toast("等級名稱已批量儲存");
  renderAll();
}

function addApprovalRequest(form, key, prefix, transform) {
  const data = Object.fromEntries(new FormData(form));
  const payload = {
    ...transform(data),
    status: "待審批",
    comment: "",
  };
  state[key] = [...(state[key] || []), { id: uid(prefix), createdAt: Date.now(), ...payload }];
  saveState();
  resetForm(form);
  toast("申請已送出");
  renderAll();
}

function approveRequest(type, id, status) {
  const map = { leave: "leaveRequests", trip: "tripRequests", purchaseRequest: "purchaseRequests", proposal: "proposalRequests" };
  const key = map[type];
  if (!key) return;
  state[key] = (state[key] || []).map((item) => item.id === id ? { ...item, status, approvedAt: Date.now() } : item);
  saveState();
  toast(status === "已通過" ? "審批已通過" : "審批已駁回");
  renderAll();
}

function updatePayrollStaff(form) {
  if (!form?.elements.staffId) return;
  const staff = staffById(form.elements.staffId.value);
  if (form.elements.gender) form.elements.gender.value = staff?.gender || "";
  if (form.elements.joinDate && staff?.joinDate) form.elements.joinDate.value = staff.joinDate;
}

function updateAdminPayrollCalc() {
  const form = $("#adminPayrollForm");
  updatePayrollStaff(form);
  const base = Number(form.elements.baseSalary.value || 0);
  const data = Object.fromEntries(new FormData(form));
  const insurance = insuranceFromBase(base);
  const net = base + allowanceTotal(data) - insurance;
  form.elements.insurance.value = insurance;
  form.elements.socialDetail.value = socialDetail(base);
  form.elements.netSalary.value = Math.max(0, Math.round(net));
}

function updateLivePayrollCalc() {
  const form = $("#livePayrollForm");
  updatePayrollStaff(form);
  const base = Number(form.elements.baseSalary.value || 0);
  const commission = Number(form.elements.commission.value || 0) / 100;
  const netRevenue = Number(form.elements.netRevenue.value || 0);
  const data = Object.fromEntries(new FormData(form));
  const insurance = insuranceFromBase(base);
  const net = base + commission * netRevenue + allowanceTotal(data, false) - insurance;
  form.elements.insurance.value = insurance;
  form.elements.socialDetail.value = socialDetail(base);
  form.elements.netSalary.value = Math.max(0, Math.round(net));
}

function updatePartnerBonusCalc() {
  const form = $("#partnerBonusForm");
  updatePayrollStaff(form);
  const amount = Number(form.elements.netProfit.value || 0) * Number(form.elements.bonusRate.value || 0) / 100;
  form.elements.bonusAmount.value = Math.round(amount);
}

function addAdminPayroll(form) {
  updateAdminPayrollCalc();
  const data = Object.fromEntries(new FormData(form));
  state.adminPayrolls = [...(state.adminPayrolls || []), { id: uid("admin-pay"), createdAt: Date.now(), ...data, ...payrollNumbers(data), socialDetail: data.socialDetail }];
  saveState();
  resetForm(form);
  toast("行政薪資已儲存");
  renderAll();
}

function addLivePayroll(form) {
  updateLivePayrollCalc();
  const data = Object.fromEntries(new FormData(form));
  state.livePayrolls = [...(state.livePayrolls || []), { id: uid("live-pay"), createdAt: Date.now(), ...data, ...payrollNumbers(data), commission: Number(data.commission || 0), netRevenue: Number(data.netRevenue || 0), socialDetail: data.socialDetail }];
  saveState();
  resetForm(form);
  toast("直播薪資已儲存");
  renderAll();
}

function addPartnerBonus(form) {
  updatePartnerBonusCalc();
  const data = Object.fromEntries(new FormData(form));
  state.partnerBonuses = [...(state.partnerBonuses || []), { id: uid("partner-bonus"), createdAt: Date.now(), ...data, gender: data.gender || staffGender(data.staffId), netProfit: Number(data.netProfit || 0), bonusRate: Number(data.bonusRate || 0), bonusAmount: Number(data.bonusAmount || 0) }];
  saveState();
  resetForm(form);
  toast("合夥人紅利已儲存");
  renderAll();
}

function addKnitter(form) {
  const data = Object.fromEntries(new FormData(form));
  const styles = new FormData(form).getAll("styles");
  if (!data.name?.trim() && !data.studioName?.trim()) return toast("織女姓名與公司&工作室名稱至少填寫一個");
  if (!styles.length) return toast("請至少選擇一個樣衣款式");
  const prices = Object.fromEntries(styles.map((style) => [style, Number(data[`price_${style}`] || 0)]));
  const existing = data.id ? (state.knitters || []).find((item) => item.id === data.id) : null;
  const payload = {
    id: data.id || uid("knitter"),
    contractDate: data.contractDate,
    name: data.name.trim(),
    studioName: data.studioName?.trim() || "",
    identityCode: data.identityCode?.trim() || "",
    contactPhone: data.contactPhone?.trim() || "",
    wechat: data.wechat?.trim() || "",
    qq: data.qq?.trim() || "",
    contactAddress: data.contactAddress?.trim() || "",
    styles,
    prices,
    leadTime: Number(data.leadTime || 0),
    tutorialAvailable: data.tutorialAvailable,
    settlementDate: data.settlementDate,
    createdAt: existing?.createdAt || Date.now(),
  };
  state.knitters = data.id
    ? (state.knitters || []).map((item) => item.id === data.id ? payload : item)
    : [...(state.knitters || []), payload];
  saveState();
  resetForm(form);
  toast(data.id ? "織女資料已修改" : "織女資料已新增");
  renderAll();
}

function addSample(form) {
  const data = Object.fromEntries(new FormData(form));
  if (!data.knitterId) return toast("請先建立織女資料");
  const existing = data.id ? (state.samples || []).find((item) => item.id === data.id) : null;
  const payload = {
    id: data.id || uid("sample"),
    knitterId: data.knitterId,
    receivedDate: data.receivedDate || "",
    leadDays: Number(data.leadDays || findKnitter(data.knitterId)?.leadTime || 0),
    sendDate: data.sendDate,
    imageData: data.imageData || existing?.imageData || "",
    status: data.status,
    style: data.style,
    hasTutorial: data.hasTutorial,
    price: Number(data.price || 0),
    settled: data.settled,
    createdAt: existing?.createdAt || Date.now(),
  };
  state.samples = data.id
    ? (state.samples || []).map((item) => item.id === data.id ? payload : item)
    : [...(state.samples || []), payload];
  saveState();
  resetForm(form);
  toast(data.id ? "樣衣&配件已修改" : "樣衣&配件已新增");
  renderAll();
}

function updateYarnShipmentStudio() {
  const form = $("#yarnShipmentForm");
  if (!form?.elements.studioName || !form.elements.knitterId) return;
  const knitter = findKnitter(form.elements.knitterId.value);
  form.elements.studioName.value = knitter?.studioName || "";
}

function addYarnShipment(form) {
  const data = Object.fromEntries(new FormData(form));
  const lines = currentYarnShipmentLineDrafts();
  if (!data.knitterId) return toast("請先選擇織女資料");
  if (!lines.length) return toast("請至少新增一筆毛線明細");
  state.yarnShipments = [...(state.yarnShipments || []), {
    id: uid("yarn-ship"),
    knitterId: data.knitterId,
    trackingNo: data.trackingNo?.trim() || "",
    sendDate: data.sendDate,
    imageData: data.imageData || "",
    note: data.note?.trim() || "",
    lines,
    createdAt: Date.now(),
  }];
  saveState();
  resetForm(form);
  toast("毛線寄送紀錄已新增");
  renderAll();
}

function updateSampleLeadDays() {
  const form = $("#sampleForm");
  if (!form?.elements.leadDays || !form.elements.knitterId) return;
  if (form.elements.studioName) form.elements.studioName.value = findKnitter(form.elements.knitterId.value)?.studioName || "";
  if (form.elements.leadDays.value) return;
  const knitter = findKnitter(form.elements.knitterId.value);
  if (knitter?.leadTime) form.elements.leadDays.value = knitter.leadTime;
}

function fillKnitterForm(knitter) {
  const form = $("#knitterForm");
  if (!form || !knitter) return;
  resetForm(form);
  fillForm(form, knitter);
  const styles = new Set(knitter.styles || []);
  form.querySelectorAll("input[name='styles']").forEach((checkbox) => {
    checkbox.checked = styles.has(checkbox.value);
  });
  Object.entries(knitter.prices || {}).forEach(([style, price]) => {
    const field = form.elements[`price_${style}`];
    if (field) field.value = price;
  });
  form.elements.id.value = knitter.id;
}

function updateInlineField(type, id, field, value) {
  const map = { sample: "samples" };
  const key = map[type];
  if (!key || !Array.isArray(state[key])) return;
  state[key] = state[key].map((item) => item.id === id ? { ...item, [field]: value } : item);
  saveState();
  renderAll();
  toast("資料已更新");
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

function addTradeDoc(form) {
  const data = Object.fromEntries(new FormData(form));
  const lines = tradeLinesFromForm(form);
  if (!lines.length) return toast("請至少填寫一筆商品明細");
  const totals = tradeTotals(lines);
  const doc = {
    id: data.id || uid("trade"),
    no: normalizeTradeNo(data.no || generateTradeNo(data.id)),
    date: data.date,
    company: data.company.trim(),
    consignee: data.consignee.trim(),
    phone: data.phone.trim(),
    address: data.address.trim(),
    from: data.from.trim(),
    product: data.product.trim(),
    transaction: data.transaction.trim(),
    shippingMark: data.shippingMark.trim(),
    deposit: Number(data.deposit || 0),
    totalValue: Math.max(0, totals.amount - Number(data.deposit || 0)),
    lines,
    createdAt: data.id ? (state.tradeDocs.find((item) => item.id === data.id)?.createdAt || Date.now()) : Date.now(),
  };
  state.tradeDocs = data.id ? state.tradeDocs.map((item) => item.id === data.id ? doc : item) : [doc, ...(state.tradeDocs || [])];
  activeTradeDocId = doc.id;
  saveState();
  resetForm(form);
  toast("國貿單據已儲存");
  renderAll();
}

function upsertPosition(form) {
  const data = Object.fromEntries(new FormData(form));
  const name = data.name.trim();
  const oldName = data.oldName?.trim() || "";
  if (!name) return;
  const positions = state.settings.positions || [];
  if (positions.some((item) => item === name && item !== oldName)) return toast("職位已存在");
  if (oldName) {
    state.settings.positions = positions.map((item) => item === oldName ? name : item);
    state.staff = (state.staff || []).map((item) => item.title === oldName ? { ...item, title: name } : item);
  } else {
    state.settings.positions = [...positions, name];
  }
  saveState();
  resetForm(form);
  toast(oldName ? "職位已修改" : "職位已新增");
  renderAll();
}

function addPosition(form) {
  if (form.elements.oldName.value) return toast("目前正在修改職位，請先清空再新增");
  upsertPosition(form);
}

function updatePosition(form) {
  if (!form.elements.oldName.value) return toast("請先點選職位清單中的編輯");
  upsertPosition(form);
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
    editingStaffId = id;
    setStaffTab(staff?.employeeType || "regular");
    fillForm($("#staffForm"), staff);
    $("#staffForm").elements.id.value = id;
    setStaffEditMode(true);
    setView("staff");
  }
  if (type === "position") {
    setView("settings");
    setSettingTab("positions");
    const form = $("#positionForm");
    form.elements.oldName.value = id;
    form.elements.name.value = id;
    setPositionEditMode(true);
    form.elements.name.focus();
  }
  if (type === "knitter") {
    const knitter = (state.knitters || []).find((item) => item.id === id);
    if (!knitter) return;
    setView("knitters");
    setKnitterTab("profiles");
    fillKnitterForm(knitter);
  }
  if (type === "sample") {
    const sample = (state.samples || []).find((item) => item.id === id);
    if (!sample) return;
    setView("knitters");
    setKnitterTab("samples");
    fillForm($("#sampleForm"), sample);
    $("#sampleForm").elements.id.value = id;
    updateSampleLeadDays();
  }
  if (type === "tradeDoc") {
    const doc = state.tradeDocs.find((item) => item.id === id);
    activeTradeDocId = id;
    fillForm($("#tradeForm"), doc);
    renderTradeLineInputs(doc?.lines || [], 5);
    setView("intl");
    setIntlTab("setup");
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
    approvals: "審批系統報表",
    payroll: "會計系統報表",
    intl: "國貿系統報表",
    growth: "養成系統報表",
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
    knitters: () => reportTable(["類型", "日期", "姓名/織女", "公司&工作室", "聯繫電話", "款式", "交期/評級", "狀態", "單價/金額"], [
      ...(state.knitters || []).map((p) => ["織女資料", p.contractDate, p.name, p.studioName || "-", p.contactPhone || "-", (p.styles || []).join("、"), `${number(p.leadTime)} 天`, p.tutorialAvailable, (p.styles || []).map((style) => `${style} ${money(p.prices?.[style] || 0)}`).join("、")]),
      ...(state.samples || []).map((p) => { const info = sampleDeliveryInfo(p); const knitter = findKnitter(p.knitterId); return ["樣衣&配件", p.receivedDate, knitterName(p.knitterId), knitter?.studioName || "-", knitter?.contactPhone || "-", p.style, `${info.text} / ${info.rating}`, p.status, money(p.price)]; }),
    ]),
    shipping: () => reportTable(["單號", "日期", "國內合作商", "產品編號", "銷售產品", "缸號", "出貨包數", "單包價格", "小計", "狀態"], (state.shipments || []).map((p) => { const product = findProduct(p.productId); const partner = findPartner(p.partnerId); return [p.no, p.date, partner?.customerName || partner?.name || p.customer, product?.sku, product?.name || p.productName, p.vat, `${number(p.qty)} 包`, money(p.price), money(Number(p.qty) * Number(p.price)), p.status]; })),
    staff: () => reportTable(["編號", "姓名", "部門", "職位", "角色", "帳號／手機號", "狀態"], (state.staff || []).map((p) => [p.code, p.name, p.dept, p.title, p.role, p.phone, p.status])),
    leave: () => reportTable(["編號", "姓名", "類型", "開始日期", "結束日期", "天數", "狀態", "審批人"], (state.leaveRequests || []).map((p) => [p.code, staffName(p.staffId, p.name || "-"), p.type, p.startDate, p.endDate, p.days, p.status, staffName(p.approverId, p.approver || "-")])),
    approvals: () => reportTable(["類型", "編號", "申請人", "主旨", "日期", "金額/天數", "主管機關", "狀態"], approvalRows().map((p) => [p.typeName, p.code, staffName(p.staffId), p.title, p.date, p.amount, staffName(p.approverId), p.status])),
    payroll: () => reportTable(["類型", "姓名", "性別", "底薪/淨利", "比率", "實領"], [
      ...(state.adminPayrolls || []).map((p) => ["行政薪資", staffName(p.staffId), p.gender || staffGender(p.staffId), money(p.baseSalary), "-", money(p.netSalary)]),
      ...(state.livePayrolls || []).map((p) => ["直播薪資", staffName(p.staffId), p.gender || staffGender(p.staffId), money(p.baseSalary), `${number(p.commission)}%`, money(p.netSalary)]),
      ...(state.partnerBonuses || []).map((p) => ["合夥人紅利", staffName(p.staffId), p.gender || staffGender(p.staffId), money(p.netProfit), `${number(p.bonusRate)}%`, money(p.bonusAmount)]),
    ]),
    intl: () => reportTable(["流水編號", "DATE", "Company", "FROM", "PRODUCT", "N.W(KG)", "Amount"], (state.tradeDocs || []).map((doc) => { const totals = tradeTotals(doc.lines || []); return [doc.no, doc.date, doc.company, doc.from, doc.product, number(totals.nw), number(totals.amount)]; })),
    growth: () => reportTable(["日期", "人員", "類別", "經驗值", "說明"], (state.growthRecords || []).map((p) => [p.date, staffName(p.staffId), p.category, `${Number(p.xp) > 0 ? "+" : ""}${number(p.xp)} EXP`, p.note])),
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
      { id: "knitter-1", contractDate: "2026-05-02", name: "蘇雲娘", studioName: "雲錦手作工作室", identityCode: "91350000MA00000000", contactPhone: "13800000000", wechat: "suyunniang", qq: "100001", contactAddress: "浙江省杭州市", styles: ["無袖", "背心"], prices: { "無袖": 1200, "背心": 980 }, leadTime: 14, tutorialAvailable: "可", settlementDate: "2026-05-31", createdAt: Date.now() - 47000 },
    ],
    samples: [
      { id: "sample-1", knitterId: "knitter-1", sendDate: "2026-04-20", leadDays: 14, receivedDate: today(), imageData: "", status: "已到貨", style: "背心", hasTutorial: "是", price: 980, settled: "未支付", createdAt: Date.now() - 46000 },
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
  ensureErpTabs();
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $$("[data-action='goto']").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $$("[data-product-tab]").forEach((button) => button.addEventListener("click", () => setProductTab(button.dataset.productTab)));
  $$("[data-knitter-tab]").forEach((button) => button.addEventListener("click", () => setKnitterTab(button.dataset.knitterTab)));
  $$("[data-approval-tab]").forEach((button) => button.addEventListener("click", () => setApprovalTab(button.dataset.approvalTab)));
  $$("[data-payroll-tab]").forEach((button) => button.addEventListener("click", () => setPayrollTab(button.dataset.payrollTab)));
  $$("[data-intl-tab]").forEach((button) => button.addEventListener("click", () => setIntlTab(button.dataset.intlTab)));
  $$("[data-system-tab]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.systemTab)));
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
  $("#staffAvatarInput").addEventListener("change", (event) => handleImageUpload(event, "staffForm", "staffAvatarPreview", "avatarData"));
  $("#sampleImageInput").addEventListener("change", (event) => handleImageUpload(event, "sampleForm", "sampleImagePreview"));
  $("#yarnShipmentImageInput").addEventListener("change", (event) => handleImageUpload(event, "yarnShipmentForm", "yarnShipmentImagePreview"));
  $("#invoiceFileInput").addEventListener("change", handleInvoiceFile);
  $("#backgroundImageInput").addEventListener("change", handleBackgroundImage);
  $("#appearanceForm").addEventListener("submit", (event) => {
    event.preventDefault();
    saveAppearanceSettings(event.currentTarget);
  });
  $("#appearanceForm").elements.backgroundColor.addEventListener("input", (event) => updateBackgroundColor(event.target.value));
  $("#appearanceForm").elements.backgroundColor.addEventListener("change", (event) => {
    updateBackgroundColor(event.target.value, true);
    toast("背景顏色已套用");
  });
  $("#clearBackgroundImageBtn").addEventListener("click", clearBackgroundImage);
  $("#liveSaleRevenue").addEventListener("input", updateLiveSaleNet);
  $("#liveSaleRefund").addEventListener("input", updateLiveSaleNet);
  $("#tradeForm").addEventListener("input", updateTradeAutoFields);
  $("#addTradeLineBtn").addEventListener("click", () => addTradeLines(1));
  $("#addTenTradeLinesBtn").addEventListener("click", () => addTradeLines(10));
  $("#tradeLineInputs").addEventListener("click", (event) => {
    const remove = event.target.closest("[data-remove-trade-line]");
    if (remove) removeTradeLine(Number(remove.dataset.removeTradeLine));
  });
  $("#yarnShipmentLineInputs").addEventListener("click", (event) => {
    const remove = event.target.closest("[data-remove-yarn-line]");
    if (remove) removeYarnShipmentLine(Number(remove.dataset.removeYarnLine));
  });
  $("#addYarnShipmentLineBtn").addEventListener("click", () => addYarnShipmentLine());
  $("#addInvoiceLineBtn").addEventListener("click", addInvoiceLine);
  $("#invoiceLineInputs").addEventListener("click", (event) => {
    const remove = event.target.closest("[data-remove-invoice-line]");
    if (remove && $("#invoiceLineInputs").querySelectorAll("[data-invoice-line]").length > 1) remove.closest("[data-invoice-line]").remove();
  });
  $("#tradeDocSelect").addEventListener("change", (event) => setActiveTradeDoc(event.target.value));
  $("#tradeDocRows").addEventListener("click", (event) => {
    const selectButton = event.target.closest("[data-select-trade-doc]");
    const row = event.target.closest("[data-trade-select]");
    if (!selectButton && (event.target.closest("[data-edit]") || event.target.closest("[data-delete]"))) return;
    const id = selectButton?.dataset.selectTradeDoc || row?.dataset.tradeSelect;
    if (id) setActiveTradeDoc(id, Boolean(selectButton));
  });
  ["adminPayrollForm", "livePayrollForm", "partnerBonusForm"].forEach((formId) => {
    const form = $(`#${formId}`);
    form.addEventListener("input", () => {
      if (formId === "adminPayrollForm") updateAdminPayrollCalc();
      if (formId === "livePayrollForm") updateLivePayrollCalc();
      if (formId === "partnerBonusForm") updatePartnerBonusCalc();
    });
    form.addEventListener("change", () => {
      if (formId === "adminPayrollForm") updateAdminPayrollCalc();
      if (formId === "livePayrollForm") updateLivePayrollCalc();
      if (formId === "partnerBonusForm") updatePartnerBonusCalc();
    });
  });
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
  $("#invoiceUploadForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addInvoiceUpload(event.currentTarget);
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
  $("#tradeForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addTradeDoc(event.currentTarget);
  });
  $("#printTradeBtn").addEventListener("click", () => window.print());
  $("#downloadTradeWordBtn").addEventListener("click", downloadTradeWord);
  $("#downloadTradePdfBtn").addEventListener("click", downloadTradePdf);
  $("#knitterForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addKnitter(event.currentTarget);
  });
  $("#sampleForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addSample(event.currentTarget);
  });
  $("#sampleKnitter").addEventListener("change", updateSampleLeadDays);
  $("#yarnShipmentForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addYarnShipment(event.currentTarget);
  });
  $("#yarnShipmentKnitter").addEventListener("change", updateYarnShipmentStudio);
  $("#staffForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addStaff(event.currentTarget);
  });
  $("#updateStaffBtn").addEventListener("click", () => updateStaff($("#staffForm")));
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
  $("#updatePositionBtn").addEventListener("click", () => updatePosition($("#positionForm")));
  $$("[data-reset-form]").forEach((button) => {
    button.addEventListener("click", () => resetForm($(`#${button.dataset.resetForm}`)));
  });
  $("#leaveForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addApprovalRequest(event.currentTarget, "leaveRequests", "lev", (data) => ({ ...data, name: staffName(data.staffId), approver: staffName(data.approverId), days: Number(data.days) }));
  });
  $("#tripForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addApprovalRequest(event.currentTarget, "tripRequests", "trip", (data) => ({ ...data, amount: Number(data.amount || 0) }));
  });
  $("#purchaseRequestForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addApprovalRequest(event.currentTarget, "purchaseRequests", "pr", (data) => ({ ...data, qty: Number(data.qty || 1), amount: Number(data.amount || 0) }));
  });
  $("#proposalForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addApprovalRequest(event.currentTarget, "proposalRequests", "prop", (data) => ({ ...data }));
  });
  $("#growthForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addGrowthRecord(event.currentTarget);
  });
  $("#growthLevelForm").addEventListener("submit", (event) => {
    event.preventDefault();
    saveGrowthLevelName(event.currentTarget);
  });
  $("#adminPayrollForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addAdminPayroll(event.currentTarget);
  });
  $("#livePayrollForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addLivePayroll(event.currentTarget);
  });
  $("#partnerBonusForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addPartnerBonus(event.currentTarget);
  });

  document.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit]");
    const del = event.target.closest("[data-delete]");
    const approve = event.target.closest("[data-approve]");
    const reject = event.target.closest("[data-reject]");
    if (edit) editItem(edit.dataset.edit, edit.dataset.id);
    if (del) deleteItem(del.dataset.delete, del.dataset.id);
    if (approve) approveRequest(approve.dataset.approve, approve.dataset.id, "已通過");
    if (reject) approveRequest(reject.dataset.reject, reject.dataset.id, "已駁回");
  });
  document.addEventListener("change", (event) => {
    const inline = event.target.closest("[data-inline-update]");
    if (inline) {
      updateInlineField(inline.dataset.inlineUpdate, inline.dataset.id, inline.dataset.field, inline.value);
      return;
    }
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
  resetForm($("#invoiceUploadForm"));
  resetForm($("#trackingForm"));
  resetForm($("#liveForm"));
  resetForm($("#shipmentForm"));
  resetForm($("#liveSaleForm"));
  resetForm($("#tradeForm"));
  resetForm($("#knitterForm"));
  resetForm($("#sampleForm"));
  resetForm($("#yarnShipmentForm"));
  resetForm($("#staffForm"));
  resetForm($("#positionForm"));
  resetForm($("#leaveForm"));
  resetForm($("#tripForm"));
  resetForm($("#purchaseRequestForm"));
  resetForm($("#proposalForm"));
  resetForm($("#growthForm"));
  resetForm($("#growthLevelForm"));
  resetForm($("#adminPayrollForm"));
  resetForm($("#livePayrollForm"));
  resetForm($("#partnerBonusForm"));
  renderAll();
  setIntlTab(intlTab);
  setView(activeView);
  applyPermissions();
}

init();
