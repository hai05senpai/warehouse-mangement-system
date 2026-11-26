# Kịch bản quay video: 3.1 Lưu trữ và quản lý dữ liệu (PostgreSQL và Redis)

Thời lượng dự kiến: **7–9 phút** (PostgreSQL ~5 phút, Redis ~3 phút).
File dùng khi quay: `03_demo_postgres.sql` (pgAdmin) và `04_demo_redis.txt` (Redis Insight > Workbench), cùng thư mục với file này.
Số "kết quả mong đợi" là số đo trên máy chủ host; thời gian có thể lệch, **dung lượng và số trang thì không đổi**.

## Chuẩn bị trước khi quay (5 phút)

1. Đưa dữ liệu demo về ban đầu (thư mục gốc dự án):
   ```bash
   set -a; source .env; set +a
   python3 demo/storage/02_measure.py reset
   ```
2. **Bộ gõ: chuyển sang tiếng Anh (ABC).** Telex có thể biến chữ khi gõ lệnh.
3. pgAdmin: kết nối máy chủ → database `railway` → Query Tool → mở `03_demo_postgres.sql`. Tăng cỡ chữ editor (~16).
4. Redis Insight: mở kết nối máy chủ → bút chì cạnh `db0` → đổi thành **12** → Workbench → Clear Results.
5. Tắt thông báo hệ thống, đóng ứng dụng không cần.

Thao tác trong pgAdmin: **bôi đen** đúng đoạn rồi **F5**. pgAdmin chỉ hiện kết quả câu cuối của vùng bôi đen, nên ở bước nhiều câu thì chạy từng câu.

---

## Cảnh 0. Mở đầu (~30 giây)

- **Lời thoại:** "Phần 3.1 so sánh cách PostgreSQL và Redis lưu dữ liệu. Cùng một bảng tồn kho 10.000 dòng: PostgreSQL lưu thành bảng heap theo trang 8 KB trên đĩa, Redis lưu mỗi dòng thành một HASH trên RAM. Dữ liệu demo nằm riêng, không ảnh hưởng dữ liệu của ứng dụng."

## Phần A. PostgreSQL (pgAdmin)

### Cảnh A1. STEP 1–3: Dung lượng (~70 giây)
- **Thao tác:** chạy lần lượt STEP 1, các câu của STEP 2, STEP 3.
- **Kết quả mong đợi:** 10.000 dòng, 84 trang; 1 dòng 64 byte nhưng heap 8.192 byte và chỉ mục 32.768 byte; 10.000 dòng: 672 kB heap, 568 kB chỉ mục, 68,8 byte mỗi dòng.
- **Lời thoại:** "Một dòng chỉ có 64 byte dữ liệu, nhưng PostgreSQL vẫn cấp nguyên một trang 8 KB cho bảng và hai trang cho mỗi chỉ mục. Khi có 10.000 dòng thì chi phí trang được chia đều, chỉ còn khoảng 69 byte mỗi dòng."

### Cảnh A2. STEP 4: MVCC trên một dòng (~70 giây)
- **Thao tác:** chạy 4a → khối `DO` của 4b → các câu của 4c.
- **Kết quả mong đợi:** `ctid` từ `(0,1)` thành `(83,70)`; bảng vẫn **84** trang, chỉ **30** bản ghi chết.
- **Lời thoại:** "Mỗi lần UPDATE, PostgreSQL không sửa tại chỗ mà tạo một phiên bản mới, nên vị trí vật lý của dòng thay đổi. Nhưng sau 500 lần cập nhật, bảng không tăng trang nào và chỉ còn 30 bản ghi chết: đó là cập nhật HOT, phiên bản mới được ghi ngay trong trang còn chỗ, phiên bản cũ được dọn dần."

### Cảnh A3. STEP 5: Bảng phình khi cập nhật cả bảng (~70 giây)
- **Thao tác:** chạy từng câu `ALTER TABLE`, 5 câu `UPDATE`, rồi câu `EXPLAIN (ANALYZE, BUFFERS)`.
- **Chỉ vào:** `Buffers: shared hit=` khoảng **500** (so với 84 lúc đầu).
- **Lời thoại:** "Cập nhật toàn bộ 10.000 dòng năm lần, các trang không còn chỗ, nên bảng phình lên khoảng 500 trang với khoảng 50.000 bản ghi chết. Quét bảng giờ phải đọc gấp 6 lần số trang."

### Cảnh A4. STEP 6: VACUUM và VACUUM FULL (~50 giây)
- **Thao tác:** chạy `VACUUM` và câu đếm trang (vẫn khoảng 500); chạy `VACUUM FULL` và `EXPLAIN` (về **84**).
- **Lời thoại:** "VACUUM dọn bản ghi chết để tái sử dụng chỗ trống nhưng không làm tệp nhỏ lại. VACUUM FULL viết lại cả bảng nên trở về 84 trang, đổi lại phải khóa bảng trong lúc chạy."

### Cảnh A5. STEP 7: Tốc độ đọc và ghi (~60 giây)
- **Thao tác:** chạy từng khối `DO` của 7a, 7b, 7c; mở tab **Messages** sau mỗi khối.
- **Kết quả mong đợi:** đọc 1.000 lần khoảng 5–17 ms; ghi commit từng lệnh khoảng 665 ms; ghi trong một giao dịch khoảng 27–34 ms.
- **Lời thoại:** "Thời gian đo ngay trong server nên không bị mạng ảnh hưởng. Ghi 1.000 lệnh mà mỗi lệnh commit riêng mất khoảng 665 mili giây, nhưng gom vào một giao dịch chỉ còn khoảng 30: hơn 95% thời gian là chờ ghi nhật ký WAL xuống đĩa khi commit."

## Phần B. Redis (Redis Insight > Workbench, database 12)

### Cảnh B1. STEP 1–2: Một dòng là một HASH (~50 giây)
- **Thao tác:** chạy `DBSIZE`, `HGETALL inv:1:1`, `OBJECT ENCODING inv:1:1`, `MEMORY USAGE inv:1:1`.
- **Kết quả mong đợi:** 10000; các trường của dòng; `listpack`; **144**.
- **Lời thoại:** "Mỗi dòng tồn kho là một HASH. HASH nhỏ được nén liền trong một mảng byte gọi là listpack, nên một dòng chỉ chiếm 144 byte RAM, nhỏ hơn nhiều so với một trang 8 KB của PostgreSQL."

### Cảnh B2. STEP 3: 10.000 khóa (~30 giây)
- **Thao tác:** chạy `INFO memory`, chỉ vào `used_memory`.
- **Lời thoại:** "Nhưng với 10.000 dòng, Redis tốn khoảng 1,6 MB, tức 162 byte mỗi khóa, nhiều hơn PostgreSQL vì mỗi khóa còn phải lưu tên khóa và phần quản lý của bảng băm."

### Cảnh B3. STEP 4: Ghi đè không sinh bản ghi chết (~30 giây)
- **Thao tác:** chạy `FCALL s_overwrite 0 50000`, rồi `MEMORY USAGE inv:1:1`.
- **Kết quả mong đợi:** vẫn **144**.
- **Lời thoại:** "Ghi đè 50.000 lượt, mỗi khóa vẫn đúng 144 byte: Redis sửa tại chỗ, không có MVCC nên không có bản ghi chết và không cần VACUUM."

### Cảnh B4. STEP 5: Tốc độ (~40 giây)
- **Thao tác:** chạy `FCALL s_bench_read 0 1000` và `FCALL s_bench_write 0 1000`.
- **Kết quả mong đợi:** khoảng 1,7 µs mỗi lệnh đọc; khoảng 0,3–0,4 µs mỗi lệnh ghi.
- **Lời thoại:** "Đọc nhanh hơn PostgreSQL khoảng 6 lần. Ghi thì nhanh hơn nhiều vì Redis trên máy chủ này không ghi nhật ký xuống đĩa; nếu bắt Redis chờ đĩa sau mỗi lệnh như PostgreSQL thì nó cũng chậm đi, như đã đo ở phần giao dịch."

## Cảnh kết (~30 giây)

- **Màn hình:** biểu đồ `docs/DBMS_report/Images/demo_3_1_plot.png`.
- **Lời thoại:** "PostgreSQL lưu bền vững trên đĩa, gọn khi dữ liệu lớn, có ràng buộc và WAL, đổi lại ghi chậm hơn và cần VACUUM. Redis nhanh vì nằm trên RAM, nhưng tốn RAM hơn khi dữ liệu lớn và độ bền phụ thuộc cấu hình. Tồn kho và chứng từ phải lưu trên PostgreSQL; Redis chỉ làm tầng hỗ trợ."

## Sau khi quay

Demo đã cập nhật dữ liệu, chạy lại để đưa về ban đầu:

```bash
python3 demo/storage/02_measure.py reset
```
