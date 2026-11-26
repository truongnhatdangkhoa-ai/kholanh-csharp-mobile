# Bản web trên tên miền riêng: https://app.kcenter.xyz

Dành cho iPhone / iPad (không build được app iOS): mở bản web bằng Safari rồi **Thêm vào Màn hình chính**
→ có biểu tượng, mở toàn màn hình như app. Bản web là chính thư mục `www/` do workflow `web-preview.yml`
đăng lên GitHub Pages (mỗi lần đẩy `www/**` lên `main` là bản web tự mới).

## Cài 1 lần (người dùng tự làm, khoảng 10 phút)

**Bước 1 — Cloudflare (DNS của kcenter.xyz)**
1. Vào https://dash.cloudflare.com → chọn **kcenter.xyz** → **DNS** → **Records** → **Add record**.
2. Điền: **Type** = `CNAME` · **Name** = `app` · **Target** = `truongnhatdangkhoa-ai.github.io`
   · **Proxy status** = TẮT (đám mây màu xám, "DNS only") · **TTL** = Auto → **Save**.
   (Phải là DNS only: bật đám mây cam thì GitHub không cấp được chứng chỉ HTTPS.)

**Bước 2 — GitHub (repo kholanh-csharp-mobile)**
1. Vào https://github.com/truongnhatdangkhoa-ai/kholanh-csharp-mobile/settings/pages
2. Ô **Custom domain** gõ `app.kcenter.xyz` → **Save**. Chờ dòng "DNS check successful" (vài phút).
3. Khi ô **Enforce HTTPS** bấm được (thường 5–30 phút, có khi tới 1 giờ) → **tích** vào.
4. Mở https://app.kcenter.xyz trên máy tính thử — thấy màn hình đăng nhập app là xong.

Địa chỉ cũ `https://truongnhatdangkhoa-ai.github.io/kholanh-csharp-mobile/` tự chuyển sang tên miền mới
(app Android vẫn tự cập nhật qua địa chỉ cũ, GitHub chuyển tiếp). Nên tích **Enforce HTTPS** ngay khi được:
chưa tích thì địa chỉ cũ chuyển sang `http://` và app Android tạm không tự cập nhật được.

## Trên iPhone (mỗi máy)
1. Mở **Safari** (bắt buộc Safari, không dùng Chrome / Zalo), gõ `app.kcenter.xyz`.
2. Chạm nút **Chia sẻ** (ô vuông có mũi tên lên) → **Thêm vào Màn hình chính** → **Thêm**.
3. Mở app từ biểu tượng mới trên màn hình chính → đăng nhập như app Android.

Lưu ý: dữ liệu đăng nhập của bản web lưu theo từng địa chỉ — ai đã thêm bản `github.io` trước đây thì xóa
biểu tượng cũ, thêm lại từ `app.kcenter.xyz` và đăng nhập lại 1 lần.

## Gỡ / đổi tên miền
Settings → Pages → Custom domain → **Remove** (bản web về lại địa chỉ github.io), rồi xóa bản ghi `app` ở Cloudflare.
