/**
 * Kho Lạnh An An — cầu nối giữa BẢN ĐIỆN THOẠI và Google Sheet đồng bộ.
 *
 * Dán toàn bộ file này vào Apps Script GẮN VỚI CHÍNH Google Sheet mà app PC đang đồng bộ
 * (mở Sheet → Tiện ích mở rộng → Apps Script). Cách triển khai: xem ../README.md.
 *
 * Đây là CỔNG DUY NHẤT vào Google Sheet — cả app PC lẫn điện thoại đều gọi Web App này, không
 * cần Google Cloud Console / Service Account / file Key. Có 2 mã truy cập riêng (Thuộc tính tập
 * lệnh):
 *   - APP_TOKEN (điện thoại): xem tồn kho, xem phiếu, tạo phiếu xuất mới, và SỬA / XÓA phiếu
 *                             còn "Chưa xử lý" (PC chưa nhận).
 *   - PC_TOKEN  (app PC):     thêm quyền ghi đè bảng tồn kho, đọc phiếu, đánh dấu đã xử lý
 *                             (các lệnh "pc.*"). KHÔNG đưa mã này cho điện thoại.
 *   - Token RIÊNG TỪNG NGƯỜI (09/2026): tạo/bật/tắt trong app PC → Cài Đặt → Điện Thoại → "Phân quyền".
 *     PC đẩy lên tab "PhanQuyen" (chỉ lưu MÃ BĂM SHA-256 của token, không lưu token gốc). Mỗi dòng có:
 *     tên người dùng (= ID đăng nhập, KHÔNG phân biệt hoa/thường), tên hiển thị (có dấu, VD "Thắng"),
 *     quyền 'xem' (chỉ xem tồn) hoặc 'xuat' (xem + tạo phiếu), danh sách kho được dùng.
 *     Điện thoại đăng nhập bằng Tên người dùng + Mã truy cập (như ID + mật khẩu). App điện thoại bản cũ
 *     (chưa gửi "nguoiDung") vẫn vào được bằng riêng mã truy cập cho tới khi cập nhật.
 *     Tài khoản "Tạo phiếu" tự sửa / xóa được phiếu CỦA CHÍNH MÌNH khi PC chưa nhận (không đụng phiếu người khác);
 *     tài khoản "Chỉ xem" không sửa / xóa. "Người tạo" trên phiếu = tên hiển thị (không tự gõ),
 *     cột "nguoiDung" của phiếu = tên người dùng (dùng để lọc "phiếu của tôi").
 *     APP_TOKEN chung (nếu còn đặt) = QUẢN TRỊ: đủ mọi quyền như trước — để máy cũ không bị gián đoạn.
 *     Quyền 'quantri' (Quản trị, 09/2026): như 'xuat' + thêm / sửa / khóa / xóa người dùng ngay trên app điện thoại
 *     (Cài đặt → Quản lý người dùng; lệnh pq.list / pq.luu / pq.xoa). Mọi tài khoản riêng tự đổi mật khẩu
 *     của mình ở Cài đặt (lệnh doiMa). Tab PhanQuyen giờ có thêm cột "maTruyCap"
 *     (mã dạng chữ, để xem lại được trên điện thoại + app PC) — CHỈ dùng nội bộ.
 *
 *   - TÀI KHOẢN DÙNG CHUNG của app PC C# (PC 1.104, 25/11/2026): trước là 1 Google Sheet + 1 Apps Script RIÊNG (TaiKhoan.gs),
 *     nay gộp vào đây — tab "TaiKhoan", lệnh list / save / replaceAll (xem phần "TÀI KHOẢN DÙNG CHUNG" cuối file). Hai mã của phần này
 *     (TK_MA_DOC / TK_MA_QUAN_TRI) nằm ở Thuộc tính tập lệnh, do app PC tự đặt (lệnh pc.tkCaiMa) — file này giống nhau cho mọi người,
 *     KHÔNG phải điền mã gì vào file. Điện thoại không dùng phần này.
 *
 * Quy ước dữ liệu PHẢI khớp với app PC (main.js + sheets-webapp-client.js):
 *   - Tab TonKho_M02 / TonKho_M01 / TonKho_M01_ViTri / TonKho_M01_ViTriBot / Meta: PC ghi đè, file này chỉ ĐỌC.
 *   - Tab PhieuXuat_PC / PhieuXuatItems_PC (PC 4.58): phiếu xuất do chính PC tạo — PC ghi đè, file này chỉ ĐỌC (getPhieuPc_) để điện thoại XEM.
 *   - Tab PhieuXuat / PhieuXuatItems: file này THÊM dòng (trangThai = "Chưa xử lý"), PC đổi
 *     trangThai thành "Đã xử lý" + ghi xuLyLuc sau khi đã nhập phiếu vào Module 02.
 *   - Ghi dòng hàng (PhieuXuatItems) TRƯỚC, đầu phiếu (PhieuXuat) SAU — PC không bao giờ thấy
 *     một đầu phiếu chưa có dòng hàng.
 */

var TAB = {
  M01: 'TonKho_M01', VITRI: 'TonKho_M01_ViTri', VITRIBOT: 'TonKho_M01_ViTriBot', M02: 'TonKho_M02',
  M03: 'TonKho_M03', M03_LSX: 'DanhMuc_M03_LSX',
  M08_MAHOA: 'M08_MaHoa', M08_MADATAO: 'M08_MaDaTao', M08_TONGHOP: 'M08_TongHop',
  M08_RADONG: 'M08_RaDong', M08_SIZE: 'M08_SizeLabel', M08_KS: 'M08_KhangSinh', M08_KSXOA: 'M08_KhangSinhXoa', M08_ANHXA: 'M08_AnhXa',
  META: 'Meta', PX: 'PhieuXuat', PXI: 'PhieuXuatItems', PQ: 'PhanQuyen',
  M01_BAOCAO: 'BaoCao_M01', // file Excel "Báo Cáo Tổng Tồn" + "Bảng Tổng Hợp HLSO" (base64 cắt nhiều ô) do PC dựng
  LX: 'LichXuat_Cont', LX_THANG: 'LichXuat_Thang', // Lịch xuất nhập hàng (PC 7.31) — điện thoại XEM
  LX_EM: 'LichXuat_Email', // (PC 8.22) hộp chờ duyệt: email (Gmail) → đề xuất thêm / đổi / hủy lịch xuất — PC duyệt rồi mới áp vào lịch
  C3D: 'C3D_Data', // (PC 8.61) Container Loading 3D: cont đã sửa + phương án đã lưu — điện thoại XEM / mở (lệnh c3dData)
  LX_YC: 'LichXuat_YeuCau', // (PC 7.63) hộp thư yêu cầu THÊM / CHUYỂN lịch từ điện thoại của Quản lý trở lên — PC kéo về xử lý (xem lxGui_)
  M02_BAOCAO: 'BaoCao_M02', // file Excel "Bảng Tổng Hợp" của Module 02 (cùng cách lưu)
  // LƯU TRỮ (pcArchive_): phiếu ĐÃ XONG quá N ngày chuyển khỏi 2 tab chính để tab không phình mãi
  PX_LUUTRU: 'PhieuXuat_LuuTru', PXI_LUUTRU: 'PhieuXuatItems_LuuTru',
  PXPC: 'PhieuXuat_PC', PXPCI: 'PhieuXuatItems_PC' // (PC 4.58) phiếu xuất TẠO TRÊN PC — PC ghi đè, điện thoại chỉ XEM (getPhieu_ gộp vào danh sách, nguon = 'PC')
};
// Kho (mã giống cột "module" của phiếu) mà từng lệnh đọc dữ liệu cần — dùng để chặn token không được xem kho đó.
var KHO_OF_ACTION = { tonKhoGui: 'M02', tonKho: 'M01', baoCaoM01: 'BC01', baoCaoM02: 'BC02', viTri: 'M01VT', viTriBot: 'M01VTB', tonKhoM03: 'M03', m08: 'M08', ksSince: 'M08', lichXuat: 'LX', lichXuatGui: 'LX', c3dData: 'C3D' };
// BC01 / BC02 = quyền xem trang "Báo cáo" trên điện thoại (file Excel Module 01 / Module 02) — KHÔNG phải kho hàng,
// độc lập với quyền xem kho M01 / M02. Khớp PQ_KHO (main.js), KHO (cai-dat.js), REPORT_CFG + PQ_KHO (www/app.js).
var ALL_KHO = ['M01', 'M01VT', 'M01VTB', 'M02', 'M03', 'M08', 'BC01', 'BC02', 'LX', 'C3D', 'SCAN', 'QR']; // QR = Tạo mã QR (PC 0.69 / ĐT 0.17) · SCAN = Scan tài liệu (PC 0.21 / ĐT 0.5) — chạy trên điện thoại, không đọc Sheet
// PHÂN QUYỀN GIỐNG APP PC (main.js › PQ_PC / limitPcByRole / effectivePc) — sửa 1 bên thì sửa bên kia.
// Module mở được trên PC + quyền riêng từng mục Cài đặt. Cấp 1 / 2: không có CD_* và TAIKHOAN; Quản lý: có CD_*, TAIKHOAN chỉ khi Quản trị / admin cấp;
// Quản trị: luôn có CD_* + TAIKHOAN, chỉ module M* là bỏ tick được (danh sách trống = bản cũ → đủ).
var PQ_CD_ = ['CD_SAOLUU', 'CD_KHOIPHUC', 'CD_DONGBO'];
var PQ_PC_ = ['M01', 'M01VT', 'M01VTB', 'M02', 'M03', 'M05', 'M06', 'M07', 'M08', 'M09', 'M13', 'M14', 'M15', 'M17', 'M16', 'LX_EMAIL'].concat(PQ_CD_, ['TAIKHOAN']); // M15 = Scan tài liệu (PC 0.21) // M16 = Đối chiếu hàng ngày (PC 0.63, trước là M12) // PC 8.34: LX_EMAIL = duyệt email Lịch xuất
var PQ_FIXED_PC_ = ['TAIKHOAN', 'LX_EMAIL'].concat(PQ_CD_);
function pcClean_(v) { // chuỗi "M01,M02" hoặc mảng → mảng mã hợp lệ, không trùng
  var a = Array.isArray(v) ? v.slice() : String(v || '').split(',');
  a = a.map(function (x) { return String(x).trim(); });
  if (a.indexOf('CAIDAT') >= 0) a = a.filter(function (m) { return m !== 'CAIDAT'; }).concat(PQ_CD_); // mã cũ (trước 6.7)
  if (a.indexOf('M12') >= 0) a = a.filter(function (m) { return m !== 'M12'; }).concat(a.indexOf('M16') >= 0 ? [] : ['M16']); // PC 0.63: quyền cũ M12 = M16 (Đối chiếu hàng ngày)
  if (a.indexOf('CD_SAOLUU') >= 0 && a.indexOf('CD_KHOIPHUC') < 0) a.push('CD_KHOIPHUC'); // toàn quyền Drive kéo theo khôi phục
  return a.filter(function (m, i, x) { return PQ_PC_.indexOf(m) >= 0 && x.indexOf(m) === i; });
}
function pcLimit_(mods, role) {
  if (role === 'quantri') {
    return mods.length ? PQ_PC_.filter(function (m) { return PQ_FIXED_PC_.indexOf(m) >= 0 || mods.indexOf(m) >= 0; }) : PQ_PC_.slice();
  }
  return mods.filter(function (m) { return (m !== 'TAIKHOAN' || role === 'quanly') && (role === 'quanly' || PQ_CD_.indexOf(m) < 0); });
}
// Cấp độ: 1 cấp 1 · 2 cấp 2 · 3 Quản lý · 4 Quản trị · 5 admin chính (APP_TOKEN chung hoặc tên "admin")
function roleLv_(vaiTro) { return { xem: 1, xuat: 2, quanly: 3, quantri: 4 }[vaiTro] || 1; }
function userLv_(u) { return (u.admin || isAdminTen_(u.ten)) ? 5 : roleLv_(u.vaiTro); }
// Được mở "Quản lý người dùng" trên điện thoại: admin / Quản trị, hoặc Quản lý được cấp quyền TAIKHOAN.
function pqAllowed_(u) { return !!(u.admin || u.quanTri || (u.vaiTro === 'quanly' && u.pc && u.pc.indexOf('TAIKHOAN') >= 0)); }

// SHA-256 dạng hex (chữ thường) — GIỐNG crypto.createHash('sha256') trong main.js của app PC.
function sha256Hex_(text) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8);
  return bytes.map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length < 2 ? '0' + v : v; }).join('');
}
// Xác định người gọi từ Tên người dùng + token điện thoại. Trả về null nếu sai / đã bị tắt.
// { admin: true } = APP_TOKEN chung; còn lại { ten (ID), hienThi, quyen: 'xem'|'xuat', kho: [...] } theo tab PhanQuyen.
// nguoiDung === undefined  → app điện thoại bản cũ (chưa có ô Tên người dùng): chỉ kiểm tra token.
// nguoiDung là chuỗi       → app bản mới: BẮT BUỘC khớp tên người dùng (không phân biệt hoa/thường).
function resolveUser_(token, appToken, nguoiDung) {
  token = String(token || '');
  if (!token) return null;
  if (appToken && token === appToken) return { admin: true, quanTri: true, quanLy: true, vaiTro: 'quantri', ten: '', quyen: 'xuat', kho: ALL_KHO.slice(), pc: PQ_PC_.slice() };
  var t = readTab_(TAB.PQ);
  if (!t.headers.length) return null;
  var h = t.headers, iH = h.indexOf('tokenHash'), iT = h.indexOf('ten'), iQ = h.indexOf('quyen'),
      iK = h.indexOf('kho'), iS = h.indexOf('trangThai'), iD = h.indexOf('tenHienThi');
  if (iH < 0) return null;
  var hash = sha256Hex_(token);
  for (var i = 0; i < t.rows.length; i++) {
    var r = t.rows[i];
    if (String(r[iH]).trim().toLowerCase() !== hash) continue;
    if (iS >= 0 && String(r[iS]).trim() !== 'Bật') return null; // đã khóa
    var ten = String(iT >= 0 ? r[iT] : '').trim();
    if (nguoiDung !== undefined && String(nguoiDung || '').trim().toLowerCase() !== ten.toLowerCase()) return null; // sai tên người dùng
    var kho = String(iK >= 0 ? r[iK] : '').split(',').map(function (x) { return x.trim(); })
      .filter(function (x) { return ALL_KHO.indexOf(x) >= 0; });
    var hienThi = String(iD >= 0 ? r[iD] : '').trim() || ten;
    var iP = h.indexOf('pcModules');
    // 10/2026 — 4 VAI TRÒ: 'xem' (Người dùng cấp 1: chỉ xem) | 'xuat' (cấp 2: xem + tạo phiếu, chỉ sửa / xóa phiếu của mình) |
    // 'quanly' (Quản lý: như cấp 2 nhưng sửa / xóa được MỌI phiếu trong kho được dùng) | 'quantri' (Quản trị: như Quản lý + quản lý người dùng).
    var q = String(r[iQ]).trim();
    var vt = (q === 'xuat' || q === 'quanly' || q === 'quantri') ? q : 'xem';
    if (vt === 'quantri' && !kho.length) kho = ALL_KHO.slice(); // giống PC: Quản trị chưa lưu kho = đủ kho
    var pc = isAdminTen_(ten) ? PQ_PC_.slice() : pcLimit_(pcClean_(iP >= 0 ? r[iP] : ''), vt);
    return { admin: false, quanTri: vt === 'quantri', quanLy: vt === 'quanly' || vt === 'quantri', vaiTro: vt, ten: ten, hienThi: hienThi, quyen: vt === 'xem' ? 'xem' : 'xuat', kho: kho, pc: pc };
  }
  return null;
}
function forbid_(msg) { return json_({ ok: false, code: 'FORBIDDEN', error: msg }); }
// module: 'M02' (Tồn Kho Gửi — mặc định, phiếu cũ để trống), 'M01' (Tồn Kho An An) hoặc
// 'M01VT' (Module 01 › Tồn theo vị trí).
// 'M01VTB' (Module 01 › Vị Trí Bột — dòng xác định bằng cột "_key", tồn = cột "SL").
// 'M03' (NXT Bột/Sốt — theo lô, cần lsxXuat).
var MODULES = ['M01', 'M01VT', 'M01VTB', 'M02', 'M03'];
var PX_HEADERS = ['id', 'maPhieu', 'ngayTao', 'trangThai', 'nguoiTao', 'ghiChu', 'xuLyLuc', 'module', 'lsxXuat', 'nguoiDung'];
// itemKey/rowIndex/hopDong chỉ dùng cho phiếu Module 01 (dòng Load Data được xác định bằng cột
// "_key" mà app PC đẩy kèm lên tab TonKho_M01).
var PXI_HEADERS = ['phieuId', 'maHang', 'tenHang', 'phieuNhap', 'soLo', 'size', 'soKien', 'soLuongXuat', 'itemKey', 'rowIndex', 'hopDong', 'viTri'];
var PXI_NUMBER_COLS = ['soKien', 'soLuongXuat', 'rowIndex'];
var CHUA_XU_LY = 'Chưa xử lý';
var DA_XU_LY = 'Đã xử lý';
// Phiếu bị xóa / đang được sửa trên điện thoại: trạng thái bắt đầu bằng "Lỗi" nên app PC bỏ qua (PC chỉ
// nhận phiếu "Chưa xử lý") và tồn "chờ PC" không tính phiếu đó. KHÔNG xóa dòng đầu phiếu khỏi tab
// PhieuXuat vì app PC đánh dấu theo SỐ DÒNG — xóa dòng sẽ làm PC đánh dấu nhầm phiếu khác.
var HUY_PREFIX = 'Lỗi - Đã hủy';
var HUY = 'Lỗi - Đã hủy trên điện thoại';
var DANG_SUA = 'Lỗi - Đang sửa trên điện thoại';
var M2 = { maHang: 'Mã hàng', tenHang: 'Tên hàng', soLo: 'Số lô', size: 'Size', phieuNhap: 'Phiếu nhập/Voucher', soKien: 'Số kiện' };

function doGet(e) {
  var q = (e && e.parameter) || {};
  return json_({ ok: true, app: 'Kho Lạnh An An', message: 'Web App đang chạy. Ứng dụng điện thoại gọi bằng POST.' });
}

// PC 1.65 — CHẶN DÒ MÃ PC_TOKEN: link Web App công khai (GitHub Pages) nên ai cũng gửi thử mã được. Sai quá PC_FAIL_MAX lần trong
// PC_FAIL_WINDOW_MIN phút (đếm chung, Apps Script không biết địa chỉ người gửi) → khóa MỌI lệnh pc.* PC_FAIL_LOCK_MIN phút (kể cả mã đúng),
// để không thể dò mã. Điện thoại (APP_TOKEN / mã từng tài khoản) không bị ảnh hưởng. Nên đặt PC_TOKEN ngẫu nhiên ≥ 32 ký tự.
var PC_FAIL_MAX = 30, PC_FAIL_WINDOW_MIN = 10, PC_FAIL_LOCK_MIN = 10;
function pcLocked_() { try { return !!CacheService.getScriptCache().get('pcFailLock'); } catch (e) { return false; } }
function pcFail_() {
  try {
    var c = CacheService.getScriptCache(), n = Number(c.get('pcFailCount') || 0) + 1;
    c.put('pcFailCount', String(n), PC_FAIL_WINDOW_MIN * 60);
    if (n >= PC_FAIL_MAX) { c.put('pcFailLock', '1', PC_FAIL_LOCK_MIN * 60); c.remove('pcFailCount'); }
  } catch (e) { /* bộ đệm lỗi: không chặn */ }
}
function doPost(e) {
  var req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Yêu cầu không đúng định dạng.' });
  }
  var props = PropertiesService.getScriptProperties();
  var appToken = props.getProperty('APP_TOKEN');
  var pcToken = props.getProperty('PC_TOKEN');
  var action = String(req.action || '');
  // PC 1.104 — tài khoản dùng chung của app PC (gộp từ TaiKhoan.gs): lệnh riêng, mã riêng (TK_MA_DOC / TK_MA_QUAN_TRI).
  if (TK_ACTIONS_.indexOf(action) >= 0) return tkPost_(req, props);
  // ĐT 2.1 — ĐĂNG NHẬP BẰNG GOOGLE (bản web): điện thoại gửi id_token của Google (Google Identity Services) → Web App hỏi Google
  // xác minh, tra Gmail trong tab PhanQuyen (cột email) → trả tên + mã truy cập của tài khoản đó; sau đó app gọi như đăng nhập thường.
  // PC 1.106 — MÁY PC MỚI CHỈ CẦN ĐĂNG NHẬP: tên + mật khẩu kiểm bằng mã băm PBKDF2 ở tab TaiKhoan → trả mã đọc tài khoản + PC_TOKEN (xem dnPost_).
  if (action === 'pcDangNhap') return json_(dnPost_(req, props));
  if (action === 'dangNhapGoogle') {
    try { return json_(googleLogin_(req.idToken)); } catch (err) { return json_({ ok: false, error: String(err && err.message || err) }); }
  }
  var isPc = action.indexOf('pc.') === 0;
  var user = null;
  if (isPc) {
    if (!pcToken) return json_({ ok: false, error: 'Web App chưa đặt PC_TOKEN (Cài đặt dự án → Thuộc tính tập lệnh).' });
    if (pcLocked_()) return json_({ ok: false, code: 'AUTH', error: 'Tạm khóa lệnh của app PC do có quá nhiều lần nhập sai mã truy cập — thử lại sau ' + PC_FAIL_LOCK_MIN + ' phút.' });
    if (String(req.token || '') !== pcToken) { pcFail_(); return json_({ ok: false, code: 'AUTH', error: 'Mã truy cập không đúng.' }); }
  } else {
    user = resolveUser_(req.token, appToken, req.nguoiDung);
    if (!user) return json_({ ok: false, code: 'AUTH', error: 'Tên người dùng hoặc mã truy cập không đúng, hoặc tài khoản đã bị khóa. Liên hệ người quản lý app PC.' });
    var needKho = KHO_OF_ACTION[action];
    if (needKho && user.kho.indexOf(needKho) < 0) return forbid_('Bạn không được cấp quyền');
    if ((action === 'taoPhieu') && user.quyen !== 'xuat') return forbid_('Bạn không được cấp quyền');
    // Sửa / xóa phiếu: quản lý = mọi phiếu; tài khoản "Tạo phiếu" = CHỈ phiếu do chính mình tạo, ở kho mình
    // được dùng (phieuVisibleTo_). Phiếu PC đã nhận thì editPhieu_/cancelPhieu_ tự chặn như mọi khi.
    if ((action === 'suaPhieu' || action === 'huyPhieu') && !user.admin) {
      if (user.quyen !== 'xuat') return forbid_('Bạn không được cấp quyền');
      var pid = String(action === 'suaPhieu' ? (req.phieu && req.phieu.id) : req.id || '').trim();
      var own = pid ? findPxRow_(pid) : null;
      if (own && !user.quanLy && !phieuVisibleTo_(own.cur, user)) return forbid_('Bạn không được cấp quyền'); // Quản lý / Quản trị: mọi phiếu
    }
    // Thêm nhanh / chuyển ngày Lịch xuất nhập hàng từ điện thoại: CHỈ Quản lý trở lên (và phải có quyền xem lịch 'LX').
    if (action === 'lichXuatGui' && !user.quanLy) return forbid_('Chỉ tài khoản Quản lý trở lên mới thêm / chuyển được lịch xuất nhập hàng.');
    if (action.indexOf('pq.') === 0 && !pqAllowed_(user)) return forbid_('Chỉ tài khoản Quản trị, hoặc Quản lý được cấp quyền Tài khoản, mới quản lý được người dùng.');
    if (action === 'taoPhieu' && req.phieu) {
      var mod = MODULES.indexOf(req.phieu.module) >= 0 ? req.phieu.module : 'M02';
      if (user.kho.indexOf(mod) < 0) return forbid_('Bạn không được cấp quyền');
      if (!user.admin) { req.phieu.nguoiTao = user.hienThi; req.phieu.nguoiDung = user.ten; } // theo tài khoản, không tự gõ
    }
  }

  try {
    switch (action) {
      case 'ping': return json_({ ok: true, meta: getMeta_() });
      // Điện thoại hỏi "tôi là ai, được làm gì" — để ẩn kho / nút không có quyền.
      case 'toi': return json_({ ok: true, user: { admin: !!user.admin, quanTri: !!user.quanTri, quanLy: !!user.quanLy, vaiTro: user.vaiTro || (user.admin ? 'quantri' : 'xem'), ten: user.ten, hienThi: user.hienThi || user.ten, quyen: user.quyen, kho: user.kho, pc: user.pc || [], canPq: pqAllowed_(user) } });
      // Quản lý người dùng ngay trên điện thoại (chỉ Quản trị / APP_TOKEN chung) — ghi thẳng tab PhanQuyen.
      case 'pq.list': return json_(pqList_(user));
      case 'pq.luu': return json_(pqSave_(user, req.u));
      case 'pq.xoa': return json_(pqDelete_(user, req.ten));
      // Tự đổi mật khẩu của CHÍNH MÌNH (mọi tài khoản riêng, không cần quyền Quản trị) — xem pqSelfPassword_.
      case 'doiMa': return json_(pqSelfPassword_(user, req.matKhauMoi));
      // Câu hỏi "nhẹ" lúc mở app: mốc PC đẩy từng bảng + số đang chờ — điện thoại dùng dữ liệu đã
      // lưu trên máy, chỉ tải lại bảng nào PC vừa cập nhật.
      case 'trangThai': return json_({ ok: true, meta: getMeta_(), pending: pendingByKey_() });
      case 'tonKhoGui': return json_(getTonKhoGui_());
      case 'tonKho': return json_(getTonKhoM01_());
      case 'viTri': return json_(getTableWithPending_(TAB.VITRI));
      case 'viTriBot': return json_(getTableWithPending_(TAB.VITRIBOT));
      case 'tonKhoM03': {
        var r3 = getTableWithPending_(TAB.M03);
        var lsx = readTab_(TAB.M03_LSX);
        r3.lsx = lsx.rows.map(function (x) { return { id: String(x[0]), code: String(x[1]), name: String(x[2] || ''), khachHang: String(x[3] || '') }; });
        return json_(r3);
      }
      // Module 08 (Tổng Hợp) — chỉ xem: trả về trọn các tab nhỏ, điện thoại tự tính bảng gộp.
      case 'm08': {
        var pick = function (name) { var t = readTab_(name); return { headers: t.headers, rows: t.rows }; };
        return json_({ ok: true, meta: getMeta_(), maHoa: pick(TAB.M08_MAHOA), maDaTao: pick(TAB.M08_MADATAO),
          tongHop: pick(TAB.M08_TONGHOP), raDong: pick(TAB.M08_RADONG), sizeLabel: pick(TAB.M08_SIZE), anhXa: pick(TAB.M08_ANHXA), // ĐT 1.05: Ánh xạ tên hàng
          // Điện thoại bản 2.0+ gửi noKs: tải kháng sinh riêng theo kiểu "chỉ phần mới" (ksSince) → không gửi lại cả bảng
          khangSinh: req.noKs ? { headers: [], rows: [] } : pick(TAB.M08_KS) });
      }
      case 'ksSince': return json_(ksSince_(req.since));
      // Lịch xuất container (PC 7.31) — chỉ xem: các lịch gần đây + tổng kết từng tháng.
      case 'lichXuat': {
        var lx = readTab_(TAB.LX), lt = readTab_(TAB.LX_THANG);
        return json_({ ok: true, meta: getMeta_(), cont: { headers: lx.headers, rows: lx.rows }, thang: { headers: lt.headers, rows: lt.rows }, yc: lxYcList_() });
      }
      // (PC 7.63) Quản lý trở lên gửi yêu cầu THÊM NHANH / CHUYỂN NGÀY lịch — ghi vào tab LichXuat_YeuCau, PC kéo về xử lý.
      case 'lichXuatGui': return json_(lxGui_(user, req.ops));
      // (PC 8.61) Container Loading 3D: cont + phương án PC đã đẩy (tab C3D_Data) — cần mã kho 'C3D' (phân quyền điện thoại riêng).
      case 'c3dData': { var cd = readTab_(TAB.C3D); return json_({ ok: true, meta: getMeta_(), headers: cd.headers, rows: cd.rows }); }
      case 'baoCaoM01': return json_(getBaoCao_(TAB.M01_BAOCAO));
      case 'baoCaoM02': return json_(getBaoCao_(TAB.M02_BAOCAO));
      case 'phieu': return json_(getPhieu_(user));
      case 'taoPhieu': return json_(createPhieu_(req.phieu));
      case 'suaPhieu': return json_(editPhieu_(req.phieu));
      case 'huyPhieu': return json_(cancelPhieu_(req.id));
      // ---- Chỉ app PC (PC_TOKEN) ----
      case 'pc.ping': return json_({ ok: true, title: ss_().getName(), sheetNames: ss_().getSheets().map(function (x) { return x.getName(); }) });
      case 'pc.ensureTabs': return json_(pcEnsureTabs_(req.tabs));
      case 'pc.writeTable': return json_(pcWriteTable_(req.name, req.columns, req.rows));
      case 'pc.readTable': return json_(pcReadTable_(req.name));
      case 'pc.markRows': return json_(pcMarkRows_(req.name, req.updates));
      case 'pc.emailQuet': return json_(emailQuet_());
      case 'pc.archive': return json_(pcArchive_(req.days));
      case 'pc.ksUpsert': return json_(pcKsUpsert_(req.rows, req.dels, req.full));
      // PC 2.07 — Drive cá nhân: Client ID / Secret OAuth dùng chung, lưu trong Thuộc tính tập lệnh (KHÔNG nằm trong Sheet) để máy PC mới tự lấy về.
      case 'pc.driveClientGet': return json_(pcDriveClientGet_());
      case 'pc.driveClientSet': return json_(pcDriveClientSet_(req.clientId, req.clientSecret));
      // PC 1.61 — Mã truy cập GitHub (kho riêng tư) dùng chung: lưu ở Thuộc tính tập lệnh GITHUB_TOKEN (KHÔNG nằm trong Sheet) để máy mới tự lấy về
      case 'pc.ghTokenGet': return json_(pcGhTokenGet_());
      case 'pc.ghTokenSet': return json_(pcGhTokenSet_(req.token));
      // PC 3.21 — cấu hình NGUỒN cập nhật (kho + nhánh + mã) dùng chung: GITHUB_REPO / GITHUB_BRANCH / GITHUB_TOKEN. Máy nào cũng hỏi mỗi lần kiểm tra cập nhật → đổi kho chỉ cần sửa ở đây.
      case 'pc.ghSourceGet': return json_(pcGhSourceGet_());
      case 'pc.ghSourceSet': return json_(pcGhSourceSet_(req));
      // PC 1.104 — đặt 2 mã của tài khoản dùng chung (tab TaiKhoan) vào Thuộc tính tập lệnh.
      case 'pc.tkCaiMa': return json_(tkCaiMa_(props, req.maDoc, req.maQuanTri));
      // PC 1.109 — Quản trị ĐẶT LẠI 2 mã (khi không máy nào còn đúng mã cũ: "đã bật từ một máy khác" / "Sai mã kết nối").
      case 'pc.tkDatLaiMa': return json_(tkDatLaiMa_(props, req.maDoc, req.maQuanTri));
      // PC 1.106 — máy Quản trị đẩy mã cập nhật phần mềm (GitHub) để máy mới đăng nhập xong tự cập nhật được.
      case 'pc.ghMayMoi': { var gh = String(req.gh || '').trim(); if (gh) props.setProperty('KL_GH_TOKEN', gh); else props.deleteProperty('KL_GH_TOKEN'); return json_({ ok: true }); }
      default: return json_({ ok: false, error: 'Không có chức năng "' + action + '".' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

// ---------------------------------------------------------------------------------------------
// QUẢN LÝ NGƯỜI DÙNG TRÊN ĐIỆN THOẠI (09/2026) — đọc / ghi tab PhanQuyen. App PC ghi CÙNG định dạng này
// (main.js › PQ_COLUMNS) và khi mở Cài Đặt → Điện Thoại sẽ đọc tab này về để gộp thay đổi từ điện thoại.
// ---------------------------------------------------------------------------------------------
// pcModules (PC 5.7) = module được mở trên PC ("M01,M02,CD_DONGBO,TAIKHOAN"). Từ điện thoại 3.1 (PC 7.43) điện thoại cũng sửa cột này, cùng luật với app PC (xem pcLimit_ / pqSave_).
var PQ_COLS = ['tokenHash', 'ten', 'tenHienThi', 'quyen', 'kho', 'trangThai', 'capNhat', 'maTruyCap', 'pcModules', 'email']; // email: Gmail để 'Đăng nhập bằng Google' (ĐT 2.1)
var PQ_USER_OK_ = /^[A-Za-z0-9._-]{1,40}$/;
var PQ_TOKEN_OK_ = /^[A-Za-z0-9\-_.@#!]+$/;

// ---------------------------------------------------------------------------------------------
// YÊU CẦU LỊCH XUẤT NHẬP HÀNG TỪ ĐIỆN THOẠI (PC 7.63) — điện thoại của Quản lý trở lên không ghi thẳng vào LichXuat_Cont (tab này do PC ghi đè
// toàn bộ mỗi lần đẩy), mà thêm dòng vào tab LichXuat_YeuCau. PC kéo các dòng chưa xử lý (trangThai trống) về, ghi vào lịch, đánh dấu
// 'Đã xử lý' / 'Lỗi - …' rồi đẩy lại LichXuat_Cont. Dòng đã xử lý quá 7 ngày được dọn bớt. Cột PHẢI khớp LX_YC_HEADERS (sheets-webapp-client.js).
//   hanhDong 'add'  : loai xuat|nhap, ngay yyyy-mm-dd, lsx (mã LSX / số chứng từ), trangThaiLich ok|run|plan|wait (tuỳ chọn)
//   hanhDong 'move' : targetId (id lịch trên PC), ngay = ngày mới
// ---------------------------------------------------------------------------------------------
var LX_YC_COLS = ['id', 'hanhDong', 'loai', 'targetId', 'ngay', 'lsx', 'trangThaiLich', 'nguoiTao', 'nguoiDung', 'taoLuc', 'trangThai', 'xuLyLuc'];
function lxGui_(user, ops) {
  if (!Array.isArray(ops) || !ops.length) throw new Error('Không có yêu cầu nào để gửi.');
  if (ops.length > 60) throw new Error('Mỗi lần gửi tối đa 60 dòng.');
  var reDay = /^\d{4}-\d{2}-\d{2}$/, now = new Date().toISOString(), clean = [];
  ops.forEach(function (o) {
    o = o || {};
    var id = String(o.id || '').trim();
    if (!/^[a-z0-9]{6,40}$/.test(id)) throw new Error('Mã yêu cầu không hợp lệ.');
    var hd = o.hanhDong === 'move' ? 'move' : 'add', ngay = String(o.ngay || '').trim();
    if (!reDay.test(ngay)) throw new Error('Ngày không hợp lệ: ' + ngay);
    var rec = { id: id, hanhDong: hd, loai: o.loai === 'nhap' ? 'nhap' : 'xuat', targetId: String(o.targetId || '').trim().slice(0, 60), ngay: ngay,
      lsx: String(o.lsx || '').trim().slice(0, 120), trangThaiLich: ['ok', 'run', 'plan', 'wait'].indexOf(o.trangThaiLich) >= 0 ? o.trangThaiLich : '',
      nguoiTao: user.hienThi || user.ten || 'Quản trị', nguoiDung: user.ten || '', taoLuc: now, trangThai: '', xuLyLuc: '' };
    if (hd === 'add' && !rec.lsx) throw new Error('Có dòng chưa có LSX / số chứng từ.');
    if (hd === 'move' && !rec.targetId) throw new Error('Thiếu lịch cần chuyển.');
    clean.push(rec);
  });
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Sheet đang bận, thử lại sau.');
  try {
    var info = ensureTab_(TAB.LX_YC, LX_YC_COLS), sh = info.sheet, have = {}, last = sh.getLastRow(), cId = info.headers.indexOf('id');
    if (last >= 2) sh.getRange(2, cId + 1, last - 1, 1).getValues().forEach(function (v) { have[String(v[0]).trim()] = true; });
    var fresh = clean.filter(function (r) { return !have[r.id]; }); // gửi lặp (mạng chập chờn) không tạo trùng
    appendObjects_(info, fresh);
    // dọn dòng đã xử lý (Đã xử lý / Lỗi) quá 7 ngày
    var iS = info.headers.indexOf('trangThai'), iX = info.headers.indexOf('xuLyLuc'), iT = info.headers.indexOf('taoLuc');
    if (iS >= 0 && last >= 2) {
      var vals = sh.getRange(2, 1, last - 1, info.headers.length).getValues(), cut = Date.now() - 7 * 86400000, del = [];
      vals.forEach(function (r, i) {
        if (!String(r[iS]).trim()) return;
        var t = new Date(String(r[iX] || r[iT] || '')).getTime();
        if (t && t < cut) del.push(i + 2);
      });
      if (del.length) deleteRows_(sh, del);
    }
    SpreadsheetApp.flush();
    return { ok: true, daGui: fresh.length, boQua: clean.length - fresh.length };
  } finally {
    lock.releaseLock();
  }
}
// Yêu cầu đang chờ PC (trangThai trống) + yêu cầu lỗi trong 3 ngày gần đây → điện thoại hiện "Chờ PC" / báo lỗi.
function lxYcList_() {
  var t = readTab_(TAB.LX_YC);
  if (!t.headers.length) return { headers: [], rows: [] };
  var iS = t.headers.indexOf('trangThai'), iT = t.headers.indexOf('taoLuc'), cut = Date.now() - 3 * 86400000;
  var rows = t.rows.filter(function (r) {
    var st = String(iS >= 0 ? r[iS] : '').trim();
    if (!st) return true;
    if (st.indexOf('Lỗi') !== 0) return false;
    var c = new Date(String(iT >= 0 ? r[iT] : '')).getTime();
    return !c || c > cut;
  }).slice(-200);
  return { headers: t.headers, rows: rows };
}

// ---------------------------------------------------------------------------------------------
// EMAIL → LỊCH XUẤT (PC 8.22) — Apps Script đọc Gmail của CHÍNH tài khoản chạy Web App này (CHỈ ĐỌC: không gửi, không xóa, không gắn nhãn),
// phân tích từng thư rồi ghi 1 dòng "đề xuất" vào tab LichXuat_Email. App PC (Lịch xuất nhập hàng → nút "✉ Email") hiện danh sách chờ duyệt;
// người dùng bấm Duyệt mới thêm / đổi / hủy lịch. Mỗi thư = 1 dòng (id = mã thư Gmail → quét lại không tạo trùng).
//   hanhDong 'tao'  : thư GỐC của chuỗi thư (LSX nằm ở tiêu đề, ngày mặc định = ETD trong tiêu đề — PC cho sửa trước khi duyệt)
//   hanhDong 'doi'  : thư trả lời ghi ngày (và giờ) kéo đóng mới, VD "Cont này OK đổi kéo đóng tại kho An An lúc 10h00 ngày 10/10"
//   hanhDong 'huy'  : thư trả lời có chữ "hủy", VD "Cont này hủy kéo đóng tại kho An An ngày 08/10"
//   hanhDong 'xe'   : (PC 8.28) thư trả lời "Thông tin xe" (tài xế, SĐT, số xe, cont, seal, booking, nhiệt độ) — PC TỰ điền vào phiếu xuất của LSX đó (không cần duyệt); ghiChu giữ NGUYÊN các dòng
//   hanhDong 'khac' : thư có LSX nhưng không đọc được ngày / hành động → chỉ hiện nội dung để người dùng tự xem
// LSX luôn lấy từ TIÊU ĐỀ thư đầu của chuỗi (thư trả lời không ghi lại LSX). Cột PHẢI khớp LX_EM_HEADERS (sheets-webapp-client.js).
// Cấu hình (Cài đặt dự án → Thuộc tính tập lệnh, tuỳ chọn):
//   EMAIL_QUERY     : câu tìm Gmail (mặc định: newer_than:7d (LSX OR LOADING OR "kéo đóng"))
//   EMAIL_NGAY      : chỉ lấy thư trong N ngày gần nhất (mặc định 7 từ PC 8.35)
//   EMAIL_NGUOI_GUI : chỉ nhận thư từ các địa chỉ / tên miền này, cách nhau dấu phẩy (VD "haminhtien0803@gmail.com, congty.vn"); trống = nhận mọi người gửi
// Chạy tự động: chạy hàm emailCaiDatTuDong() MỘT LẦN trong trình soạn thảo Apps Script (đổi EMAIL_PHUT bên dưới nếu muốn 5 / 15 / 30 phút) — lần đầu Google hỏi quyền đọc Gmail.
// ---------------------------------------------------------------------------------------------
var LX_EM_COLS = ['id', 'threadId', 'nhanLuc', 'nguoiGui', 'tieuDe', 'lsx', 'hanhDong', 'ngay', 'gio', 'ghiChu', 'trangThai', 'xuLyLuc'];
var EMAIL_PHUT = 10; // chu kỳ quét tự động: 1, 5, 10, 15 hoặc 30
var EMAIL_LSX_RE = /\b\d{2}\.\d{2}\.\d{2,3}[A-Za-z]?\b/g;

function emailBoDau_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}
function emailPad_(n) { return (n < 10 ? '0' : '') + n; }
// dd/mm[/yyyy] → yyyy-mm-dd; thiếu năm → năm của thư (nếu ngày rơi quá 90 ngày TRƯỚC ngày thư thì hiểu là năm sau)
function emailNgay_(dd, mm, yy, ref) {
  var d = parseInt(dd, 10), m = parseInt(mm, 10), y = yy ? parseInt(yy, 10) : ref.getFullYear();
  if (yy && y < 100) y += 2000;
  if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12)) return '';
  if (!yy && new Date(y, m - 1, d).getTime() < ref.getTime() - 90 * 86400000) y++;
  return y + '-' + emailPad_(m) + '-' + emailPad_(d);
}
// chỉ phần chữ MỚI của thư (cắt phần trích dẫn thư cũ: "Vào … đã viết:", "On … wrote:", dòng bắt đầu bằng ">")
function emailPhanMoi_(body) {
  var t = String(body || '').replace(/\r/g, ''), cut = t.length;
  [/^[ \t]*V[àa]o\b[\s\S]{0,300}?(?:đã viết|viết)\s*:/im, /^[ \t]*On\b[\s\S]{0,300}?wrote\s*:/im, /^[ \t]*>/m,
   /^[ \t]*-{2,}\s*(?:Original|Forwarded|Tin nhắn|Thư)/im, /^[ \t]*_{5,}/m, /^[ \t]*(?:From|Từ)\s*:/im].forEach(function (re) {
    var m = re.exec(t); if (m && m.index < cut) cut = m.index;
  });
  return t.slice(0, cut).replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
}
// Phân tích thư TRẢ LỜI → { hanhDong: doi|huy|khac, ngay, gio }
function emailPhanTichTraLoi_(text, ref) {
  // PC 2.97: chỉ tính các CÂU nói về kéo đóng / xuất hàng / lấy hàng… (thư bàn phí gatein / hạ cont có «ngày 01/12» không còn bị coi là đổi lịch)
  var CUE = /keo dong|dong hang|keo cont|keo hang|xuat hang|lay hang|loading|stuffing|doi (lai|sang|qua|ngay|lich|gio|keo)|chuyen (sang|ngay|qua)|\blui (lai|sang|qua|ngay)|doi\s+\d|cont nay/;
  var NOT = /gate ?-?in|\bha (cont|hang|vo|tau)|\bha truoc|\busd\b|\bphi\b|cuoc|invoice|thanh toan/;
  var STRONG = /keo dong|dong hang|xuat hang|lay hang|loading|doi (lai|sang|qua|ngay|lich|gio|keo)/;
  var out = { hanhDong: 'khac', ngay: '', gio: '' };
  var cau = String(text || '').split(/\n|;|\.\s+/).map(function (x) { return emailBoDau_(x).toLowerCase(); }).filter(function (c) { return c && CUE.test(c) && !(NOT.test(c) && !STRONG.test(c)); });
  if (!cau.length) return out;
  var t = cau.join(' . ');
  var md = t.match(/ngay\s*(\d{1,2})\s*[\/\-.]\s*(\d{1,2})(?:\s*[\/\-.]\s*(\d{2,4}))?/);
  if (md) out.ngay = emailNgay_(md[1], md[2], md[3], ref);
  var mg = t.match(/\b(\d{1,2})\s*(?:h|:|gio)\s*(\d{2})?(?![a-z0-9])/);
  if (mg && +mg[1] < 24 && (!mg[2] || +mg[2] < 60)) out.gio = emailPad_(+mg[1]) + ':' + (mg[2] || '00');
  if (/\b(huy|cancel|cancelled)\b/.test(t)) out.hanhDong = 'huy';
  else if (out.ngay) out.hanhDong = 'doi';
  return out;
}
// PC 8.24: chuỗi thư phải liên quan nhập / xuất hàng (từ khóa trong TIÊU ĐỀ). Tùy chọn Thuộc tính tập lệnh EMAIL_TU_KHOA (cách nhau dấu phẩy; "*" = không lọc).
var EMAIL_TU_KHOA = ['loading', 'keo dong', 'keo hang', 'cont', 'container', 'booking', 'etd', 'eta', 'xuat', 'nhap', 'stuffing', 'shipping', 'giao hang', 'lay hang', 'xe '];
function emailLienQuan_(subj, kws) {
  if (kws.length === 1 && kws[0] === '*') return true;
  var t = ' ' + emailBoDau_(subj).toLowerCase() + ' ';
  return kws.some(function (k) { return t.indexOf(k) >= 0; });
}
function emailChoPhep_(from, allow) {
  if (!allow.length) return true;
  var f = String(from || '').toLowerCase();
  return allow.some(function (a) { return a && f.indexOf(a) >= 0; });
}
// PC 8.28: thư \"Thông tin xe\" = có ít nhất 3 trong 7 nhãn (tài xế / số điện thoại / số xe / số cont / số seal / số booking / nhiệt độ) ở dạng \"Nhãn: giá trị\".
function emailLaThongTinXe_(text) {
  var t = emailBoDau_(text).toLowerCase(), n = 0;
  [/(ho ten tai xe|tai xe)\s*:/, /(so dien thoai|sdt|dt)\s*:/, /(so xe|bien so)\s*:/, /(so cont|cont so|so container)\s*:/, /so seal\s*:/, /(so booking|booking)\s*:/, /nhiet do[^:\n]{0,30}:/].forEach(function (re) { if (re.test(t)) n++; });
  return n >= 3;
}
// PC 8.35: thư thông báo LIST / thông tin giao hàng (\"BP Kho An An gửi List xuất hàng ngày 08.10 … Người nhận hàng … Cont/Xe … Seal\") KHÔNG phải thư đổi lịch dù có cụm \"ngày 08.10\"
function emailLaThongBaoList_(text) {
  var t = emailBoDau_(text).toLowerCase();
  return /gui list|list xuat hang|nguoi nhan hang|cont\s*\/\s*xe\s*:|seal\s*:/.test(t);
}
// PC 8.35: thư trả lời có DẤU HIỆU đổi lịch (cut off, update, đổi, dời, lùi, ETD, closing…) nhưng KHÔNG đọc được ngày kéo đóng (VD thông báo hãng tàu \"ETD Oct 11, 2026\")
// → vẫn đưa vào hộp chờ duyệt (ngày để trống để người dùng tự điền), KHÔNG BAO GIỜ tự xử lý.
function emailGoiYDoiLich_(text) {
  var t = emailBoDau_(text).toLowerCase();
  return /cut ?-?off|update|thay doi|doi (lai|ngay|lich|gio|sang|qua|keo)|\blui\b|som hon|tam hoan|hoan (lai|keo|xuat)|delay|postpone|\betd\b|closing|keo dong/.test(t); // PC 8.37: bỏ "hoan" / "doi" trơn (khớp nhầm "hoàn thành", "chờ đợi")
}
function emailTomTatLich_(text) { // giữ các dòng có ngày giờ quan trọng (ETA / ETD / Closing / cut off / At … hrs)
  var out = [], lines = String(text || '').split('\n');
  lines.forEach(function (l) { if (/\b(ETA|ETD|closing|cut ?-?off)\b|hrs\b/i.test(l)) out.push(l.trim()); });
  return (out.length ? out.join(' | ') : lines.join(' ')).replace(/\s+/g, ' ').slice(0, 400);
}
function emailQuet_() {
  var props = PropertiesService.getScriptProperties();
  var ngay = parseInt(props.getProperty('EMAIL_NGAY'), 10) || 7; // PC 8.35: mặc định 7 ngày (trước 14) — chỉ cần rà lịch xuất 1–2 tuần
  var query = props.getProperty('EMAIL_QUERY') || ('newer_than:' + ngay + 'd (LSX OR LOADING OR "kéo đóng")');
  var allow = String(props.getProperty('EMAIL_NGUOI_GUI') || '').toLowerCase().split(/[,;\s]+/).filter(String);
  var kwRaw = String(props.getProperty('EMAIL_TU_KHOA') || '').split(',').map(function (x) { return emailBoDau_(x).toLowerCase().replace(/^\s+/, ''); }).filter(String);
  var kws = kwRaw.length ? kwRaw : EMAIL_TU_KHOA;
  var cutoff = Date.now() - ngay * 86400000;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Sheet đang bận, thử lại sau.');
  try {
    var threads;
    try { threads = GmailApp.search(query, 0, 60); }
    catch (err) { throw new Error('Chưa đọc được Gmail (' + err.message + '). Mở Apps Script → chạy hàm emailCaiDatTuDong một lần để cấp quyền, rồi Triển khai → Phiên bản mới.'); }
    var info = ensureTab_(TAB.LX_EM, LX_EM_COLS), sh = info.sheet, have = {}, last = sh.getLastRow(), cId = info.headers.indexOf('id');
    if (last >= 2) sh.getRange(2, cId + 1, last - 1, 1).getValues().forEach(function (v) { have[String(v[0]).trim()] = true; });
    var fresh = [], now = new Date().toISOString();
    threads.forEach(function (th) {
      var msgs = th.getMessages(), first = th.getFirstMessageSubject() || '', codes = first.match(EMAIL_LSX_RE);
      if (!codes) return; // chuỗi thư không có LSX ở tiêu đề → không liên quan
      if (!emailLienQuan_(first, kws)) return; // PC 8.24: tiêu đề không nói về nhập / xuất hàng → bỏ
      var seen = {}, lsx = codes.filter(function (c) { c = c.toUpperCase(); if (seen[c]) return false; seen[c] = 1; return true; }).map(function (c) { return c.toUpperCase(); }).join(' + ');
      var subj = first.replace(/^\s*((re|fw|fwd|tr)\s*:\s*)+/i, '').trim();
      msgs.forEach(function (m, i) {
        var id = m.getId(); if (have[id]) return;
        var dt = m.getDate(); if (dt.getTime() < cutoff) return;
        var from = m.getFrom(); if (!emailChoPhep_(from, allow)) return;
        var rec = { id: id, threadId: th.getId(), nhanLuc: dt.toISOString(), nguoiGui: String(from).replace(/["']/g, '').trim() || from, // PC 8.30: giữ cả địa chỉ <email> để PC so với danh sách "người gửi tin cậy"
          tieuDe: subj.slice(0, 250), lsx: lsx, hanhDong: 'khac', ngay: '', gio: '', ghiChu: '', trangThai: '', xuLyLuc: '' };
        if (i === 0 && !/^\s*(re|fw|fwd|tr)\s*:/i.test(m.getSubject() || '')) {
          // thư GỐC: ngày mặc định = ETD trong tiêu đề (chỉ là ngày tàu chạy → PC cho sửa); ghi chú = các phần còn lại của tiêu đề
          rec.hanhDong = 'tao';
          var e = subj.match(/ETD\s*:?\s*(\d{1,2})\s*[\/.\-]\s*(\d{1,2})(?:\s*[\/.\-]\s*(\d{2,4}))?/i);
          if (e) rec.ngay = emailNgay_(e[1], e[2], e[3], dt);
          rec.ghiChu = subj.split(/\s+-\s+/).filter(function (p) { return !/^AN AN$/i.test(p.trim()) && !/\bLSX\b/i.test(p); }).join(' · ').slice(0, 300);
        } else {
          var txt = emailPhanMoi_(m.getPlainBody()), r = emailPhanTichTraLoi_(txt, dt);
          if (emailLaThongTinXe_(txt)) { rec.hanhDong = 'xe'; rec.ghiChu = txt.replace(/[ \t]+/g, ' ').replace(/\n\s*/g, '\n').slice(0, 900); } // PC 8.28: giữ xuống dòng để PC tách từng mục
          else if (emailLaThongBaoList_(txt)) { rec.hanhDong = 'khac'; }
          else if (r.hanhDong === 'khac' && emailGoiYDoiLich_(txt)) { rec.hanhDong = 'doi'; rec.ngay = ''; rec.gio = ''; rec.ghiChu = emailTomTatLich_(txt); } // PC 8.35: không có ngày rõ → chờ duyệt, tự điền ngày
          else { rec.hanhDong = r.hanhDong; rec.ngay = r.ngay; rec.gio = r.gio; rec.ghiChu = txt.replace(/\s*\n\s*/g, ' ').slice(0, 300); }
        }
        if (rec.hanhDong === 'khac') { have[id] = true; return; } // PC 8.24: thư chỉ để xem → không đưa vào hộp chờ duyệt
        fresh.push(rec); have[id] = true;
      });
    });
    fresh.sort(function (a, b) { return a.nhanLuc < b.nhanLuc ? -1 : 1; });
    appendObjects_(info, fresh);
    // dọn dòng đã xử lý quá 14 ngày
    var iS = info.headers.indexOf('trangThai'), iX = info.headers.indexOf('xuLyLuc'), iT = info.headers.indexOf('nhanLuc');
    if (iS >= 0 && last >= 2) {
      var vals = sh.getRange(2, 1, last - 1, info.headers.length).getValues(), cut2 = Date.now() - 14 * 86400000, del = [];
      vals.forEach(function (r, i) {
        if (!String(r[iS]).trim()) return;
        var t = new Date(String(r[iX] || r[iT] || '')).getTime();
        if (t && t < cut2) del.push(i + 2);
      });
      if (del.length) deleteRows_(sh, del);
    }
    SpreadsheetApp.flush();
    return { ok: true, moi: fresh.length, cacChuoi: threads.length };
  } finally {
    lock.releaseLock();
  }
}
// Hàm chạy theo lịch (trigger) — lỗi chỉ ghi nhật ký, không làm hỏng gì.
function emailQuetTuDong() {
  try { emailQuet_(); } catch (err) { console.error('emailQuetTuDong: ' + err.message); }
}
// CHẠY 1 LẦN trong trình soạn thảo Apps Script: cấp quyền đọc Gmail + đặt lịch quét tự động mỗi EMAIL_PHUT phút (chạy lại để đổi chu kỳ).
function emailCaiDatTuDong() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'emailQuetTuDong') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('emailQuetTuDong').timeBased().everyMinutes(EMAIL_PHUT).create();
  var r = emailQuet_();
  console.log('Đã đặt lịch quét mail mỗi ' + EMAIL_PHUT + ' phút. Lần quét đầu: ' + r.moi + ' thư mới.');
}
// Tắt quét tự động (PC vẫn bấm "Quét mail ngay" được).
function emailTatTuDong() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'emailQuetTuDong') ScriptApp.deleteTrigger(t); });
}

// Mã OAuth loại "Web application" (dự án Google Cloud kholanhcloud, nguồn https://truongnhatdangkhoa-ai.github.io) — Client ID không phải mật khẩu.
var GOOGLE_WEB_CLIENT_ID = '688518280070-vicnen62bp64u8a464ou7ijv3s8ukoej.apps.googleusercontent.com';
function googleLogin_(idToken) {
  idToken = String(idToken || '');
  if (!idToken || idToken.length > 4096) return { ok: false, error: 'Thiếu mã đăng nhập Google.' };
  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return { ok: false, code: 'AUTH', error: 'Mã đăng nhập Google không hợp lệ hoặc đã hết hạn — thử lại.' };
  var p = JSON.parse(res.getContentText() || '{}');
  if (p.aud !== GOOGLE_WEB_CLIENT_ID) return { ok: false, code: 'AUTH', error: 'Mã đăng nhập Google không dành cho Kho Lạnh.' };
  if (p.iss !== 'https://accounts.google.com' && p.iss !== 'accounts.google.com') return { ok: false, code: 'AUTH', error: 'Mã đăng nhập không phải của Google.' };
  if (String(p.email_verified) !== 'true') return { ok: false, code: 'AUTH', error: 'Tài khoản Google này chưa xác minh email.' };
  var email = String(p.email || '').trim().toLowerCase();
  var row = pqRead_().filter(function (o) { return o.email && o.email.toLowerCase() === email; })[0];
  if (!row) return { ok: false, code: 'AUTH', error: 'Tài khoản Google ' + email + ' chưa được gán cho người dùng nào. Nhờ Quản trị gán ở Cài đặt › Quản lý người dùng (ô Email Google).' };
  if (row.trangThai !== 'Bật') return { ok: false, code: 'AUTH', error: 'Tài khoản gán với Google này đang bị khóa. Liên hệ người quản lý.' };
  if (!row.maTruyCap) return { ok: false, code: 'AUTH', error: 'Tài khoản này chưa có mã truy cập — nhờ Quản trị đặt mã.' };
  return { ok: true, ten: row.ten, hienThi: row.tenHienThi || row.ten, token: row.maTruyCap, email: email };
}
function pqRead_() {
  var t = readTab_(TAB.PQ), h = t.headers, out = [];
  t.rows.forEach(function (r) {
    var o = {};
    PQ_COLS.forEach(function (c) { var i = h.indexOf(c); o[c] = (i >= 0 && r[i] !== null && r[i] !== undefined) ? String(r[i]).trim() : ''; });
    if (o.ten) out.push(o);
  });
  return out;
}
function pqWrite_(list) {
  var sh = ss_().getSheetByName(TAB.PQ) || ss_().insertSheet(TAB.PQ);
  var n = PQ_COLS.length;
  var values = [PQ_COLS].concat(list.map(function (o) { return PQ_COLS.map(function (c) { return o[c] || ''; }); }));
  if (sh.getMaxRows() < values.length) sh.insertRowsAfter(sh.getMaxRows(), values.length - sh.getMaxRows());
  if (sh.getMaxColumns() < n) sh.insertColumnsAfter(sh.getMaxColumns(), n - sh.getMaxColumns());
  sh.getRange(1, 1, values.length, n).setNumberFormat('@').setValues(values);
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow > values.length) sh.getRange(values.length + 1, 1, lastRow - values.length, Math.max(lastCol, 1)).clearContent();
  if (lastCol > n) sh.getRange(1, n + 1, Math.max(lastRow, 1), lastCol - n).clearContent();
  SpreadsheetApp.flush();
}
function pqMutate_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Sheet đang bận, thử lại sau.');
  try { var list = pqRead_(); fn(list); pqWrite_(list); } finally { lock.releaseLock(); }
}
// Tài khoản "admin" (tài khoản chính của app PC, 10/2026): chỉ sửa / đổi mã / xóa trên máy PC. Điện thoại: người dùng khác
// (kể cả Quản trị) KHÔNG thấy dòng admin (và mã của nó) trong danh sách, không ai sửa / xóa / đổi mã admin từ điện thoại được.
function isAdminTen_(ten) { return String(ten || '').trim().toLowerCase() === 'admin'; }
// Vai trò của 1 dòng PhanQuyen (admin chính luôn là Quản trị) + cấp độ + quyền thao tác của người đang gọi (me) — GIỐNG app PC (main.js › perm-get / perm-save).
function pqRowRole_(o) { return isAdminTen_(o.ten) ? 'quantri' : ((o.quyen === 'xuat' || o.quyen === 'quanly' || o.quyen === 'quantri') ? o.quyen : 'xem'); }
function pqRowLv_(o) { return isAdminTen_(o.ten) ? 5 : roleLv_(pqRowRole_(o)); }
function pqIsSelf_(me, ten) { return !me.admin && !!me.ten && String(ten || '').trim().toLowerCase() === String(me.ten).toLowerCase(); }
// Không xem mã / sửa / xóa được người CÙNG CẤP hoặc CAO HƠN mình (Quản trị: khóa Quản trị khác + admin; Quản lý: khóa Quản lý + Quản trị + admin, kể cả chính mình).
// Riêng Quản trị (không phải admin) vẫn xem + sửa được CHÍNH MÌNH. admin (APP_TOKEN chung hoặc tài khoản "admin") sửa được mọi người trừ dòng admin.
function pqCanTouch_(me, o) {
  var meLv = userLv_(me);
  if (meLv >= 5) return true;
  if (meLv === 4 && pqIsSelf_(me, o.ten)) return true;
  return pqRowLv_(o) < Math.min(meLv, 4);
}
function pqList_(me) {
  var seeAdmin = !!(me && (me.admin || isAdminTen_(me.ten)));
  return {
    ok: true,
    me: { lv: userLv_(me), ten: me.ten || '' },
    list: pqRead_().filter(function (o) { return seeAdmin || !isAdminTen_(o.ten); }).map(function (o) {
      var role = pqRowRole_(o), ok = pqCanTouch_(me, o);
      var kho = o.kho.split(',').map(function (x) { return x.trim(); }).filter(function (x) { return ALL_KHO.indexOf(x) >= 0; });
      if (role === 'quantri' && !kho.length) kho = ALL_KHO.slice(); // Quản trị chưa lưu kho = đủ kho (giống PC)
      return {
        ten: o.ten, tenHienThi: o.tenHienThi || o.ten, quyen: role,
        kho: kho, pc: isAdminTen_(o.ten) ? PQ_PC_.slice() : pcLimit_(pcClean_(o.pcModules), role),
        bat: o.trangThai === 'Bật', token: ok ? o.maTruyCap : '', khoa: !ok, email: o.email || ''
      };
    })
  };
}
// u: { ten, tenHienThi, token, quyen: 'xem'|'xuat'|'quanly'|'quantri', kho: [...], pc: [...mã module PC], bat }. Tên đã có → sửa, chưa có → thêm.
// token để trống khi sửa = giữ mã cũ.
function pqSave_(me, u) {
  u = u || {};
  var ten = String(u.ten || '').trim();
  if (!PQ_USER_OK_.test(ten)) throw new Error('Tên người dùng: chỉ chữ không dấu, số và . _ - (tối đa 40 ký tự, không dấu cách).');
  var quyen = (u.quyen === 'quantri' || u.quyen === 'quanly' || u.quyen === 'xuat') ? u.quyen : 'xem';
  var bat = u.bat !== false;
  var kho = (Array.isArray(u.kho) ? u.kho : []).filter(function (k) { return ALL_KHO.indexOf(k) >= 0; });
  var pcIn = pcClean_(u.pc);
  var hienThi = String(u.tenHienThi || '').trim().slice(0, 60) || ten;
  var token = String(u.token || '').trim();
  var email = u.email === undefined ? null : String(u.email || '').trim().toLowerCase(); // null = app bản cũ không gửi → giữ email đang có
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Email Google không hợp lệ.');
  var props = PropertiesService.getScriptProperties();
  if (isAdminTen_(ten)) throw new Error('Tài khoản admin là tài khoản chính — chỉ sửa được trên máy PC (Cài đặt › Tài khoản).');
  var meLv = userLv_(me), self = pqIsSelf_(me, ten);
  if (self && userLv_(me) === 4 && (!bat || quyen !== 'quantri')) throw new Error('Không thể tự khóa hoặc hạ quyền của chính mình.');
  pqMutate_(function (list) {
    var idx = -1;
    list.forEach(function (o, i) { if (o.ten.toLowerCase() === ten.toLowerCase()) idx = i; });
    var cur = idx >= 0 ? list[idx] : null;
    if (meLv < 5) {
      // cùng cấp / cao hơn: không sửa được (Quản trị chỉ sửa được chính mình)
      if (cur && !pqCanTouch_(me, cur)) throw new Error(pqRowLv_(cur) >= 4 ? 'Tài khoản Quản trị chỉ admin mới sửa được.' : 'Tài khoản cùng cấp hoặc cao hơn bạn — không sửa được.');
      if (quyen === 'quantri' && !(cur && pqRowRole_(cur) === 'quantri')) throw new Error('Chỉ tài khoản admin mới được tạo / nâng tài khoản lên vai trò Quản trị.');
      if (meLv === 3 && quyen === 'quanly') throw new Error('Vai trò Quản lý chỉ được tạo / sửa tài khoản Người dùng cấp 1 và cấp 2.');
      if (meLv === 4 && quyen === 'quanly' && cur && pqRowRole_(cur) === 'quantri') throw new Error('Tài khoản Quản trị chỉ admin mới hạ vai trò được.');
    }
    var prevKho = cur ? cur.kho.split(',').map(function (x) { return x.trim(); }).filter(function (x) { return ALL_KHO.indexOf(x) >= 0; }) : [];
    var prevPc = cur ? pcClean_(cur.pcModules) : [];
    if (meLv === 3) { // Quản lý: chỉ cấp được kho / module mà chính mình có; phần ngoài phạm vi của mình trên tài khoản đó thì giữ nguyên
      var inter = function (sub, prev, mine) { return mine.filter(function (m) { return sub.indexOf(m) >= 0; }).concat(prev.filter(function (m) { return mine.indexOf(m) < 0; })); };
      kho = inter(kho, prevKho, me.kho || []);
      pcIn = inter(pcIn, prevPc, me.pc || []);
    }
    if (quyen === 'quantri' && !kho.length) throw new Error('Tài khoản Quản trị cần giữ ít nhất 1 kho điện thoại.');
    var pcOut = pcLimit_(pcIn, quyen); // cấp 1 / 2 không có Cài đặt; Quản lý không có Tài khoản (trừ khi Quản trị / admin cấp); Quản trị luôn có Cài đặt + Tài khoản
    if (quyen === 'quanly' && pcOut.indexOf('TAIKHOAN') >= 0 && meLv < 4) { // quyền Tài khoản của Quản lý chỉ do Quản trị / admin chỉ định
      var had = !!(cur && pqRowRole_(cur) === 'quanly' && prevPc.indexOf('TAIKHOAN') >= 0);
      if (!had) pcOut = pcOut.filter(function (m) { return m !== 'TAIKHOAN'; });
    }
    if (!token) token = cur ? cur.maTruyCap : '';
    if (!token) throw new Error(cur ? 'Tài khoản này chưa lưu mã — bấm \"Tạo mã\" để đặt mã mới.' : 'Chưa có mã truy cập — bấm \"Tạo mã\".');
    if (token.length < 8 || token.length > 64 || !PQ_TOKEN_OK_.test(token)) throw new Error('Mã chỉ gồm chữ không dấu, số và - _ . @ # ! (8–64 ký tự, không dấu cách).');
    if (token === props.getProperty('PC_TOKEN') || token === props.getProperty('APP_TOKEN')) throw new Error('Mã trùng mã chung (PC_TOKEN / APP_TOKEN) — chọn mã khác.');
    list.forEach(function (o, i) {
      if (i !== idx && o.maTruyCap.toLowerCase() === token.toLowerCase()) throw new Error('Mã này đang là mã của \"' + (o.tenHienThi || o.ten) + '\" — chọn mã khác.');
      if (email && i !== idx && String(o.email || '').toLowerCase() === email) throw new Error('Email ' + email + ' đã gán cho \"' + (o.tenHienThi || o.ten) + '\".');
    });
    var row = { tokenHash: sha256Hex_(token), ten: cur ? cur.ten : ten, tenHienThi: hienThi, quyen: quyen, kho: kho.join(','),
      trangThai: bat ? 'Bật' : 'Tắt', capNhat: new Date().toISOString(), maTruyCap: token,
      pcModules: pcOut.join(','), email: email === null ? (cur ? cur.email : '') : email };
    if (idx >= 0) list[idx] = row; else list.push(row);
  });
  return pqList_(me);
}
function pqDelete_(me, ten) {
  ten = String(ten || '').trim().toLowerCase();
  if (!ten) throw new Error('Thiếu tên người dùng.');
  if (isAdminTen_(ten)) throw new Error('Tài khoản admin là tài khoản chính — không xóa được.');
  if (!me.admin && ten === String(me.ten || '').toLowerCase()) throw new Error('Không thể tự xóa tài khoản của chính mình.');
  var meLv = userLv_(me);
  pqMutate_(function (list) {
    var n = list.length;
    if (meLv < 5) list.forEach(function (o) {
      if (o.ten.toLowerCase() === ten && !pqCanTouch_(me, o)) throw new Error(pqRowLv_(o) >= 4 ? 'Tài khoản Quản trị chỉ admin mới xóa được.' : 'Tài khoản cùng cấp hoặc cao hơn bạn — không xóa được.');
    });
    for (var i = list.length - 1; i >= 0; i--) if (list[i].ten.toLowerCase() === ten) list.splice(i, 1);
    if (list.length === n) throw new Error('Không tìm thấy người dùng này.');
  });
  return pqList_(me);
}

// Tự đổi mật khẩu (mã truy cập) của chính tài khoản đang đăng nhập (10/2026). Người gọi đã được resolveUser_ xác thực bằng
// Tên người dùng + mật khẩu hiện tại nên không cần quyền Quản trị. Mã chung APP_TOKEN (admin) không có dòng riêng → không đổi ở đây.
// Ghi cả tokenHash + maTruyCap; app PC kéo mã mới về khi mở Cài Đặt → Điện Thoại (mergePermFromSheet: Sheet thắng ở mã).
function pqSelfPassword_(me, moi) {
  if (me.admin) throw new Error('Đang dùng mã chung của app — không đổi được ở đây. Nhờ người quản lý tạo tài khoản riêng.');
  if (isAdminTen_(me.ten)) throw new Error('Tài khoản admin chỉ đổi mã được trên máy PC (Cài đặt › Tài khoản).');
  var token = String(moi || '').trim();
  if (token.length < 8 || token.length > 64 || !PQ_TOKEN_OK_.test(token)) throw new Error('Mật khẩu mới chỉ gồm chữ không dấu, số và - _ . @ # ! (8–64 ký tự, không dấu cách).');
  var props = PropertiesService.getScriptProperties();
  if (token === props.getProperty('PC_TOKEN') || token === props.getProperty('APP_TOKEN')) throw new Error('Mật khẩu này không dùng được — chọn mật khẩu khác.');
  var hash = sha256Hex_(token), ten = String(me.ten || '').toLowerCase();
  pqMutate_(function (list) {
    var idx = -1;
    list.forEach(function (o, i) { if (o.ten.toLowerCase() === ten) idx = i; });
    if (idx < 0) throw new Error('Không tìm thấy tài khoản.');
    list.forEach(function (o, i) {
      if (i !== idx && (o.maTruyCap.toLowerCase() === token.toLowerCase() || String(o.tokenHash).toLowerCase() === hash)) throw new Error('Mật khẩu này không dùng được — chọn mật khẩu khác.');
    });
    list[idx].tokenHash = hash;
    list[idx].maTruyCap = token;
    list[idx].capNhat = new Date().toISOString();
  });
  return { ok: true };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function readTab_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh || sh.getLastRow() < 1) return { headers: [], rows: [] };
  var values = sh.getDataRange().getValues();
  var headers = values[0].map(function (h) { return String(h); });
  var rows = values.slice(1).filter(function (r) {
    return r.some(function (c) { return c !== '' && c !== null; });
  });
  return { headers: headers, rows: rows };
}

function getMeta_() {
  var t = readTab_(TAB.META);
  var meta = {};
  t.rows.forEach(function (r) { meta[String(r[0])] = r[1]; });
  return meta;
}

// Báo cáo Excel (tab BaoCao_M01 / BaoCao_M02): ghép lại các phần base64 (cột data, bỏ tiền tố "~") theo key + part.
// Cột: key | title | name | reportDate | generatedAt | part | parts | data — khớp M01_REPORT_COLUMNS (main.js).
function getBaoCao_(tabName) {
  var t = readTab_(tabName);
  var h = {}; t.headers.forEach(function (x, i) { h[x] = i; });
  var byKey = {}, order = [];
  if (h.key !== undefined && h.data !== undefined) {
    t.rows.forEach(function (r) {
      var key = String(r[h.key] || '');
      if (!key) return;
      if (!byKey[key]) {
        byKey[key] = { key: key, title: String(r[h.title] || key), name: String(r[h.name] || (key + '.xlsx')),
          reportDate: String(r[h.reportDate] || ''), generatedAt: String(r[h.generatedAt] || ''),
          parts: Number(r[h.parts]) || 0, chunks: [] };
        order.push(key);
      }
      byKey[key].chunks.push({ i: Number(r[h.part]) || 0, d: String(r[h.data] || '').replace(/^~/, '') });
    });
  }
  var files = order.map(function (k) {
    var f = byKey[k];
    f.chunks.sort(function (a, b) { return a.i - b.i; });
    var ok = !f.parts || f.chunks.length === f.parts;
    var out = { key: f.key, title: f.title, name: f.name, reportDate: f.reportDate, generatedAt: f.generatedAt,
      complete: ok, b64: ok ? f.chunks.map(function (c) { return c.d; }).join('') : '' };
    return out;
  });
  return { ok: true, meta: getMeta_(), files: files };
}

function getTable_(name) {
  var t = readTab_(name);
  return { ok: true, headers: t.headers, rows: t.rows, meta: getMeta_() };
}

// Khóa khớp 1 lô hàng — GIỐNG syncMatchKey() trong main.js và pxRowMatchKey() ở Module 02.
function matchKey_(maHang, soLo, size, phieuNhap) {
  return [maHang, soLo, size, phieuNhap].map(function (v) {
    return String(v === null || v === undefined ? '' : v).trim();
  }).join('|');
}

function toDate_(v) {
  if (v instanceof Date) return v;
  if (v === '' || v === null || v === undefined) return null;
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function col_(headers, name) { return headers.indexOf(name); }

// Số lượng ĐANG CHỜ trên từng lô: phiếu điện thoại PC chưa nhận, CỘNG phiếu PC đã nhận nhưng
// chưa có trong lần đẩy tồn kho gần nhất (xuLyLuc sau Meta.lastPushAt).
// Khóa: Module 02 = matchKey_(...); Module 01 = 'M01|' + itemKey; Vị trí = 'VT|' + itemKey;
// Vị Trí Bột = 'M01VTB|' + itemKey; M03 = 'M03|' + itemKey.
function pendingByKey_() {
  var meta = getMeta_();
  // Moc day ton RIENG tung bang (PC cho phep dong bo tung bang) — thieu thi dung moc chung.
  var lastPushOf = function (mod) { return toDate_(meta['lastPushAt_' + mod] || meta.lastPushAt); };
  var px = readTab_(TAB.PX);
  var cId = col_(px.headers, 'id'), cTT = col_(px.headers, 'trangThai'), cXL = col_(px.headers, 'xuLyLuc'),
      cMod = col_(px.headers, 'module');
  var pendingIds = {};
  px.rows.forEach(function (r) {
    var tt = String(r[cTT] || '').trim();
    var id = String(r[cId] || '').trim();
    if (!id || tt.indexOf('Lỗi') === 0) return;
    var m = cMod >= 0 ? String(r[cMod]).trim() : '';
    var mod = MODULES.indexOf(m) >= 0 ? m : 'M02';
    if (tt !== DA_XU_LY) { pendingIds[id] = mod; return; }
    var xl = cXL >= 0 ? toDate_(r[cXL]) : null;
    var lastPush = lastPushOf(mod);
    if (xl && (!lastPush || xl.getTime() > lastPush.getTime())) pendingIds[id] = mod;
  });
  var pxi = readTab_(TAB.PXI);
  var h = pxi.headers;
  var cP = col_(h, 'phieuId'), cMa = col_(h, 'maHang'), cLo = col_(h, 'soLo'), cSz = col_(h, 'size'),
      cPn = col_(h, 'phieuNhap'), cQ = col_(h, 'soLuongXuat'), cK = col_(h, 'itemKey');
  var map = {};
  pxi.rows.forEach(function (r) {
    var mod = pendingIds[String(r[cP]).trim()];
    if (!mod) return;
    var ik = String(cK >= 0 ? r[cK] : '').trim();
    var k = mod === 'M02' ? matchKey_(r[cMa], r[cLo], r[cSz], r[cPn]) : (mod === 'M01VT' ? 'VT' : mod) + '|' + ik;
    map[k] = (map[k] || 0) + (Number(r[cQ]) || 0);
  });
  return map;
}

function getTonKhoM01_() { return getTableWithPending_(TAB.M01); }
function getTableWithPending_(name) {
  var t = readTab_(name);
  return { ok: true, headers: t.headers, rows: t.rows, pending: pendingByKey_(), meta: getMeta_() };
}

// Chuẩn hóa tên cột để so khớp (bỏ dấu, thường, bỏ ký tự đặc biệt) — "Tồn cuối" == "ton cuoi".
function normHeader_(h) {
  return String(h || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[.,()\/\\\-_:;]/g, ' ').replace(/\s+/g, ' ').trim();
}
function findHeader_(headers, name) {
  var i = headers.indexOf(name);
  if (i >= 0) return i;
  var n = normHeader_(name);
  for (var j = 0; j < headers.length; j++) if (normHeader_(headers[j]) === n) return j;
  return -1;
}
// Số kiểu "1,234.5" / "17." / "9.698,4" -> số (giống parseLooseNumber() ở Module 01).
function looseNum_(v) {
  if (typeof v === 'number') return v;
  var s = String(v === null || v === undefined ? '' : v).trim().replace(/[\u00A0\s]/g, '');
  if (!s) return 0;
  var hasComma = s.indexOf(',') >= 0, hasDot = s.indexOf('.') >= 0;
  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    s = /^-?\d+,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  }
  var m = s.match(/^-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
}

function getTonKhoGui_() {
  var t = readTab_(TAB.M02);
  return { ok: true, headers: t.headers, rows: t.rows, pending: pendingByKey_(), meta: getMeta_() };
}

// Người dùng có token riêng chỉ thấy phiếu CỦA MÌNH (theo tên) ở các kho được phép; quản trị thấy tất cả.
function phieuVisibleTo_(p, user) {
  if (!user || user.admin) return true;
  var m = MODULES.indexOf(String(p.module || '').trim()) >= 0 ? String(p.module).trim() : 'M02';
  if (user.kho.indexOf(m) < 0) return false;
  var nd = String(p.nguoiDung || '').trim();
  if (nd) return nd.toLowerCase() === user.ten.toLowerCase();
  // Phiếu cũ (trước khi có cột nguoiDung): so theo tên đã ghi ở "Người tạo"
  var nt = String(p.nguoiTao || '').trim();
  return nt === user.ten || nt === user.hienThi;
}
function getPhieu_(user) {
  // Tab PhieuXuat / PhieuXuatItems lớn dần theo thời gian → CHỈ dựng object cho 150 phiếu mới nhất mà người
  // dùng được xem (lọc + cắt TRƯỚC), rồi mới gắn dòng hàng của đúng các phiếu đó (không dựng object cho mọi dòng).
  var px = readTab_(TAB.PX);
  var list = [];
  for (var i = px.rows.length - 1; i >= 0 && list.length < 150; i--) { // mới nhất lên đầu
    var o = {};
    var r = px.rows[i];
    px.headers.forEach(function (name, j) { o[name] = r[j] instanceof Date ? r[j].toISOString() : r[j]; });
    if (phieuVisibleTo_(o, user)) list.push(o);
  }
  var want = {};
  list.forEach(function (p) { p.items = []; want[String(p.id).trim()] = p; });
  var pxi = readTab_(TAB.PXI);
  var ih = pxi.headers, pidCol = ih.indexOf('phieuId');
  pxi.rows.forEach(function (r) {
    var p = want[String(pidCol >= 0 ? r[pidCol] : '').trim()];
    if (!p) return;
    var it = {};
    ih.forEach(function (name, j) { it[name] = r[j]; });
    p.items.push(it);
  });
  // (PC 4.58) Phiếu xuất TẠO TRÊN PC (tab PhieuXuat_PC / PhieuXuatItems_PC do PC ghi đè mỗi lần đồng bộ) — gộp vào danh sách để điện thoại XEM.
  // Chỉ đọc: nguon = 'PC', trạng thái "Tạo trên PC" (điện thoại không sửa / xóa được). Ai có quyền xem kho nào thì thấy phiếu PC của kho đó.
  try { list = list.concat(getPhieuPc_(user)); } catch (e) { /* Code.gs mới nhưng PC chưa đẩy lần nào / tab chưa có: bỏ qua */ }
  return { ok: true, list: list };
}
// Phiếu tạo trên PC → cùng dạng với phiếu điện thoại + nguon: 'PC'. Mới nhất lên đầu, tối đa 150 phiếu (như phiếu điện thoại).
function getPhieuPc_(user) {
  var px = readTab_(TAB.PXPC);
  if (!px.headers.length) return [];
  var list = [];
  for (var i = 0; i < px.rows.length; i++) {
    var o = {};
    var r = px.rows[i];
    px.headers.forEach(function (name, j) { o[name] = r[j] instanceof Date ? r[j].toISOString() : r[j]; });
    if (!String(o.id || '').trim()) continue;
    var m = MODULES.indexOf(String(o.module || '').trim()) >= 0 ? String(o.module).trim() : '';
    if (!m) continue;
    if (user && !user.admin && user.kho.indexOf(m) < 0) continue;
    o.nguon = 'PC';
    list.push(o);
  }
  // ĐT 1.35: sắp MỚI NHẤT lên đầu rồi mới cắt 150 (PC ghi đè cả tab nên thứ tự dòng không đáng tin).
  list.sort(function (a, b) { return String(b.ngayTao || '') < String(a.ngayTao || '') ? -1 : String(b.ngayTao || '') > String(a.ngayTao || '') ? 1 : 0; });
  if (list.length > 150) list = list.slice(0, 150);
  var want = {};
  list.forEach(function (p) { p.items = []; want[String(p.id).trim()] = p; });
  var pxi = readTab_(TAB.PXPCI);
  var ih = pxi.headers, pidCol = ih.indexOf('phieuId');
  pxi.rows.forEach(function (r) {
    var p = want[String(pidCol >= 0 ? r[pidCol] : '').trim()];
    if (!p) return;
    var it = {};
    ih.forEach(function (name, j) { it[name] = r[j]; });
    p.items.push(it);
  });
  return list;
}

// Lấy tab theo tên, chưa có thì tạo; đảm bảo dòng tiêu đề có đủ các cột cần dùng.
function ensureTab_(name, headers) {
  var sh = ss_().getSheetByName(name) || ss_().insertSheet(name);
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var row1 = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  if (!row1.some(function (x) { return x; })) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    return { sheet: sh, headers: headers.slice() };
  }
  var cur = row1.slice();
  while (cur.length && !cur[cur.length - 1]) cur.pop();
  var add = headers.filter(function (x) { return cur.indexOf(x) < 0; });
  if (add.length) {
    sh.getRange(1, cur.length + 1, 1, add.length).setValues([add]);
    cur = cur.concat(add);
  }
  return { sheet: sh, headers: cur };
}

// Ghi các dòng (mảng object) vào cuối tab, đúng theo vị trí cột tiêu đề. Ô chữ được định dạng
// "văn bản thuần" TRƯỚC khi ghi để Sheet không tự đổi "0012" thành 12 hay "31/40" thành ngày.
function appendObjects_(tabInfo, objects, numberCols) {
  if (!objects.length) return;
  var sh = tabInfo.sheet, headers = tabInfo.headers;
  var start = sh.getLastRow() + 1;
  var values = objects.map(function (o) {
    return headers.map(function (h) { return o[h] === undefined || o[h] === null ? '' : o[h]; });
  });
  headers.forEach(function (h, i) {
    if ((numberCols || []).indexOf(h) < 0) sh.getRange(start, i + 1, values.length, 1).setNumberFormat('@');
  });
  sh.getRange(start, 1, values.length, headers.length).setValues(values);
}

function createPhieu_(p) {
  if (!p || typeof p !== 'object') throw new Error('Thiếu dữ liệu phiếu.');
  var id = String(p.id || '').trim();
  if (!/^dt_[A-Za-z0-9_-]{6,60}$/.test(id)) throw new Error('Mã nội bộ phiếu không hợp lệ.');
  if (!Array.isArray(p.items) || !p.items.length) throw new Error('Phiếu chưa có dòng hàng nào.');
  if (p.items.length > 300) throw new Error('Một phiếu tối đa 300 dòng hàng.');

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Hệ thống đang bận, vui lòng gửi lại sau ít giây.');
  try {
    var pxTab = ensureTab_(TAB.PX, PX_HEADERS);
    var pxiTab = ensureTab_(TAB.PXI, PXI_HEADERS);
    var px = readTab_(TAB.PX);
    var cId = col_(px.headers, 'id'), cMa = col_(px.headers, 'maPhieu');

    // Gửi lại cùng 1 phiếu (VD mất mạng lúc chờ phản hồi) -> không tạo trùng.
    for (var i = 0; i < px.rows.length; i++) {
      if (String(px.rows[i][cId]).trim() === id) {
        return { ok: true, duplicate: true, maPhieu: String(px.rows[i][cMa]) };
      }
    }

    var module = MODULES.indexOf(p.module) >= 0 ? p.module : 'M02';
    var lsxXuat = '';
    if (module === 'M03') {
      lsxXuat = String(p.lsxXuat || '').trim();
      if (!lsxXuat) throw new Error('Phiếu Module 03 phải chọn "LSX xuất".');
    }
    var pending = pendingByKey_();
    var built = module === 'M01' ? buildItemsM01_(id, p.items, pending)
      : module === 'M01VT' ? buildItemsVT_(id, p.items, pending)
      : module === 'M01VTB' ? buildItemsVTB_(id, p.items, pending)
      : module === 'M03' ? buildItemsKey_(id, p.items, pending, TAB.M03, 'M03', 'Tổng (kg)', ['Mã Hàng', 'Loại Hàng'], ['Vị trí', 'LSX / Hợp đồng'])
      : buildItemsM02_(id, p.items, pending);
    if (built.error) return built.error;

    var maPhieu = String(p.maPhieu || '').trim() || id;
    var used = {};
    px.rows.forEach(function (r) { used[String(r[cMa])] = true; });
    if (used[maPhieu]) { var n = 2; while (used[maPhieu + '-' + n]) n++; maPhieu = maPhieu + '-' + n; }

    appendObjects_(pxiTab, built.items, PXI_NUMBER_COLS);   // dòng hàng TRƯỚC
    SpreadsheetApp.flush();
    appendObjects_(pxTab, [{
      id: id, maPhieu: maPhieu, ngayTao: new Date().toISOString(), trangThai: CHUA_XU_LY,
      nguoiTao: String(p.nguoiTao || '').slice(0, 60), ghiChu: String(p.ghiChu || '').slice(0, 300), xuLyLuc: '',
      module: module, lsxXuat: lsxXuat, nguoiDung: String(p.nguoiDung || '').slice(0, 40)
    }], []);                                           // đầu phiếu SAU
    SpreadsheetApp.flush();
    return { ok: true, maPhieu: maPhieu };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================================
// SỬA / XÓA PHIẾU từ điện thoại — chỉ khi PC CHƯA nhận (trangThai "Chưa xử lý").
// PC đã nhận thì tồn đã bị trừ trong file Excel trên PC: phải hủy/sửa ngay trên PC.
// ============================================================================================
function assertPhieuId_(id) {
  id = String(id || '').trim();
  if (!/^dt_[A-Za-z0-9_-]{6,60}$/.test(id)) throw new Error('Mã nội bộ phiếu không hợp lệ.');
  return id;
}

// Đọc thẳng từ Sheet để có SỐ DÒNG thật (readTab_ bỏ dòng trống nên số dòng bị lệch).
function findPxRow_(id) {
  var sh = ss_().getSheetByName(TAB.PX);
  if (!sh || sh.getLastRow() < 2) return null;
  var vals = sh.getRange(1, 1, sh.getLastRow(), Math.max(sh.getLastColumn(), 1)).getValues();
  var h = vals[0].map(String);
  var cId = h.indexOf('id'), cTT = h.indexOf('trangThai');
  if (cId < 0 || cTT < 0) return null;
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][cId]).trim() !== id) continue;
    var o = {};
    h.forEach(function (name, j) { o[name] = vals[i][j]; });
    return { sheet: sh, row: i + 1, headers: h, cur: o };
  }
  return null;
}

function setPxCell_(f, name, value) {
  var c = f.headers.indexOf(name);
  if (c < 0) return;
  f.sheet.getRange(f.row, c + 1).setNumberFormat('@').setValue(String(value));
}

function editableStatus_(tt) {
  tt = String(tt || '').trim();
  return tt === '' || tt === CHUA_XU_LY || tt === DANG_SUA;
}

function notEditableError_(tt) {
  tt = String(tt || '').trim();
  var msg = tt === DA_XU_LY
    ? 'PC đã nhận phiếu này rồi nên không sửa/xóa được từ điện thoại. Cần hủy thì làm trên app PC.'
    : (tt.indexOf(HUY_PREFIX) === 0 ? 'Phiếu này đã được hủy trước đó.' : 'Phiếu này không sửa được (trạng thái: ' + tt + ').');
  return { ok: false, code: 'DA_XU_LY', error: msg };
}

function findItemRows_(id) {
  var sh = ss_().getSheetByName(TAB.PXI);
  if (!sh || sh.getLastRow() < 2) return [];
  var vals = sh.getRange(1, 1, sh.getLastRow(), Math.max(sh.getLastColumn(), 1)).getValues();
  var c = vals[0].map(String).indexOf('phieuId');
  if (c < 0) return [];
  var rows = [];
  for (var i = 1; i < vals.length; i++) if (String(vals[i][c]).trim() === id) rows.push(i + 1);
  return rows;
}

// rows: số dòng tăng dần. Xóa từ dưới lên, gộp các dòng liền nhau thành 1 lệnh.
function deleteRows_(sh, rows) {
  var i = rows.length - 1;
  while (i >= 0) {
    var end = rows[i], start = end;
    while (i > 0 && rows[i - 1] === start - 1) { i--; start = rows[i]; }
    sh.deleteRows(start, end - start + 1);
    i--;
  }
}

function buildItemsFor_(module, id, items, pending) {
  return module === 'M01' ? buildItemsM01_(id, items, pending)
    : module === 'M01VT' ? buildItemsVT_(id, items, pending)
    : module === 'M01VTB' ? buildItemsVTB_(id, items, pending)
    : module === 'M03' ? buildItemsKey_(id, items, pending, TAB.M03, 'M03', 'Tổng (kg)', ['Mã Hàng', 'Loại Hàng'], ['Vị trí', 'LSX / Hợp đồng'])
    : buildItemsM02_(id, items, pending);
}

// Sửa phiếu: thay TOÀN BỘ dòng hàng + ghi chú (+ LSX xuất với M03). Giữ nguyên mã phiếu, ngày tạo, người tạo.
function editPhieu_(p) {
  if (!p || typeof p !== 'object') throw new Error('Thiếu dữ liệu phiếu.');
  var id = assertPhieuId_(p.id);
  if (!Array.isArray(p.items) || !p.items.length) throw new Error('Phiếu chưa có dòng hàng nào.');
  if (p.items.length > 300) throw new Error('Một phiếu tối đa 300 dòng hàng.');

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Hệ thống đang bận, vui lòng thử lại sau ít giây.');
  try {
    var f = findPxRow_(id);
    if (!f) return { ok: false, code: 'NOT_FOUND', error: 'Không tìm thấy phiếu trên Google Sheet (có thể đã bị xóa).' };
    var tt = String(f.cur.trangThai || '').trim();
    if (!editableStatus_(tt)) return notEditableError_(tt);

    var module = MODULES.indexOf(String(f.cur.module || '').trim()) >= 0 ? String(f.cur.module).trim() : 'M02';
    var lsxXuat = String(f.cur.lsxXuat || '').trim();
    if (module === 'M03') {
      lsxXuat = String(p.lsxXuat || lsxXuat).trim();
      if (!lsxXuat) throw new Error('Phiếu Module 03 phải chọn "LSX xuất".');
    }
    var pxiTab = ensureTab_(TAB.PXI, PXI_HEADERS);

    // "Giữ chỗ": trong lúc sửa, PC bỏ qua phiếu này và tồn "chờ PC" không tính dòng cũ của nó.
    var finalStatus = tt === DANG_SUA ? DANG_SUA : CHUA_XU_LY;   // phiếu kẹt "đang sửa" chỉ được nhả khi sửa xong
    var touched = false;
    setPxCell_(f, 'trangThai', DANG_SUA);
    SpreadsheetApp.flush();
    try {
      var built = buildItemsFor_(module, id, p.items, pendingByKey_());
      if (built.error) return built.error;                       // thiếu hàng: giữ nguyên phiếu cũ
      var oldRows = findItemRows_(id);                           // số dòng cũ, tính TRƯỚC khi thêm dòng mới
      touched = true;
      appendObjects_(pxiTab, built.items, PXI_NUMBER_COLS);      // dòng mới TRƯỚC, xóa dòng cũ SAU
      SpreadsheetApp.flush();
      deleteRows_(pxiTab.sheet, oldRows);
      setPxCell_(f, 'ghiChu', String(p.ghiChu || '').slice(0, 300));
      if (module === 'M03') setPxCell_(f, 'lsxXuat', lsxXuat);
      SpreadsheetApp.flush();
      finalStatus = CHUA_XU_LY;
      return { ok: true, maPhieu: String(f.cur.maPhieu) };
    } catch (err) {
      if (touched) finalStatus = DANG_SUA;                        // đã đụng vào dòng hàng mà lỗi giữa chừng: giữ khóa, sửa lại sẽ dọn sạch
      throw err;
    } finally {
      setPxCell_(f, 'trangThai', finalStatus);
      SpreadsheetApp.flush();
    }
  } finally {
    lock.releaseLock();
  }
}

// Xóa phiếu = HỦY MỀM: đổi trạng thái, không xóa dòng (giữ vết trên Sheet, và số dòng của PC không bị lệch).
function cancelPhieu_(id) {
  id = assertPhieuId_(id);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Hệ thống đang bận, vui lòng thử lại sau ít giây.');
  try {
    var f = findPxRow_(id);
    if (!f) return { ok: false, code: 'NOT_FOUND', error: 'Không tìm thấy phiếu trên Google Sheet (có thể đã bị xóa).' };
    var tt = String(f.cur.trangThai || '').trim();
    if (tt.indexOf(HUY_PREFIX) === 0) return { ok: true, already: true };
    if (!editableStatus_(tt)) return notEditableError_(tt);
    setPxCell_(f, 'trangThai', HUY);
    setPxCell_(f, 'xuLyLuc', new Date().toISOString());
    SpreadsheetApp.flush();
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// Phiếu Module 02: kiểm tra với TonKho_M02 (Số kiện − phiếu đang chờ), khóa = matchKey_.
function buildItemsM02_(id, reqItems, pending) {
    var ton = readTab_(TAB.M02);
    var h = ton.headers;
    var iMa = col_(h, M2.maHang), iLo = col_(h, M2.soLo), iSz = col_(h, M2.size), iPn = col_(h, M2.phieuNhap),
        iSk = col_(h, M2.soKien), iTen = col_(h, M2.tenHang);
    if (iMa < 0 || iSk < 0) throw new Error('Chưa có dữ liệu tồn kho gửi trên Sheet (PC chưa đồng bộ).');
    var rowByKey = {};
    ton.rows.forEach(function (r) { rowByKey[matchKey_(r[iMa], r[iLo], r[iSz], r[iPn])] = r; });

    var want = {};
    var items = reqItems.map(function (it) {
      var qty = Number(it.soLuongXuat);
      if (!(qty > 0)) throw new Error('Số lượng xuất phải lớn hơn 0 (mã ' + it.maHang + ').');
      var k = matchKey_(it.maHang, it.soLo, it.size, it.phieuNhap);
      var r = rowByKey[k];
      if (!r) throw new Error('Lô ' + it.maHang + ' / ' + it.soLo + ' không còn trong tồn kho mới nhất — tải lại danh sách.');
      want[k] = (want[k] || 0) + qty;
      return {
        phieuId: id, maHang: r[iMa], tenHang: iTen >= 0 ? r[iTen] : (it.tenHang || ''),
        phieuNhap: iPn >= 0 ? r[iPn] : '', soLo: iLo >= 0 ? r[iLo] : '', size: iSz >= 0 ? r[iSz] : '',
        soKien: Number(r[iSk]) || 0, soLuongXuat: qty
      };
    });
    var thieu = [];
    Object.keys(want).forEach(function (k) {
      var con = (Number(rowByKey[k][iSk]) || 0) - (pending[k] || 0);
      if (want[k] > con + 1e-9) thieu.push(rowByKey[k][iMa] + ' lô ' + rowByKey[k][iLo] + ': còn ' + con + ', xin xuất ' + want[k]);
    });
    if (thieu.length) return { error: { ok: false, code: 'THIEU_HANG', error: 'Không đủ hàng:\n' + thieu.join('\n') } };
    return { items: items };
}

// Phiếu Module 01: kiểm tra với TonKho_M01 ("Tồn cuối" − phiếu đang chờ), dòng xác định bằng cột
// "_key" (Item ID, hoặc số thứ tự dòng khi dữ liệu không có Item ID) do app PC đẩy lên.
function buildItemsM01_(id, reqItems, pending) {
  var ton = readTab_(TAB.M01);
  var h = ton.headers;
  var iKey = h.indexOf('_key'), iRow = h.indexOf('_row'), iTon = findHeader_(h, 'Tồn cuối'),
      iMa = findHeader_(h, 'Mã hàng'), iTen = findHeader_(h, 'Tên hàng'), iSz = findHeader_(h, 'Size'),
      iHd = findHeader_(h, 'Hợp đồng');
  if (iKey < 0 || iTon < 0) throw new Error('Tồn kho Module 01 trên Sheet chưa đúng định dạng — trên PC bấm "Đồng bộ ngay" rồi thử lại.');
  var rowByKey = {};
  ton.rows.forEach(function (r) { rowByKey[String(r[iKey]).trim()] = r; });

  var want = {};
  var items = reqItems.map(function (it) {
    var qty = Number(it.soLuongXuat);
    if (!(qty > 0)) throw new Error('Số lượng xuất phải lớn hơn 0 (mã ' + it.maHang + ').');
    var key = String(it.itemKey || '').trim();
    var r = rowByKey[key];
    if (!r) throw new Error('Dòng ' + it.maHang + ' không còn trong tồn kho mới nhất — tải lại danh sách.');
    want[key] = (want[key] || 0) + qty;
    return {
      phieuId: id, maHang: iMa >= 0 ? r[iMa] : (it.maHang || ''), tenHang: iTen >= 0 ? r[iTen] : (it.tenHang || ''),
      phieuNhap: '', soLo: '', size: iSz >= 0 ? r[iSz] : '', soKien: looseNum_(r[iTon]), soLuongXuat: qty,
      itemKey: key, rowIndex: iRow >= 0 ? r[iRow] : '', hopDong: iHd >= 0 ? r[iHd] : ''
    };
  });
  var thieu = [];
  Object.keys(want).forEach(function (key) {
    var r = rowByKey[key];
    var con = looseNum_(r[iTon]) - (pending['M01|' + key] || 0);
    if (want[key] > con + 1e-9) thieu.push((iMa >= 0 ? r[iMa] : key) + ': còn ' + con + ', xin xuất ' + want[key]);
  });
  if (thieu.length) return { error: { ok: false, code: 'THIEU_HANG', error: 'Không đủ hàng:\n' + thieu.join('\n') } };
  return { items: items };
}

// Phiếu Module 01 › Tồn theo vị trí: kiểm tra với TonKho_M01_ViTri ("SL Tồn" − phiếu đang chờ),
// dòng xác định bằng cột "_key" (Mã hàng|Lô|Vị trí#thứ tự trùng) do app PC đẩy lên.
function buildItemsVT_(id, reqItems, pending) {
  var ton = readTab_(TAB.VITRI);
  var h = ton.headers;
  var iKey = h.indexOf('_key'), iSl = findHeader_(h, 'SL Tồn'), iMa = findHeader_(h, 'Mã hàng'),
      iTen = findHeader_(h, 'Tên hàng'), iLo = findHeader_(h, 'Lô (Batch)'), iVt = findHeader_(h, 'Vị trí');
  if (iKey < 0 || iSl < 0) throw new Error('Tồn theo vị trí trên Sheet chưa đúng định dạng — trên PC bấm "Đồng bộ ngay" rồi thử lại.');
  var rowByKey = {};
  ton.rows.forEach(function (r) { rowByKey[String(r[iKey]).trim()] = r; });
  var want = {};
  var items = reqItems.map(function (it) {
    var qty = Number(it.soLuongXuat);
    if (!(qty > 0)) throw new Error('Số lượng xuất phải lớn hơn 0 (mã ' + it.maHang + ').');
    var key = String(it.itemKey || '').trim();
    var r = rowByKey[key];
    if (!r) throw new Error('Dòng ' + it.maHang + ' tại ' + (it.viTri || '') + ' không còn trong tồn theo vị trí mới nhất — tải lại danh sách.');
    want[key] = (want[key] || 0) + qty;
    return {
      phieuId: id, maHang: iMa >= 0 ? r[iMa] : (it.maHang || ''), tenHang: iTen >= 0 ? r[iTen] : (it.tenHang || ''),
      phieuNhap: '', soLo: iLo >= 0 ? r[iLo] : '', size: '', soKien: looseNum_(r[iSl]), soLuongXuat: qty,
      itemKey: key, rowIndex: '', hopDong: '', viTri: iVt >= 0 ? r[iVt] : ''
    };
  });
  var thieu = [];
  Object.keys(want).forEach(function (key) {
    var r = rowByKey[key];
    var con = looseNum_(r[iSl]) - (pending['VT|' + key] || 0);
    if (want[key] > con + 1e-9) thieu.push((iMa >= 0 ? r[iMa] : key) + ' @ ' + (iVt >= 0 ? r[iVt] : '') + ': còn ' + con + ', xin xuất ' + want[key]);
  });
  if (thieu.length) return { error: { ok: false, code: 'THIEU_HANG', error: 'Không đủ hàng:\n' + thieu.join('\n') } };
  return { items: items };
}

// Phiếu Module 03: dòng xác định bằng cột "_key" (mã lô)
// do app PC đẩy lên; số lượng tồn ở cột qtyCol trừ phiếu đang chờ ('M03|key').
// nameCols: cột dùng làm Mã hàng / Tên hàng; extraCols: 2 cột ghi vào soLo / viTri để dễ đọc.
function buildItemsKey_(id, reqItems, pending, tab, mod, qtyCol, nameCols, extraCols) {
  var ton = readTab_(tab);
  var h = ton.headers;
  var iKey = h.indexOf('_key'), iQty = findHeader_(h, qtyCol), iMa = findHeader_(h, nameCols[0]),
      iTen = findHeader_(h, nameCols[1]), iX1 = findHeader_(h, extraCols[0]), iX2 = findHeader_(h, extraCols[1]);
  if (iKey < 0 || iQty < 0) throw new Error('Tồn kho ' + mod + ' trên Sheet chưa có — trên PC bấm "Đồng bộ ngay" rồi thử lại.');
  var rowByKey = {};
  ton.rows.forEach(function (r) { rowByKey[String(r[iKey]).trim()] = r; });
  var want = {};
  var items = reqItems.map(function (it) {
    var qty = Number(it.soLuongXuat);
    if (!(qty > 0)) throw new Error('Số lượng xuất phải lớn hơn 0 (mã ' + it.maHang + ').');
    var key = String(it.itemKey || '').trim();
    var r = rowByKey[key];
    if (!r) throw new Error('Dòng ' + (it.maHang || key) + ' không còn trong tồn kho mới nhất — tải lại danh sách.');
    want[key] = (want[key] || 0) + qty;
    return {
      phieuId: id, maHang: iMa >= 0 ? r[iMa] : (it.maHang || ''), tenHang: iTen >= 0 ? r[iTen] : (it.tenHang || ''),
      phieuNhap: '', soLo: iX2 >= 0 ? r[iX2] : '', size: '', soKien: looseNum_(r[iQty]), soLuongXuat: qty,
      itemKey: key, rowIndex: '', hopDong: '', viTri: iX1 >= 0 ? r[iX1] : ''
    };
  });
  var thieu = [];
  Object.keys(want).forEach(function (key) {
    var r = rowByKey[key];
    var con = looseNum_(r[iQty]) - (pending[mod + '|' + key] || 0);
    if (want[key] > con + 1e-6) thieu.push((iMa >= 0 ? r[iMa] : key) + (iX1 >= 0 ? ' @ ' + r[iX1] : '') + ': còn ' + con + ', xin xuất ' + want[key]);
  });
  if (thieu.length) return { error: { ok: false, code: 'THIEU_HANG', error: 'Không đủ hàng:\n' + thieu.join('\n') } };
  return { items: items };
}

// Phiếu Module 01 › Vị Trí Bột: tab TonKho_M01_ViTriBot (PC đẩy: Vị trí, Mã hàng, SL, NSX, HSD, Nhập,
// Ghi chú, _key). Khóa dòng "_key" = Mã hàng|Vị trí|NSX|HSD#thứ tự trùng — GIỐNG vtbRowKeys() trong main.js
// và vtbPhoneKeys() trong ton-kho-an-an.js. soLo = NSX, tenHang = Ghi chú (chỉ để đọc cho dễ trên Sheet).
function buildItemsVTB_(id, reqItems, pending) {
  return buildItemsKey_(id, reqItems, pending, TAB.VITRIBOT, 'M01VTB', 'SL', ['Mã hàng', 'Ghi chú'], ['Vị trí', 'NSX']);
}

// ============================================================================================
// CÁC LỆNH DÀNH RIÊNG CHO APP PC (PC_TOKEN) — xem app/sheets-webapp-client.js
// ============================================================================================
var PC_ALLOWED_TABS = [TAB.PQ, TAB.M01, TAB.VITRI, TAB.VITRIBOT, TAB.M02, TAB.M03, TAB.M03_LSX, TAB.META, TAB.PX, TAB.PXI,
  TAB.M08_MAHOA, TAB.M08_MADATAO, TAB.M08_TONGHOP, TAB.M08_RADONG, TAB.M08_SIZE, TAB.M08_ANHXA, TAB.M08_KS, TAB.M08_KSXOA, TAB.M01_BAOCAO, TAB.M02_BAOCAO, TAB.LX, TAB.LX_THANG, TAB.LX_YC, TAB.LX_EM, TAB.C3D, TAB.PX_LUUTRU, TAB.PXI_LUUTRU, TAB.PXPC, TAB.PXPCI];
function assertPcTab_(name) {
  if (PC_ALLOWED_TABS.indexOf(name) < 0) throw new Error('Không được phép thao tác tab "' + name + '".');
}

// PC 2.07 — Drive cá nhân: Client ID / Client secret (OAuth, loại Desktop app) lưu ở Thuộc tính tập lệnh DRIVE_CLIENT_ID / DRIVE_CLIENT_SECRET.
// Chỉ app PC có PC_TOKEN gọi được (đã kiểm ở doPost); app điện thoại không có đường tới đây. Secret để trống khi lưu = giữ secret cũ.
function pcDriveClientGet_() {
  var p = PropertiesService.getScriptProperties();
  var id = String(p.getProperty('DRIVE_CLIENT_ID') || '').trim();
  if (!id) return { ok: true, empty: true };
  return { ok: true, clientId: id, clientSecret: String(p.getProperty('DRIVE_CLIENT_SECRET') || '') };
}
function pcDriveClientSet_(clientId, clientSecret) {
  var id = String(clientId || '').trim();
  if (!id) throw new Error('Thiếu Client ID.');
  var p = PropertiesService.getScriptProperties();
  p.setProperty('DRIVE_CLIENT_ID', id);
  if (String(clientSecret || '').trim()) p.setProperty('DRIVE_CLIENT_SECRET', String(clientSecret).trim());
  return { ok: true };
}

// PC 1.61 — Mã truy cập GitHub (token chỉ-đọc 1 kho) lưu ở Thuộc tính tập lệnh GITHUB_TOKEN. Chỉ app PC có PC_TOKEN gọi được (đã kiểm ở doPost).
// token rỗng khi lưu = XÓA mã đang chia sẻ.
function pcGhTokenGet_() {
  var t = String(PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN') || '').trim();
  return t ? { ok: true, token: t } : { ok: true, empty: true };
}
function pcGhTokenSet_(token) {
  var p = PropertiesService.getScriptProperties(), t = String(token || '').trim();
  if (t) p.setProperty('GITHUB_TOKEN', t); else p.deleteProperty('GITHUB_TOKEN');
  return { ok: true, cleared: !t };
}

// PC 3.21 — NGUỒN CẬP NHẬT (kho + nhánh + mã) trong Thuộc tính tập lệnh. Sửa trực tiếp ở Project Settings › Script properties cũng được (không cần triển khai lại),
// hoặc admin bấm Lưu ở Cài đặt › Cập nhật trong app PC. Trường để trống khi LƯU = không đổi (trừ khi gửi rõ chuỗi rỗng '' → xóa trường đó).
function pcGhSourceGet_() {
  var p = PropertiesService.getScriptProperties();
  var repo = String(p.getProperty('GITHUB_REPO') || '').trim(), branch = String(p.getProperty('GITHUB_BRANCH') || '').trim(), token = String(p.getProperty('GITHUB_TOKEN') || '').trim();
  return (repo || branch || token) ? { ok: true, repo: repo, branch: branch, token: token } : { ok: true, empty: true };
}
function pcGhSourceSet_(req) {
  var p = PropertiesService.getScriptProperties();
  [['GITHUB_REPO', 'repo'], ['GITHUB_BRANCH', 'branch'], ['GITHUB_TOKEN', 'token']].forEach(function (kv) {
    if (req[kv[1]] === undefined || req[kv[1]] === null) return;   // không gửi = giữ nguyên
    var v = String(req[kv[1]]).trim();
    if (v) p.setProperty(kv[0], v); else p.deleteProperty(kv[0]);
  });
  return { ok: true };
}

// tabs: { tenTab: [tiêu đề...] | null }
function pcEnsureTabs_(tabs) {
  Object.keys(tabs || {}).forEach(function (name) {
    assertPcTab_(name);
    if (tabs[name] && tabs[name].length) ensureTab_(name, tabs[name]);
    else if (!ss_().getSheetByName(name)) ss_().insertSheet(name);
  });
  return { ok: true };
}

// Ghi đè toàn bộ 1 tab. Ghi dữ liệu mới TRƯỚC, xóa phần thừa SAU — điện thoại đọc giữa chừng
// không bao giờ thấy tab trống. Cột toàn số giữ kiểu số; cột có chữ được định dạng "văn bản
// thuần" để Sheet không tự đổi "0012" → 12 hay "31/40" → ngày tháng.
function pcWriteTable_(name, columns, rows) {
  assertPcTab_(name);
  if (!Array.isArray(columns) || !columns.length) columns = ['(không có dữ liệu)'];
  rows = Array.isArray(rows) ? rows : [];
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Sheet đang bận, thử lại sau.');
  try {
    var sh = ss_().getSheetByName(name) || ss_().insertSheet(name);
    if (name === TAB.PQ) pcBackupPq_(sh); // PC 7.95: lưu bản sao danh sách tài khoản TRƯỚC khi ghi đè
    var nCols = columns.length;
    var values = [columns.map(String)].concat(rows.map(function (r) {
      var out = [];
      for (var j = 0; j < nCols; j++) out.push(r[j] === null || r[j] === undefined ? '' : r[j]);
      return out;
    }));
    // Đủ chỗ cho bảng mới (tab mới tạo chỉ có 1000 dòng x 26 cột).
    if (sh.getMaxRows() < values.length) sh.insertRowsAfter(sh.getMaxRows(), values.length - sh.getMaxRows());
    if (sh.getMaxColumns() < nCols) sh.insertColumnsAfter(sh.getMaxColumns(), nCols - sh.getMaxColumns());

    if (values.length > 1) {
      for (var c = 0; c < nCols; c++) {
        var allNum = true;
        for (var i = 1; i < values.length; i++) {
          var v = values[i][c];
          if (v !== '' && typeof v !== 'number') { allNum = false; break; }
        }
        sh.getRange(2, c + 1, values.length - 1, 1).setNumberFormat(allNum ? 'General' : '@');
        if (!allNum) for (var k = 1; k < values.length; k++) values[k][c] = values[k][c] === '' ? '' : String(values[k][c]);
      }
    }
    sh.getRange(1, 1, 1, nCols).setNumberFormat('@');
    sh.getRange(1, 1, values.length, nCols).setValues(values);

    var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
    if (lastRow > values.length) sh.getRange(values.length + 1, 1, lastRow - values.length, Math.max(lastCol, 1)).clearContent();
    if (lastCol > nCols) sh.getRange(1, nCols + 1, Math.max(lastRow, 1), lastCol - nCols).clearContent();
    SpreadsheetApp.flush();
    return { ok: true, rows: rows.length };
  } finally {
    lock.releaseLock();
  }
}

// PC 7.95 — BẢN SAO tab PhanQuyen trước mỗi lần ghi đè. Danh sách tài khoản mất là mất trên MỌI máy + điện thoại (các máy đồng bộ theo Sheet và xóa theo),
// nên mỗi lần PC ghi đè tab này, bản cũ được chép sang tab ẩn "PhanQuyen_BanLuu_<ngày_giờ>" (giữ 5 bản mới nhất). Khôi phục: chạy hàm khoiPhucPhanQuyen()
// trong trình soạn Apps Script (lấy bản mới nhất), hoặc hiện tab ẩn (chuột phải tên tab → Xem các trang tính ẩn) rồi chép lại.
// Lỗi ở bước này KHÔNG được làm hỏng lần ghi chính.
var PQ_BACKUP_PREFIX_ = 'PhanQuyen_BanLuu_', PQ_BACKUP_KEEP_ = 5;
function pcBackupPq_(sh) {
  try {
    if (sh.getLastRow() < 2 || sh.getLastColumn() < 1) return; // chưa có tài khoản nào → không cần sao
    var book = ss_();
    var tz = Session.getScriptTimeZone() || 'GMT+7';
    var name = PQ_BACKUP_PREFIX_ + Utilities.formatDate(new Date(), tz, 'yyyyMMdd_HHmmss');
    if (book.getSheetByName(name)) return;
    var copy = sh.copyTo(book);
    copy.setName(name);
    try { copy.hideSheet(); } catch (e1) { /* không ẩn được thì để hiện */ }
    var olds = book.getSheets().map(function (x) { return x.getName(); }).filter(function (n) { return n.indexOf(PQ_BACKUP_PREFIX_) === 0; }).sort().reverse();
    olds.slice(PQ_BACKUP_KEEP_).forEach(function (n) { try { book.deleteSheet(book.getSheetByName(n)); } catch (e2) { /* bỏ qua */ } });
  } catch (e) { /* không chặn việc ghi chính */ }
}
// CHẠY TAY khi cần: chép bản sao mới nhất (PhanQuyen_BanLuu_…) về tab PhanQuyen. Sau đó mở app PC → Cài đặt › Tài khoản › "Kéo từ Sheet".
function khoiPhucPhanQuyen() {
  var book = ss_();
  var names = book.getSheets().map(function (x) { return x.getName(); }).filter(function (n) { return n.indexOf(PQ_BACKUP_PREFIX_) === 0; }).sort().reverse();
  if (!names.length) throw new Error('Chưa có bản sao nào (PhanQuyen_BanLuu_…).');
  var src = book.getSheetByName(names[0]).getDataRange().getValues();
  var dst = book.getSheetByName(TAB.PQ) || book.insertSheet(TAB.PQ);
  dst.clearContents();
  dst.getRange(1, 1, src.length, src[0].length).setNumberFormat('@').setValues(src);
  SpreadsheetApp.flush();
  return 'Đã khôi phục ' + (src.length - 1) + ' tài khoản từ ' + names[0];
}

// Đọc 1 tab: { headers, rows } — rows là mảng giá trị, kèm số dòng thật trên Sheet (rowNumbers).
function pcReadTable_(name) {
  assertPcTab_(name);
  var sh = ss_().getSheetByName(name);
  if (!sh || sh.getLastRow() < 1) return { ok: true, headers: [], rows: [], rowNumbers: [] };
  var values = sh.getDataRange().getValues();
  var headers = values[0].map(String);
  var rows = [], rowNumbers = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (!r.some(function (c) { return c !== '' && c !== null; })) continue;
    rows.push(r.map(function (c) { return c instanceof Date ? c.toISOString() : c; }));
    rowNumbers.push(i + 1);
  }
  return { ok: true, headers: headers, rows: rows, rowNumbers: rowNumbers };
}

// updates: [{ rowNumber, values: { tenCot: giaTri } }] — tìm cột theo tên tiêu đề.
function pcMarkRows_(name, updates) {
  assertPcTab_(name);
  if (!Array.isArray(updates) || !updates.length) return { ok: true, updated: 0 };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Sheet đang bận, thử lại sau.');
  try {
    var sh = ss_().getSheetByName(name);
    if (!sh) throw new Error('Không có tab "' + name + '".');
    var headers = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(String);
    // AN TOÀN (09/2026): PC gửi kèm "id" phiếu → kiểm tra dòng rowNumber đúng là phiếu đó. Dòng đã dịch chuyển
    // (VD vừa lưu trữ phiếu cũ, xóa dòng) thì tìm lại theo id; không thấy thì BỎ QUA thay vì ghi nhầm phiếu khác.
    var cId = headers.indexOf('id'), idRow = null, skipped = 0;
    var rowOfId = function (id) {
      if (!idRow) {
        idRow = {};
        var last = sh.getLastRow();
        if (last >= 2) sh.getRange(2, cId + 1, last - 1, 1).getValues().forEach(function (v, i) { idRow[String(v[0]).trim()] = i + 2; });
      }
      return idRow[id] || 0;
    };
    updates.forEach(function (u) {
      var rowNumber = u.rowNumber;
      if (u.id && cId >= 0) {
        var want = String(u.id).trim();
        if (String(sh.getRange(rowNumber, cId + 1).getValue()).trim() !== want) rowNumber = rowOfId(want);
        if (!rowNumber) { skipped++; return; }
      }
      Object.keys(u.values || {}).forEach(function (col) {
        var idx = headers.indexOf(col);
        if (idx < 0) throw new Error('Tab "' + name + '" thiếu cột "' + col + '".');
        sh.getRange(rowNumber, idx + 1).setNumberFormat('@').setValue(String(u.values[col]));
      });
    });
    SpreadsheetApp.flush();
    return { ok: true, updated: updates.length - skipped, skipped: skipped };
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------------------------
// LƯU TRỮ PHIẾU CŨ (09/2026) — tab PhieuXuat / PhieuXuatItems tăng mãi; mọi lần điện thoại hỏi tồn
// (pendingByKey_) và PC kéo phiếu đều đọc CẢ tab → càng dùng lâu càng chậm. PC gọi "pc.archive" (tối đa
// 1 lần/ngày, SAU khi kéo + đánh dấu phiếu xong, trong khóa đồng bộ của PC) để CHUYỂN (không xóa mất) phiếu:
//   - trạng thái "Đã xử lý" mà PC đã đẩy tồn SAU lúc xử lý (không còn tính "đang chờ" — đúng điều kiện
//     pendingByKey_), hoặc trạng thái bắt đầu bằng "Lỗi" (không bao giờ tính);
//   - và xử lý (xuLyLuc, thiếu thì ngayTao) cách đây hơn `days` ngày (mặc định 90, tối thiểu 30).
// Phiếu "Chưa xử lý" / "Đang sửa" KHÔNG BAO GIỜ bị chuyển. Ghi sang tab lưu trữ TRƯỚC, xóa ở tab chính SAU
// (lỗi giữa chừng chỉ có thể làm phiếu có mặt ở cả 2 nơi, không bao giờ mất). Giữ khóa script suốt quá trình
// → điện thoại tạo / sửa phiếu cùng lúc phải đợi, không chen ngang.
// ---------------------------------------------------------------------------------------------
function pcArchive_(days) {
  days = Math.max(30, Number(days) || 90);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Sheet đang bận, thử lại sau.');
  try {
    var shPx = ss_().getSheetByName(TAB.PX);
    if (!shPx || shPx.getLastRow() < 2) return { ok: true, moved: 0, movedItems: 0 };
    var cutoff = Date.now() - days * 86400000;
    var meta = getMeta_();
    var lastPushOf = function (mod) { return toDate_(meta['lastPushAt_' + mod] || meta.lastPushAt); };
    var vals = shPx.getDataRange().getValues();
    var h = vals[0].map(String);
    var cId = h.indexOf('id'), cTT = h.indexOf('trangThai'), cXL = h.indexOf('xuLyLuc'), cNT = h.indexOf('ngayTao'), cMod = h.indexOf('module');
    if (cId < 0 || cTT < 0) return { ok: true, moved: 0, movedItems: 0 };
    var move = [], moveRows = [], ids = {};
    for (var i = 1; i < vals.length; i++) {
      var r = vals[i];
      var id = String(r[cId] || '').trim(), tt = String(r[cTT] || '').trim();
      if (!id) continue;
      var loi = tt.indexOf('Lỗi') === 0;
      if (tt !== DA_XU_LY && !loi) continue;                              // còn chờ / đang sửa: giữ
      if (tt === DANG_SUA) continue;
      var t = (cXL >= 0 ? toDate_(r[cXL]) : null) || (cNT >= 0 ? toDate_(r[cNT]) : null);
      if (!t || t.getTime() >= cutoff) continue;                          // chưa đủ cũ
      if (!loi) {
        var m = cMod >= 0 ? String(r[cMod]).trim() : '';
        var lp = lastPushOf(MODULES.indexOf(m) >= 0 ? m : 'M02');
        if (!lp || t.getTime() > lp.getTime()) continue;                  // pendingByKey_ vẫn tính: giữ
      }
      move.push(r); moveRows.push(i + 1); ids[id] = true;
    }
    if (!move.length) return { ok: true, moved: 0, movedItems: 0 };
    var shPxi = ss_().getSheetByName(TAB.PXI);
    var moveI = [], moveIRows = [], hI = [];
    if (shPxi && shPxi.getLastRow() >= 2) {
      var valsI = shPxi.getDataRange().getValues();
      hI = valsI[0].map(String);
      var cP = hI.indexOf('phieuId');
      for (var j = 1; j < valsI.length; j++) {
        if (cP >= 0 && ids[String(valsI[j][cP]).trim()]) { moveI.push(valsI[j]); moveIRows.push(j + 1); }
      }
    }
    var toObjs = function (headers, rows) {
      return rows.map(function (r) { var o = {}; headers.forEach(function (name, k) { if (name) o[name] = r[k] instanceof Date ? r[k].toISOString() : r[k]; }); return o; });
    };
    // 1) GHI sang tab lưu trữ (cùng tên cột, thiếu cột thì ensureTab_ tự thêm)
    appendObjects_(ensureTab_(TAB.PX_LUUTRU, h.filter(String)), toObjs(h, move), []);
    if (moveI.length) appendObjects_(ensureTab_(TAB.PXI_LUUTRU, hI.filter(String)), toObjs(hI, moveI), PXI_NUMBER_COLS);
    SpreadsheetApp.flush();
    // 2) XÓA ở tab chính (từ dưới lên, gộp dòng liền nhau)
    if (moveIRows.length) deleteRows_(shPxi, moveIRows);
    deleteRows_(shPx, moveRows);
    SpreadsheetApp.flush();
    return { ok: true, moved: move.length, movedItems: moveI.length };
  } finally {
    lock.releaseLock();
  }
}


// ===========================================================================================
// KHÁNG SINH — ĐỒNG BỘ "CHỈ PHẦN MỚI" (PC 5.0 / điện thoại 2.0)
// Tab M08_KhangSinh: key | u (lúc sửa cuối, ISO) | v (bản rút gọn JSON). Tab M08_KhangSinhXoa: key | u (lúc xoá).
// PC gửi pc.ksUpsert chỉ các dòng mới / vừa sửa / vừa xoá (lần đầu: full = true, gửi cả bảng theo từng đợt). Cột u do
// Apps Script gán = giờ máy chủ lúc nhận (luôn tăng) — điện thoại dùng làm mốc "kể từ".
// Điện thoại gọi ksSince(since): nhận dòng có u > since + danh sách xoá có u > since + TỔNG số dòng để tự kiểm khớp.
// ===========================================================================================
var KS_COLS = ['key', 'u', 'v'];
function ksTab_(name, cols) {
  var sh = ss_().getSheetByName(name) || ss_().insertSheet(name);
  if (sh.getLastRow() < 1) sh.getRange(1, 1, 1, cols.length).setValues([cols]);
  return sh;
}
function pcKsUpsert_(rows, dels, full) {
  rows = Array.isArray(rows) ? rows : []; dels = Array.isArray(dels) ? dels : [];
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Sheet đang bận, thử lại sau.');
  try {
    var sh = ksTab_(TAB.M08_KS, KS_COLS);
    var data = full ? [] : (sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues() : []);
    var idx = {};
    data.forEach(function (r, i) { idx[String(r[0])] = i; });
    var nowU = new Date().toISOString(); // mốc do MÁY CHỦ gán (không tin đồng hồ máy PC)
    rows.forEach(function (r) {
      var k = String(r[0] || ''); if (!k) return;
      var line = [k, nowU, String(r[2] == null ? '' : r[2])];
      if (idx.hasOwnProperty(k)) data[idx[k]] = line; else { idx[k] = data.length; data.push(line); }
    });
    var delSet = {};
    dels.forEach(function (d) { delSet[String(d[0] || '')] = true; });
    if (dels.length) data = data.filter(function (r) { return !delSet[String(r[0])]; });
    // ghi lại cả tab (đơn giản, chắc chắn; 60.000 dòng × 3 ô vẫn trong vài giây)
    var values = [KS_COLS].concat(data);
    if (sh.getMaxRows() < values.length) sh.insertRowsAfter(sh.getMaxRows(), values.length - sh.getMaxRows());
    sh.getRange(1, 1, values.length, 3).setNumberFormat('@').setValues(values);
    var last = sh.getLastRow();
    if (last > values.length) sh.getRange(values.length + 1, 1, last - values.length, 3).clearContent();
    // danh sách xoá (để điện thoại xoá theo); lần full thì làm mới
    var xs = ksTab_(TAB.M08_KSXOA, ['key', 'u']);
    if (full && xs.getLastRow() > 1) xs.getRange(2, 1, xs.getLastRow() - 1, 2).clearContent();
    if (dels.length) {
      var start = Math.max(xs.getLastRow(), 1) + 1;
      var dv = dels.map(function (d) { return [String(d[0] || ''), nowU]; });
      if (xs.getMaxRows() < start + dv.length) xs.insertRowsAfter(xs.getMaxRows(), start + dv.length - xs.getMaxRows());
      xs.getRange(start, 1, dv.length, 2).setNumberFormat('@').setValues(dv);
    }
    SpreadsheetApp.flush();
    return { ok: true, total: data.length };
  } finally {
    lock.releaseLock();
  }
}
function ksSince_(since) {
  since = String(since || '');
  var sh = ss_().getSheetByName(TAB.M08_KS);
  var data = sh && sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues() : [];
  var rows = [], maxU = since;
  data.forEach(function (r) {
    var k = String(r[0] || ''); if (!k) return;
    var u = String(r[1] || '');
    if (u > maxU) maxU = u;
    if (!since || u > since) rows.push([k, u, String(r[2] == null ? '' : r[2])]);
  });
  var dels = [];
  if (since) {
    var xs = ss_().getSheetByName(TAB.M08_KSXOA);
    var xd = xs && xs.getLastRow() > 1 ? xs.getRange(2, 1, xs.getLastRow() - 1, 2).getValues() : [];
    xd.forEach(function (r) { var u = String(r[1] || ''); if (u > since) { dels.push(String(r[0] || '')); if (u > maxU) maxU = u; } });
  }
  return { ok: true, full: !since, rows: rows, dels: dels, total: data.filter(function (r) { return String(r[0] || ''); }).length, u: maxU };
}

// ============================================================================================
// TÀI KHOẢN DÙNG CHUNG CỦA APP PC C# (PC 1.104 — gộp từ TaiKhoan.gs, trước là Sheet + Apps Script riêng)
// Tab "TaiKhoan": mỗi dòng 1 tài khoản PC; mật khẩu chỉ có mã băm PBKDF2-SHA256 + muối (app PC tạo), không có chữ.
// Dòng tên bắt đầu bằng "#" (vd "#khoa-quan-tri", "#mang-lan") là dòng hệ thống của app PC — đừng sửa tay.
//   - list       : cần token = TK_MA_DOC                    → { ok, users: [...] }
//   - save       : thêm adminKey = TK_MA_QUAN_TRI, user      → thêm / sửa theo username (không phân biệt hoa thường)
//   - replaceAll : thêm adminKey = TK_MA_QUAN_TRI, users[]   → thay cả danh sách
//   - pc.tkCaiMa : (PC_TOKEN) đặt TK_MA_DOC / TK_MA_QUAN_TRI (PC 1.110: ghi đè cả khi máy khác đã đặt — app dùng cho đội nhóm).
// Trả lời KHÔNG có code "AUTH" (app PC dùng code AUTH để nhận ra "đường dẫn trỏ nhầm Web App điện thoại").
// ============================================================================================
var TK_ACTIONS_ = ['list', 'save', 'replaceAll'];
var TK_TAB_ = 'TaiKhoan';
var TK_COT_ = ['username', 'ho_ten', 'vai_tro', 'dang_dung', 'quyen', 'mat_khau_bam', 'muoi', 'cap_nhat_luc', 'cap_nhat_boi', 'email_google'];
var TK_MA_OK_ = /^[A-Za-z0-9]{16,128}$/;

function tkPost_(req, props) {
  try {
    var maDoc = props.getProperty('TK_MA_DOC') || '', maQt = props.getProperty('TK_MA_QUAN_TRI') || '';
    if (!maDoc) return json_({ ok: false, error: 'Google Sheet này chưa bật tài khoản dùng chung. Ở máy Quản trị: Cài đặt máy › Tài khoản dùng chung › "Dùng chung Sheet điện thoại".' });
    if (String(req.token || '') !== maDoc) return json_({ ok: false, error: 'Sai mã kết nối.' });
    var sh = tkTab_();
    if (req.action === 'list') return json_({ ok: true, users: tkRead_(sh) });
    if (!maQt || String(req.adminKey || '') !== maQt)
      return json_({ ok: false, error: 'Máy này không có mã quản trị nên không được sửa tài khoản.' });
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      if (req.action === 'save') { tkSave_(sh, req.user || {}); return json_({ ok: true }); }
      if (req.action === 'replaceAll') {
        var list = req.users || [];
        if (!list.length) return json_({ ok: false, error: 'Danh sách trống.' });
        if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, TK_COT_.length).clearContent();
        for (var i = 0; i < list.length; i++) tkSave_(sh, list[i]);
        return json_({ ok: true });
      }
    } finally {
      lock.releaseLock();
    }
    return json_({ ok: false, error: 'Không có chức năng ' + req.action });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function tkCaiMa_(props, maDoc, maQt) {
  maDoc = String(maDoc || ''); maQt = String(maQt || '');
  if (!TK_MA_OK_.test(maDoc) || !TK_MA_OK_.test(maQt)) return { ok: false, error: 'Mã tài khoản không hợp lệ.' };
  var curDoc = props.getProperty('TK_MA_DOC') || '', curQt = props.getProperty('TK_MA_QUAN_TRI') || '';
  // PC 1.110 (người dùng: "app dùng cho đội nhóm, bỏ bảo mật cao khiến kết nối phức tạp"): máy PC có PC_TOKEN đặt mã là được, kể cả khi máy khác
  // đã đặt trước — không còn chặn "đã bật từ một máy khác". Máy giữ mã cũ đăng nhập lại là tự nối (pcDangNhap).
  props.setProperties({ TK_MA_DOC: maDoc, TK_MA_QUAN_TRI: maQt });
  tkTab_();
  return { ok: true, daCo: !!curDoc };
}

function tkTab_() {
  var ss = ss_();
  var sh = ss.getSheetByName(TK_TAB_);
  if (!sh) {
    sh = ss.insertSheet(TK_TAB_);
    sh.getRange(1, 1, 1, TK_COT_.length).setValues([TK_COT_]).setFontWeight('bold');
    sh.getRange(1, 1, 1000, TK_COT_.length).setNumberFormat('@');
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < TK_COT_.length) {
    sh.getRange(1, 1, 1, TK_COT_.length).setValues([TK_COT_]).setFontWeight('bold');
    sh.getRange(1, 1, 1000, TK_COT_.length).setNumberFormat('@');
  }
  return sh;
}

function tkRead_(sh) {
  var n = sh.getLastRow();
  if (n < 2) return [];
  var head = sh.getRange(1, 1, 1, TK_COT_.length).getValues()[0].map(String);
  var rows = sh.getRange(2, 1, n - 1, TK_COT_.length).getValues();
  var res = [];
  for (var i = 0; i < rows.length; i++) {
    var o = {};
    for (var j = 0; j < head.length; j++) o[head[j]] = rows[i][j] === null ? '' : String(rows[i][j]);
    if (o.username) res.push(o);
  }
  return res;
}

function tkSave_(sh, u) {
  var name = String(u.username || '').trim();
  if (!name) throw new Error('Thiếu tên đăng nhập.');
  var row = TK_COT_.map(function (c) { return tkSafe_(u[c]); });
  var n = sh.getLastRow();
  var at = -1;
  if (n >= 2) {
    var names = sh.getRange(2, 1, n - 1, 1).getValues();
    for (var i = 0; i < names.length; i++)
      if (String(names[i][0]).replace(/^'/, '').toLowerCase() === name.toLowerCase()) { at = i + 2; break; }
  }
  if (at < 0) at = Math.max(n, 1) + 1;
  var r = sh.getRange(at, 1, 1, TK_COT_.length);
  r.setNumberFormat('@');
  r.setValues([row]);
}

// Chữ bắt đầu bằng = + - @ bị Google Sheet hiểu là công thức → thêm dấu ' để giữ nguyên là chữ.
function tkSafe_(v) {
  var s = v === undefined || v === null ? '' : String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

// PC 1.109 — đặt lại 2 mã tài khoản dùng chung (PC_TOKEN, chỉ Quản trị trên app PC mới có nút). Ghi đè mã cũ dù máy khác đã đặt;
// các máy giữ mã cũ sẽ báo "Sai mã kết nối" rồi tự nối lại khi đăng nhập (pcDangNhap). Tab TaiKhoan giữ nguyên — app PC hỏi Quản trị
// "dùng danh sách trên Sheet" hay "thay bằng danh sách máy này" rồi mới replaceAll.
function tkDatLaiMa_(props, maDoc, maQt) {
  maDoc = String(maDoc || ''); maQt = String(maQt || '');
  if (!TK_MA_OK_.test(maDoc) || !TK_MA_OK_.test(maQt)) return { ok: false, error: 'Mã tài khoản không hợp lệ.' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var had = !!props.getProperty('TK_MA_DOC');
    props.setProperties({ TK_MA_DOC: maDoc, TK_MA_QUAN_TRI: maQt });
    var sh = tkTab_();
    var n = tkRead_(sh).filter(function (o) { return String(o.username).replace(/^'/, '').charAt(0) !== '#'; }).length;
    return { ok: true, daCo: had, soTaiKhoan: n };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================================
// MÁY PC MỚI CHỈ CẦN ĐĂNG NHẬP (PC 1.106 — lệnh pcDangNhap, không cần mã)
// Máy mới gửi { action: 'pcDangNhap', ten, matKhau } → kiểm mật khẩu bằng chính mã băm ở tab TaiKhoan
// (PBKDF2-HMAC-SHA256, 100 000 vòng, 32 byte; cột mat_khau_bam / muoi dạng "h:<hex>" hoặc base64 — giống AuthService của app PC).
// Đúng → { ok, ten, maDoc: TK_MA_DOC, pcToken: PC_TOKEN, gh: KL_GH_TOKEN } (KHÔNG trả mã quản trị). Sai → báo, đếm lần sai:
//   5 lần / tài khoản trong 15 phút → khóa tài khoản đó 15 phút (khoa: true); 30 lần chung trong 10 phút → khóa mọi lệnh này 10 phút.
// Trả lời: chuaBat (tab TaiKhoan chưa bật / trống), chuaCo (không có tài khoản), khoa (đang khóa), error "Sai tên đăng nhập…" (sai mật khẩu / tắt).
// dnKiemMk_ viết JavaScript thuần (không dùng Utilities) để kiểm bằng node — tests/KhoLanh.Core.Tests/Data/dangnhap-maymoi-golden.gen.js của app PC.
// ============================================================================================
var DN_SAI_TK = 5, DN_KHOA_TK_PHUT = 15, DN_SAI_CHUNG = 30, DN_CUA_SO_PHUT = 10, DN_KHOA_CHUNG_PHUT = 10, DN_VONG = 100000;

function dnPost_(req, props) {
  try {
    if (!props.getProperty('TK_MA_DOC')) return { ok: false, chuaBat: true, error: 'Google Sheet chung chưa bật tài khoản dùng chung.' };
    var cache = CacheService.getScriptCache();
    if (cache.get('dnKhoaChung')) return { ok: false, khoa: true, error: 'Có quá nhiều lần đăng nhập sai — tạm khóa đăng nhập máy mới ' + DN_KHOA_CHUNG_PHUT + ' phút.' };
    var ten = String(req.ten || '').replace(/^'/, '').trim(), mk = String(req.matKhau || '');
    if (!ten || !mk) return { ok: false, error: 'Nhập tên đăng nhập và mật khẩu.' };
    if (ten.charAt(0) === '#' || ten.length > 60) return { ok: false, error: 'Sai tên đăng nhập hoặc mật khẩu.' };
    var key = 'dnSai_' + ten.toLowerCase();
    if (Number(cache.get(key) || 0) >= DN_SAI_TK)
      return { ok: false, khoa: true, error: 'Tài khoản này nhập sai mật khẩu ' + DN_SAI_TK + ' lần — tạm khóa đăng nhập máy mới ' + DN_KHOA_TK_PHUT + ' phút.' };
    var rows = tkRead_(tkTab_()), u = null, coTk = false;
    for (var i = 0; i < rows.length; i++) {
      var name = String(rows[i].username).replace(/^'/, '').trim();
      if (name.charAt(0) === '#') continue;
      coTk = true;
      if (name.toLowerCase() === ten.toLowerCase()) { u = rows[i]; break; }
    }
    if (!coTk) return { ok: false, chuaBat: true, error: 'Google Sheet chung chưa có danh sách tài khoản.' };
    var v = function (k) { return String(u && u[k] || '').replace(/^'/, '').trim(); };
    var ok = !!u && v('dang_dung') === '1' && v('muoi') !== '' && dnKiemMk_(mk, v('muoi'), v('mat_khau_bam'));
    if (!ok) {
      dnDemSai_(cache, key);
      if (!u) return { ok: false, chuaCo: true, error: 'Tài khoản "' + ten + '" chưa có trên Google Sheet chung.' };
      return { ok: false, error: 'Sai tên đăng nhập hoặc mật khẩu (hoặc tài khoản đã bị khóa / tắt trên Sheet).' };
    }
    cache.remove(key);
    return { ok: true, ten: v('username'), maDoc: props.getProperty('TK_MA_DOC'), pcToken: props.getProperty('PC_TOKEN') || '',
      gh: props.getProperty('KL_GH_TOKEN') || props.getProperty('GITHUB_TOKEN') || '' };
  } catch (err) {
    return { ok: false, error: String(err && err.message || err) };
  }
}

function dnDemSai_(cache, key) {
  try {
    cache.put(key, String(Number(cache.get(key) || 0) + 1), DN_KHOA_TK_PHUT * 60);
    var n = Number(cache.get('dnSaiChung') || 0) + 1;
    cache.put('dnSaiChung', String(n), DN_CUA_SO_PHUT * 60);
    if (n >= DN_SAI_CHUNG) { cache.put('dnKhoaChung', '1', DN_KHOA_CHUNG_PHUT * 60); cache.remove('dnSaiChung'); }
  } catch (e) { /* bộ đệm lỗi: không chặn */ }
}

/** Mật khẩu (chữ) khớp muối + mã băm ("h:hex" hoặc base64) theo PBKDF2-HMAC-SHA256 DN_VONG vòng. */
function dnKiemMk_(mk, muoi, bam) {
  var salt = dnBytes_(muoi), want = dnBytes_(bam);
  if (!salt || !want || !want.length) return false;
  var got = dnPbkdf2_(dnUtf8_(String(mk)), salt, DN_VONG, want.length);
  var diff = 0;
  for (var i = 0; i < want.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

function dnBytes_(s) {
  s = String(s || '').trim();
  try {
    if (s.indexOf('h:') === 0) {
      var h = s.slice(2);
      if (h.length % 2 || /[^0-9a-fA-F]/.test(h)) return null;
      var out = [];
      for (var i = 0; i < h.length; i += 2) out.push(parseInt(h.substr(i, 2), 16));
      return out;
    }
    return dnBase64_(s);
  } catch (e) { return null; }
}

function dnBase64_(s) {
  var abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', out = [], buf = 0, bits = 0;
  s = s.replace(/=+$/, '');
  for (var i = 0; i < s.length; i++) {
    var c = abc.indexOf(s.charAt(i));
    if (c < 0) return null;
    buf = (buf << 6) | c; bits += 6;
    if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 255); }
  }
  return out;
}

function dnUtf8_(s) {
  var out = [];
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c >= 0xD800 && c <= 0xDBFF && i + 1 < s.length) {
      var d = s.charCodeAt(i + 1);
      if (d >= 0xDC00 && d <= 0xDFFF) { c = 0x10000 + ((c - 0xD800) << 10) + (d - 0xDC00); i++; }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

var DN_K_ = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
var DN_H0_ = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

/** Nén 1 khối 64 byte (16 từ w[0..15]) vào trạng thái st (8 từ) — SHA-256. */
function dnNen_(st, w, W) {
  var i, a = st[0], b = st[1], c = st[2], d = st[3], e = st[4], f = st[5], g = st[6], h = st[7], t1, t2, x, y;
  for (i = 0; i < 16; i++) W[i] = w[i] | 0;
  for (i = 16; i < 64; i++) {
    x = W[i - 15]; y = W[i - 2];
    W[i] = (((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3)) + W[i - 16]
      + (((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10)) + W[i - 7] | 0;
  }
  for (i = 0; i < 64; i++) {
    t1 = h + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) + ((e & f) ^ (~e & g)) + DN_K_[i] + W[i] | 0;
    t2 = (((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) + ((a & b) ^ (a & c) ^ (b & c)) | 0;
    h = g; g = f; f = e; e = d + t1 | 0; d = c; c = b; b = a; a = t1 + t2 | 0;
  }
  st[0] = st[0] + a | 0; st[1] = st[1] + b | 0; st[2] = st[2] + c | 0; st[3] = st[3] + d | 0;
  st[4] = st[4] + e | 0; st[5] = st[5] + f | 0; st[6] = st[6] + g | 0; st[7] = st[7] + h | 0;
}

/** SHA-256 của mảng byte, bắt đầu từ trạng thái st0 (đã nén trước `pre` byte) → 8 từ. */
function dnSha_(st0, pre, bytes, W) {
  var st = st0.slice(), len = bytes.length, total = pre + len, msg = bytes.slice();
  msg.push(0x80);
  while ((msg.length % 64) !== 56) msg.push(0);
  var bitsHi = Math.floor(total / 0x20000000), bitsLo = (total * 8) >>> 0;
  msg.push((bitsHi >>> 24) & 255, (bitsHi >>> 16) & 255, (bitsHi >>> 8) & 255, bitsHi & 255,
    (bitsLo >>> 24) & 255, (bitsLo >>> 16) & 255, (bitsLo >>> 8) & 255, bitsLo & 255);
  var w = new Array(16);
  for (var o = 0; o < msg.length; o += 64) {
    for (var j = 0; j < 16; j++) w[j] = (msg[o + 4 * j] << 24) | (msg[o + 4 * j + 1] << 16) | (msg[o + 4 * j + 2] << 8) | msg[o + 4 * j + 3];
    dnNen_(st, w, W);
  }
  return st;
}

function dnWordsToBytes_(ws) {
  var out = [];
  for (var i = 0; i < ws.length; i++) out.push((ws[i] >>> 24) & 255, (ws[i] >>> 16) & 255, (ws[i] >>> 8) & 255, ws[i] & 255);
  return out;
}

/** PBKDF2-HMAC-SHA256. Trạng thái ipad / opad tính trước; mỗi vòng = 2 lần nén 1 khối (U là 32 byte → khối đệm sẵn). */
function dnPbkdf2_(pw, salt, vong, dkLen) {
  var W = new Array(64), key = pw.length > 64 ? dnWordsToBytes_(dnSha_(DN_H0_, 0, pw, W)) : pw.slice();
  while (key.length < 64) key.push(0);
  var ip = new Array(16), op = new Array(16), j;
  for (j = 0; j < 16; j++) {
    var k = (key[4 * j] << 24) | (key[4 * j + 1] << 16) | (key[4 * j + 2] << 8) | key[4 * j + 3];
    ip[j] = k ^ 0x36363636; op[j] = k ^ 0x5c5c5c5c;
  }
  var stI = DN_H0_.slice(), stO = DN_H0_.slice();
  dnNen_(stI, ip, W); dnNen_(stO, op, W);
  var out = [], blocks = Math.ceil(dkLen / 32);
  // Khối 32 byte + đệm SHA-256 với độ dài 64 + 32 = 96 byte = 768 bit.
  var blk = new Array(16);
  for (var b = 1; b <= blocks; b++) {
    var s1 = salt.concat([(b >>> 24) & 255, (b >>> 16) & 255, (b >>> 8) & 255, b & 255]);
    var u = dnSha_(stO, 64, dnWordsToBytes_(dnSha_(stI, 64, s1, W)), W), t = u.slice();
    for (var r = 1; r < vong; r++) {
      for (j = 0; j < 8; j++) blk[j] = u[j];
      blk[8] = 0x80000000; for (j = 9; j < 15; j++) blk[j] = 0; blk[15] = 768;
      var st = stI.slice(); dnNen_(st, blk, W);
      for (j = 0; j < 8; j++) blk[j] = st[j];
      u = stO.slice(); dnNen_(u, blk, W);
      for (j = 0; j < 8; j++) t[j] ^= u[j];
    }
    out = out.concat(dnWordsToBytes_(t));
  }
  return out.slice(0, dkLen);
}
