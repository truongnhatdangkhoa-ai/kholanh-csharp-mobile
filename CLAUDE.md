# Kho Lạnh — bản điện thoại MỚI (đi cùng app PC C#)

- Tách từ `truongnhatdangkhoa-ai/kholanh-anan-mobile` (24/11/2026, commit đầu = nguyên trạng). Repo cũ và app PC cũ **chỉ đọc, giữ nguyên** — người dùng vẫn dùng bản cũ hằng ngày.
- App PC đi cùng: `truongnhatdangkhoa-ai/kholanh-csharp` (`src/KhoLanh.Core/PhoneSync/`, `docs/DONG-BO-DIEN-THOAI.md`). Giao thức Apps Script (`apps-script/Code.gs`) giữ như bản cũ; đổi giao thức thì sửa cả 2 repo.
- Hệ thống mới dùng **Google Sheet riêng** (không chung Sheet với bản cũ). `www/app-config.js` có link Web App của Sheet MỚI (người dùng gửi 24/11/2026) — không thay bằng link Sheet cũ.
- Danh tính app: `capacitor.config.json` appId `vn.anan.kholanh.moi`, tên "Kho Lạnh (mới)" — KHÔNG đổi về mã cũ (sẽ đè app cũ trên điện thoại).
- Giao diện "Băng sạch" như app PC: chỉ đổi màu qua biến đầu `www/app.css` (khối `:root` + `html[data-theme="dark"]`), không viết mã màu cứng mới. Icon sinh từ `kholanh-csharp/docs/brand/icon-1024.png` (`icons/`, `www/icon-*.png`).
- Giao diện, chú thích, thông báo: tiếng Việt. Phiên bản hiện ở `APP_VERSION` (`www/app.js`).
- Chụp thử trên trình duyệt: Playwright mở `www/index.html` (390 × 844); ảnh mẫu ở `docs/anh/`.
- CI: `build-apk.yml` (APK mỗi lần đẩy), `build-ios.yml`, `web-preview.yml` (GitHub Pages = nguồn tự cập nhật app; cần bật Settings → Pages → Source: GitHub Actions).
- Bản web tên miền riêng `https://app.kcenter.xyz` (cho iPhone, Thêm vào Màn hình chính): GitHub Pages Custom domain + CNAME `app` → `truongnhatdangkhoa-ai.github.io` (DNS only) ở Cloudflare — xem `docs/TEN-MIEN-RIENG.md`. Custom domain đặt ở Settings → Pages (đăng bằng Actions nên KHÔNG dùng file CNAME).
- Code.gs có phần cho app PC C#: tài khoản dùng chung (tab `TaiKhoan`, `tkPost_`, `pc.tkCaiMa`, `pc.tkDatLaiMa` đặt lại mã — PC 1.109), máy PC mới chỉ cần đăng nhập (`pcDangNhap` → `dnPost_`, PBKDF2 JS thuần `dnKiemMk_`; đối chiếu bằng `kholanh-csharp/tests/KhoLanh.Core.Tests/Data/dangnhap-maymoi-golden.gen.js`), `pc.ghMayMoi` (Thuộc tính `KL_GH_TOKEN`). Sửa Code.gs xong: dán vào Apps Script + Triển khai › Quản lý triển khai › Phiên bản mới (giữ đường dẫn).
