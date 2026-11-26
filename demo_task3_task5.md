# Kịch bản Demo BTL DBMS: Task 3 (Xuất kho) & Task 5 (Kiểm kê kho)

> [!IMPORTANT]
> **Tổng thời gian dự kiến:** 6 – 7 phút.
> **Mục tiêu:** **Application (30%)** + **Demonstration trên 2 DBMS SQL vs NoSQL (30%)** + **Presentation (10%)** + **Bonus +2.0 điểm** (tích hợp cả PostgreSQL và Redis vào ứng dụng thực tế).

---

## GĐ0: Chuẩn bị 4 tab trước khi lên trình bày (Làm trước ở chỗ ngồi)

1. **Kiểm tra PostgreSQL Local & Chỉ khởi động Redis trên Docker:**
   - **PostgreSQL:** Dùng trực tiếp **PostgreSQL cài Local trên máy** (tài khoản `postgres` trong tệp `.env`, cổng `5432`). Không bật container `logistic-postgres` để tránh đụng cổng `5432`.
   - **Redis (Docker):** Chỉ khởi động duy nhất container Redis (`logistic-redis`, cổng `6379`) và đảm bảo không có container khác chiếm cổng `8080`:

     ```powershell
     docker compose up -d redis
     docker ps
     ```

     *(Kiểm tra thấy `logistic-redis` đang `Up` ở cổng `6379` và không có container nào khác chiếm cổng `8080` hay `5432`)*.
2. **Khởi động Backend & Frontend:**
   - **Backend (tại `D:\HCMUT\dbms-logistic\backend`):**
     ```powershell
     .\mvnw.cmd spring-boot:run "-Dspring-boot.run.jvmArguments=-Duser.timezone=UTC"
     ```
   - **Frontend (tại `D:\HCMUT\dbms-logistic\frontend`):**
     ```powershell
     npm run dev
     ```
3. **Mở sẵn 4 cửa sổ trên màn hình (chuyển nhanh bằng `Alt + Tab`):**
   - **Cửa sổ 1:** Trình duyệt Web đã đăng nhập sẵn (`admin` / `admin123`) tại `http://localhost:5173/inventory`.
   - **Cửa sổ 2:** **pgAdmin 4** kết nối sẵn vào `logistic_db`, mở sẵn **2 Tab Query Tool** đặt cạnh nhau (dán sẵn các câu SQL ở Giai đoạn 2A).
   - **Cửa sổ 3:** **PowerShell 1 (Redis CLI)** để chạy `redis-cli` (Giai đoạn 2B).
   - **Cửa sổ 4:** **PowerShell 2 (Terminal tại `D:\HCMUT\dbms-logistic\backend`)** để chạy script kiểm thử đồng thời `.\test_concurrency.ps1` (Giai đoạn 3).

---

## GĐ1: Demo trên Giao diện Web (2.5 phút — Application 30%)

### 1A. Demo Task 3: Xuất hàng khỏi kho (`/issues`)

1. **Xem số liệu gốc tại `/inventory` (15 giây):**
   - Mở trang **Tồn kho & tìm kiếm (`/inventory`)**.
   - Chú ý 2 mặt hàng cuối (`LAP-ASUS-ROG16` tại kệ `A1-R01-S03` và `KEY-LOGI-MXK` tại kệ `B2-R02-S01`). **Tồn kho**, **Đã giữ chỗ**, **Khả dụng** của 2 dòng này.
2. **Tạo phiếu xuất NHIỀU mặt hàng — Giữ chỗ `PENDING` (45 giây):**
   - Chuyển sang trang **Đơn xuất kho (`/issues`)**.
   - Điền **Mã phiếu xuất:** `PX-DEMO-020`, chọn **Khách hàng** bất kỳ.
   - Chọn 2 mặt hàng trên và số lượng cần chuyển.
   - Bấm **"Giữ chỗ hàng (2 dòng)"**.
   - **Lời thuyết minh:**
     > *"Thưa thầy/cô, theo đúng nghiệp vụ `1 IssueOrder – N IssueItem`, em vừa tạo 1 phiếu xuất chứa 2 mặt hàng. Dù trên form em nhập `LAP-ASUS-ROG16` trước rồi mới đến `KEY-LOGI-MXK`, nhưng trong `IssueOrderService`, hệ thống tự động sắp xếp lại theo thứ tự `(productId, locationId)` tăng dần trước khi xin khóa Redis và khóa dòng PostgreSQL để triệt tiêu nguy cơ Deadlock."*
     >
   - Quay nhanh sang `/inventory` chỉ cột **Đã giữ chỗ** của `LAP-ASUS-ROG16` tăng thêm 5 và `KEY-LOGI-MXK` tăng thêm 5 (trong khi `Tồn kho` chưa trừ vì hàng vẫn nằm trên kệ).
3. **Test Rollback giao dịch khi xuất vượt tồn khả dụng (20 giây):**
   - Quay lại `/issues`, tạo phiếu `PX-DEMO-021` cho `LAP-ASUS-ROG16` tại `A1-R01-S03` với số lượng **`9999`** $\rightarrow$ Bấm **Giữ chỗ hàng**.
   - Web báo lỗi đỏ *"Tồn kho khả dụng không đủ..."*.
   - **Lời thuyết minh:** *"Nhờ `@Transactional`, toàn bộ giao dịch bị Rollback, phiếu `PX-DEMO-021` không hề bị lưu rác xuống bảng `issue_orders`."*
4. **Hoàn tất xuất kho (`COMPLETED`) (15 giây):**
   - Bấm nút **Dấu tích xanh (`✓`)** trên phiếu `PX-DEMO-020` $\rightarrow$ Trạng thái đổi thành **`Hoàn tất`**.
   - Chỉ sang `/inventory`: cả `Tồn kho` và `Đã giữ chỗ` của 2 mặt hàng đã giảm đúng bằng số xuất.

---

### 1B. Demo Task 5: Kiểm kê kho (`/stock-takes`)

1. **Lập phiếu kiểm kê NHIỀU mặt hàng (`DRAFT`) (40 giây):**
   - Chuyển sang trang **Kiểm kê kho (`/stock-takes`)**.
   - Nhập **Mã phiếu kiểm kê:** `KK-DEMO-020`.
   - Dòng 1: Chọn `AC-PANA-12000`, vị trí `C3-R03-S01`, nhập **Số lượng thực tế** lệch đi so với hệ thống (ví dụ hệ thống đang là `30`, nhập thực tế là **`25`** $\rightarrow$ thiếu `-5`).
   - Bấm **"+ Thêm dòng kiểm kê"** $\rightarrow$ Dòng 2: Chọn `SCAM-CANON-R6`, vị trí `B2-R03-S03`, nhập **Số lượng thực tế** thừa lên (ví dụ hệ thống là `40`, nhập thực tế là **`45`** $\rightarrow$ thừa `+5`).
   - Bấm **"Lưu kết quả (2 dòng)"**.
2. **Trình diễn `JOIN` và `Aggregate Functions` ngay trên Web (30 giây):**
   - Ngay sau khi lưu click vào xem chi tiết:
     - **Bảng trên (`GET /api/stock-takes/{id}/summary`):** Thể hiện kết quả của câu lệnh **`Aggregate Functions`** (`COUNT` = `2` mặt hàng, `Tổng tồn hệ thống`, `Tổng tồn thực tế`, `Tổng chênh lệch`).
     - **Bảng dưới (`GET /api/stock-takes/{id}/items`):** Thể hiện kết quả của câu lệnh **`JOIN`** nối `stock_take_items` với `products` và `locations`.
3. **Phê duyệt & Điều chỉnh tồn kho (`COMPLETED`) (20 giây):**
   - Bấm nút **"Duyệt & Điều chỉnh tồn kho"** $\rightarrow$ Trạng thái chuyển thành `Hoàn tất`.
   - Sang `/inventory` kiểm chứng: tồn kho của 2 mặt hàng đã được cập nhật.

---

## GIAI ĐOẠN 2: Demo trực tiếp trên 2 DBMS — PostgreSQL & Redis (2.5 phút — Chấm điểm Demonstration 30%)

### 2A. Demo trên PostgreSQL (pgAdmin 4 — SQL DBMS)

Chuyển sang cửa sổ **pgAdmin 4**.

#### 1. Trình diễn SQL của Task 3 & Task 5 (30 giây — Chạy trên Tab 1)

Chạy nhanh 2 câu truy vấn tiêu biểu (bấm `F5` để xem kết quả hoặc `F7` để xem **Explain Plan**):

```sql
-- [Task 3] Query with JOIN + Composite Condition (Chi tiết phiếu xuất kho)
SELECT io.code, c.name AS customer_name, p.sku, l.code AS location_code,
       ii.quantity, io.status, io.issue_date
FROM issue_items ii
JOIN issue_orders io ON io.id = ii.issue_order_id
JOIN customers c ON c.id = io.customer_id
JOIN products p ON p.id = ii.product_id
JOIN locations l ON l.id = ii.location_id
WHERE io.status = 'COMPLETED' AND ii.quantity > 0
ORDER BY io.issue_date DESC
LIMIT 10;

-- [Task 5] Query with Aggregate Functions (Tổng hợp chênh lệch phiếu kiểm kê mới nhất)
SELECT st.code,
       COUNT(si.id) AS item_count,
       SUM(si.system_qty) AS total_system_qty,
       SUM(si.actual_qty) AS total_actual_qty,
       SUM(si.actual_qty - si.system_qty) AS total_difference
FROM stock_takes st
JOIN stock_take_items si ON si.stock_take_id = st.id
GROUP BY st.id, st.code
ORDER BY st.id DESC
LIMIT 5;
```

#### 2. Trình diễn Khóa dòng bi quan (`SELECT ... FOR UPDATE`) giữa 2 Transaction song song (1 phút — Chạy trên Tab 1 & Tab 2)

- **Tại Tab 1 (Giả lập Transaction 1 — Xuất kho đang giữ khóa dòng):**

  ```sql
  BEGIN;
  SELECT id, product_id, location_id, quantity, reserved_quantity
  FROM inventory
  WHERE product_id = 1 AND location_id = 1
  FOR UPDATE;
  -- CHÚ Ý: Chưa chạy COMMIT để giữ khóa!
  ```
- **Tại Tab 2 (Giả lập Transaction 2 — Kiểm kê hoặc Xuất kho khác nhảy vào cùng lúc):**

  ```sql
  BEGIN;
  UPDATE inventory
  SET reserved_quantity = reserved_quantity + 1
  WHERE product_id = 1 AND location_id = 1;
  ```

  - **Ta thấy:** Tab 2 đang **quay vòng đứng chờ (`Waiting for query to complete...`)**!
  - **Lời thuyết minh:** *"Đây là cơ chế Blocking của PostgreSQL Row-Level Exclusive Lock (`FOR UPDATE`). Giao dịch 2 buộc phải chờ Giao dịch 1 kết thúc, đảm bảo không bao giờ xảy ra Lost Update hay xuất vượt tồn."*
- **Quay lại Tab 1** chạy `ROLLBACK;` $\rightarrow$ Tab 2 lập tức chạy xong ngay trong tích tắc! (Sau đó chạy `ROLLBACK;` ở Tab 2 để giữ sạch dữ liệu).

---

### 2B. Demo trên Redis (`redis-cli` — NoSQL In-Memory DBMS với Task 5 Kiểm kê kho)

Chuyển sang **PowerShell 1 (Cửa sổ Redis)**.

*(Tra cứu ID từ dữ liệu mẫu của bạn: `AC-PANA-12000` tại `C3-R03-S01` có `product_id = 27, location_id = 27` $\rightarrow$ key **`lock:inventory:27:27`**; `CAM-CANON-R6` tại `B2-R03-S03` có `product_id = 19, location_id = 19` $\rightarrow$ key **`lock:inventory:19:19`**).*

#### 1. Quan sát Redis khóa & sắp xếp thứ tự khóa theo thời gian thực với Task 5 (30 giây)

1. Trên **PowerShell 1**, bật chế độ theo dõi lệnh Redis:
   ```powershell
   docker exec -it logistic-redis redis-cli MONITOR
   ```
2. Chuyển sang **Trình duyệt Web (`/stock-takes`)**, tạo phiếu kiểm kê `KK-REDIS-01` gồm đúng **2 mặt hàng**:
   - Dòng 1: **`AC-PANA-12000`**, vị trí **`C3-R03-S01`**, số lượng thực tế **`35`**
   - Dòng 2: **`CAM-CANON-R6`**, vị trí **`B2-R03-S03`**, số lượng thực tế **`45`**
     $\rightarrow$ Bấm **"Lưu kết quả (2 dòng)"**.
3. **Chỉ lên màn hình PowerShell `MONITOR` cho giảng viên thấy:**
   - Dù trên Web bạn nhập `AC-PANA-12000` (`id = 27`) trước `CAM-CANON-R6` (`id = 19`), nhưng nhờ `orderedItems.sort(...)` chống Deadlock, Redis in ra đúng thứ tự tăng dần:
     1. `"SET" "lock:inventory:19:19" "<UUID-token>" "EX" "10" "NX"` *(Khóa `CAM-CANON-R6` trước)*
     2. `"SET" "lock:inventory:27:27" "<UUID-token>" "EX" "10" "NX"` *(Khóa `AC-PANA-12000` sau)*
     3. `"EVAL" "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end" ...` *(Lua Script mở khóa nguyên tử cho cả 2 key)*
        *(Bấm `Ctrl + C` để dừng `MONITOR`).*

#### 2. Giả lập xung đột khóa Redis tự động bằng Script PowerShell (40 giây — Cực kỳ ấn tượng!)

Thay vì phải thao tác tay trên Web, tại cửa sổ PowerShell ở thư mục `D:\HCMUT\dbms-logistic\backend`, bạn chỉ cần chạy **1 lệnh duy nhất**:

```powershell
.\test_redis_lock.ps1
```

Script sẽ tự động chạy trọn bộ 4 bước trước mắt giảng viên:

1. **[Bước 1]** Tự động khóa key `lock:inventory:27:27` (`AC-PANA-12000` tại `C3-R03-S01`) trên Redis (`SET ... NX EX 20`).
2. **[Bước 2]** Gửi API `POST /api/stock-takes` gồm đúng 2 mặt hàng `AC-PANA-12000` (`35`) + `CAM-CANON-R6` (`45`) khi khóa đang tồn tại $\rightarrow$ In ra **`BI CHAN NGAY LAP TUC (Fail-fast) - HTTP 409`** kèm thông báo từ Redis Distributed Lock!
3. **[Bước 3]** Giải phóng khóa `lock:inventory:27:27` trên Redis (`DEL`).
4. **[Bước 4]** Gửi lại đúng API `POST /api/stock-takes` đó $\rightarrow$ In ra **`THANH CONG (HTTP 200)`** ở trạng thái `DRAFT`!

- **Lời thuyết minh so sánh 2 DBMS:**
  > *"Thầy/cô có thể thấy sự khác biệt rõ rệt giữa 2 DBMS: Ở **PostgreSQL**, giao dịch đến sau bị **Blocking (đứng chờ)** tốn kết nối DB; còn ở **Redis**, lệnh `SET NX EX` chặn theo cơ chế **Fail-fast (từ chối tức thì trên RAM)** giúp bảo vệ tầng CSDL chính. Tuy nhiên Redis không hỗ trợ Rollback đa bảng nên hệ thống em kết hợp **Redis ở vòng ngoài + PostgreSQL ACID ở vòng trong**."*
  >

---

## GIAI ĐOẠN 3: Demo trên Terminal PowerShell — Kiểm thử Concurrency / Double-Click với Task 3 (1.5 phút — Chốt điểm Bonus)

Chuyển sang **PowerShell 2** tại thư mục `D:\HCMUT\dbms-logistic\backend`.

1. **Chạy kịch bản PowerShell bắn 2 HTTP Request hoàn tất đơn `PX-RACE-01` (`AC-PANA-12000` tại `C3-R03-S01`, SL = 2) cùng một tích tắc:**

   ```powershell
   .\test_concurrency.ps1 PX-RACE-01
   ```

   *(Script đã được nâng cấp tự động: nếu chưa có đơn `PX-RACE-01` hoặc đơn đó đã `COMPLETED` từ lần chạy nháp trước, script sẽ **tự động gọi `POST /api/issue-orders` tạo mới 1 đơn `PENDING`** cho mặt hàng `AC-PANA-12000` tại `C3-R03-S01` rồi lập tức bắn 2 luồng hoàn tất song song!)*
2. **Chỉ vào kết quả 2 luồng in ra màn hình PowerShell:**

   - **=== KET QUA REQUEST 1 ===** $\rightarrow$ `THANH CONG (HTTP 200)`, `TrangThai: COMPLETED`
   - **=== KET QUA REQUEST 2 ===** $\rightarrow$ `BI CHAN BOI KHOA DONG / REDIS LOCK (HTTP 409)`, `ChiTiet: {"error":"..."}`.
3. **Kiểm chứng lại trên Web (`/inventory`):**

   - Tồn kho của `AC-PANA-12000` tại vị trí `C3-R03-S01` chỉ bị trừ **đúng `2` bộ duy nhất**, không hề bị trừ kép thành `4` bộ!
4. **Lời chốt cuối cùng:**

   > *"Qua kịch bản bắn 2 luồng song song này trên đơn xuất `AC-PANA-12000` tại `C3-R03-S01`, tồn kho chỉ bị trừ duy nhất 1 lần, không bị trừ kép (Double Deduction) và không bị âm kho. Phần demo của em cho Task 3, Task 5 và chủ đề Điều khiển đồng thời trên PostgreSQL & Redis xin kết thúc tại đây. Em cảm ơn thầy/cô!"*
   >

## GIAI ĐOẠN 4: 5 Câu hỏi vấn đáp "tủ" giảng viên hay hỏi nhất

| Câu hỏi của giảng viên                                                                                                                   | Câu trả lời ngắn gọn, đúng trọng tâm                                                                                                                                                                                                                                                                                                           |
| :-------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1. Nếu 2 phiếu xuất có nhiều mặt hàng bị ngược thứ tự `(A, B)` và `(B, A)` thì có Deadlock không?**               | Không. Trước khi xin khóa (cả Redis lẫn PostgreSQL), hàm `orderedItems.sort(...)` trong `IssueOrderService` và `StockTakeService` luôn sắp xếp danh sách theo thứ tự tăng dần `(productId, locationId)`. Mọi giao dịch xin khóa theo cùng 1 thứ tự nên **không thể tạo chu trình Deadlock**.                   |
| **2. Tại sao lúc mở khóa Redis lại dùng Lua Script thay vì gọi `DEL key` trực tiếp?**                                       | Vì nếu Request 1 bị chậm quá thời gian `TTL = 10s`, khóa của nó tự hết hạn và Request 2 lấy được khóa mới. Nếu Request 1 gọi `DEL` thẳng sẽ xóa nhầm khóa của Request 2. Lua Script kiểm tra nguyên tử `GET key == token` rồi mới `DEL` nên chỉ đúng chủ sở hữu mới được xóa.                       |
| **3. Nếu container Redis bị sập thì hệ thống có chết luôn không?**                                                            | Không. Trong `acquireRedisLocks`, em đã thiết kế khối `catch (Exception redisOffline)` để tự động **fallback** hoàn toàn xuống lớp khóa bi quan `SELECT ... FOR UPDATE` của PostgreSQL, đảm bảo hệ thống vẫn chạy liên tục và không sai lệch tồn kho.                                                         |
| **4. Tại sao Task 3 phải tách cột `reserved_quantity` riêng thay vì trừ thẳng `quantity`?**                                 | Vì giữa lúc tạo lệnh xuất (`PENDING`) và lúc thực sự bốc hàng rời khỏi kệ (`COMPLETED`) có khoảng trễ. Giữ nguyên `quantity` giúp số liệu kiểm kê vật lý ở Task 5 (`system_qty`) luôn khớp với hàng thật trên kệ, còn `reserved_quantity` giúp các đơn khác không lấy mất phần hàng đã đặt. |
| **5. Trong Task 5, nếu tồn thực tế kiểm kê (`actual_qty`) nhỏ hơn lượng đang giữ chỗ (`reserved_quantity`) thì sao?** | Trong `StockTakeService.completeStockTake` (dòng 129), hệ thống kiểm tra `if (item.getActualQty() < inventory.getReservedQuantity())` và chặn lại (`409 Conflict`), bắt buộc phải hủy hoặc xử lý đơn xuất đang giữ chỗ trước khi cân bằng giảm tồn kho.                                                                 |
