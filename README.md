# Pocket VS Code Helper

Extension VS Code giúp biến các thao tác hay dùng của project **Omni Reup Video** thành nút bấm nhanh ngay trong VS Code.

Extension này hỗ trợ:

- Dọn cache và file runtime ra thư mục backup.
- Chạy nhanh `git pull`, `git push`.
- Commit toàn bộ thay đổi hiện tại rồi pull kiểu merge, giữ nguyên conflict để xử lý sau.
- Commit toàn bộ thay đổi hiện tại rồi pull rebase và push.
- Hiển thị log thao tác trong Output Channel `Pocket Helper`.

## Cài đặt để dùng trực tiếp

Chạy các lệnh sau trong thư mục extension này:

```powershell
npm install
npm run install:local
```

Sau khi cài xong, reload VS Code hoặc đóng/mở lại VS Code.

Khi mở project này hoặc project `omni-reup-video`, thanh Status Bar bên trái sẽ có các nút:

- `Omni Helper`: dọn cache/runtime, sau đó hỏi bạn muốn `Pull`, `Push`, `Commit & Push` hay bỏ qua thao tác Git.
- `Move Cache`: chỉ dọn cache/runtime vào thư mục backup.
- `Pull`: chạy `git pull --ff-only --autostash`.
- `Push`: chạy `git push`.
- `Commit & Pull`: hỏi commit message, chạy `git add -A`, commit, rồi `git pull --no-rebase`. Nếu có conflict, extension giữ nguyên merge conflict trong file và báo danh sách file cần merge.
- `Commit & Push`: hỏi commit message, chạy `git add -A`, commit, `git pull --rebase --autostash`, rồi `git push`.
- `Output`: bật/tắt màn hình log `Pocket Helper`.

Bạn cũng có thể bấm `Ctrl+Shift+P`, gõ `Omni` để chạy các lệnh từ Command Palette.

## Vị trí nút

- Status Bar bên trái: nơi đặt các nút thao tác nhanh.
- Explorer title bar: có nút `Move Cache + Git...`.
- Source Control title bar: có nút `Commit & Pull`, `Pull`, `Push` và `Commit & Push`.
- Output Channel: extension không tự mở Output khi chạy lệnh; bấm `Output` nếu muốn xem log.

## File được dọn khi chạy Move Cache

Extension sẽ tìm trong workspace hiện tại và move các mục sau nếu tồn tại:

```text
jobs.db
jobs.db-shm
jobs.db-wal
uploads
outputs
temp
logs
__pycache__
```

Ngoài ra, extension cũng move các file ở thư mục gốc có đuôi:

```text
.mp4
.srt
.pyc
.pyo
```

Sau khi move, extension sẽ tạo lại các thư mục `uploads`, `outputs`, `temp`, `logs` kèm file `.gitkeep`.

## Thư mục backup

Các file cache/runtime được đưa vào thư mục backup nằm cạnh repo:

```text
../omni-reup-video-cache-backups/<yyyyMMdd-HHmmss>
```

Ví dụ:

```text
../omni-reup-video-cache-backups/20260623-153045
```

Extension có kiểm tra an toàn để tránh move file ra ngoài workspace đang mở và tránh ghi backup ra ngoài thư mục cha dự kiến.

## Cấu hình

Bạn có thể ẩn hoặc hiện các nút trên Status Bar bằng setting:

```json
{
  "pocketHelper.showStatusBarButtons": true
}
```

Đổi thành `false` nếu chỉ muốn dùng lệnh qua Command Palette hoặc menu của VS Code.

## Xử lý conflict khi Commit & Pull

Nút `Commit & Pull` dùng `git pull --no-rebase`, nên nếu remote có thay đổi đụng với code local, Git sẽ để lại conflict marker trong file như bình thường.

Khi gặp conflict, extension sẽ:

- Không abort merge.
- Mở Output Channel `Pocket Helper`.
- Báo source đang pull, ví dụ `origin/main`.
- Liệt kê các file đang conflict để bạn đưa cho AI merger xử lý tiếp.

## Chạy khi đang phát triển extension

Cài dependency và compile:

```powershell
npm install
npm run compile
```

Sau đó bấm `F5` trong VS Code để mở Extension Development Host.

## Đóng gói lại file VSIX

Muốn build lại file `.vsix`:

```powershell
npm run vsix
```

Muốn build và cài lại extension vào VS Code local:

```powershell
npm run install:local
```

## Ghi chú

- Các lệnh Git chạy trên workspace đang mở. Nếu đang focus vào file thuộc workspace nào, extension sẽ ưu tiên workspace đó.
- `Commit & Pull` sẽ pull tiếp nếu không có gì để commit. Nếu bạn bấm Cancel ở ô commit message, extension sẽ dừng và không pull.
- `Commit & Push` sẽ dùng commit message bạn nhập. Nếu bỏ trống, message mặc định là `update project`.
- Nếu không có thay đổi nào được stage, extension sẽ không tạo commit mới.
