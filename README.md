# Hệ thống quản lý kho hàng (WMS)

Ứng dụng quản lý danh mục hàng hóa, nhập - xuất kho, điều chuyển vị trí, kiểm kê và báo cáo tồn kho. Dự án gồm REST API dùng Spring Boot, cơ sở dữ liệu PostgreSQL, Redis và giao diện quản trị React/Vite.

## Công nghệ sử dụng

- **Backend:** Java 21, Spring Boot 4, Spring Data JPA/Hibernate, Spring Data Redis, Validation, Lombok, Maven Wrapper (`mvnw`)
- **Cơ sở dữ liệu & Cache:** PostgreSQL 17, Redis 7
- **Frontend:** React 18, TypeScript, Vite, React Router, Axios, Tailwind CSS 4, Lucide Icons

## Cấu trúc thư mục

```text
dbms-logistic/
├── backend/                  # Mã nguồn REST API (Spring Boot)
│   ├── src/main/java/        # Controller, Service, Repository, Entity, DTO
│   └── src/main/resources/
│       ├── application.yaml  # Cấu hình ứng dụng (đọc biến từ tệp .env)
│       └── data/             # Bộ script SQL dữ liệu mẫu (01 -> 12)
├── frontend/                 # Giao diện người dùng (React + TypeScript + Vite)
│   └── src/                  # Pages, Components, API client
├── docker-compose.yml        # Cấu hình container PostgreSQL 17 & Redis 7
└── .env.example              # Tệp mẫu cấu hình biến môi trường
```

## Yêu cầu cài đặt

- **JDK 21** (kiểm tra bằng `java -version`)
- **Node.js 18+** và **npm** (kiểm tra bằng `node -v` và `npm -v`)
- **Docker Desktop** (hoặc cài đặt trực tiếp PostgreSQL 17 và Redis trên máy)

---

## Hướng dẫn khởi chạy dự án

### Bước 1. Cấu hình biến môi trường (`.env`)

Tại thư mục gốc `dbms-logistic`, sao chép tệp `.env.example` thành `.env`:

- **Windows (PowerShell):**
  ```powershell
  Copy-Item .env.example .env
  ```
- **macOS / Linux (Bash):**
  ```bash
  cp .env.example .env
  ```

> **Lưu ý:** Tệp `.env` chứa thông tin kết nối cơ sở dữ liệu (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `SPRING_DATASOURCE_*`) và Redis. Khi chạy `application.yaml`, Spring Boot sẽ tự động nạp tệp `.env` ở thư mục gốc.
> - Nếu dùng **Docker Compose**, giữ nguyên các giá trị mặc định trong `.env.example` (`logistic_user` / `logistic_password`).
> - Nếu dùng **PostgreSQL cài trực tiếp trên máy**, hãy chỉnh lại `POSTGRES_USER`, `POSTGRES_PASSWORD`, `SPRING_DATASOURCE_USERNAME` và `SPRING_DATASOURCE_PASSWORD` trong `.env` theo tài khoản local của bạn.

### Bước 2. Khởi động PostgreSQL và Redis

Tại thư mục gốc `dbms-logistic`, chạy Docker Compose:

```powershell
docker compose up -d
```

Lệnh này khởi tạo:
- **PostgreSQL 17** (`logistic-postgres`) tại cổng `5432` — database `logistic_db`, user `logistic_user`, mật khẩu `logistic_password`.
- **Redis 7** (`logistic-redis`) tại cổng `6379`.

Kiểm tra trạng thái container:

```powershell
docker compose ps
```

### Bước 3. Chạy Backend (Spring Boot)

Mở cửa sổ terminal tại thư mục gốc và di chuyển vào `backend`:

- **Windows (PowerShell):**
  ```powershell
  cd backend
  .\mvnw.cmd spring-boot:run "-Dspring-boot.run.jvmArguments=-Duser.timezone=UTC"
  ```
- **macOS / Linux (Bash):**
  ```bash
  cd backend
  ./mvnw spring-boot:run -Dspring-boot.run.jvmArguments="-Duser.timezone=UTC"
  ```

- Backend chạy tại `http://localhost:8080` (các endpoint API có tiền tố `/api`).
- Tùy chọn `-Duser.timezone=UTC` đảm bảo múi giờ chuẩn cho kết nối JDBC/PostgreSQL trên Windows.
- Trong lần chạy đầu tiên, Hibernate (`ddl-auto=update`) sẽ tự động tạo bảng và `AdminDataInitializer` sẽ tự tạo các tài khoản quản trị mặc định.

### Bước 4. Nạp dữ liệu mẫu (Tùy chọn nhưng khuyến nghị)

Các script dữ liệu mẫu trong `backend/src/main/resources/data/` (`01_suppliers.sql` đến `12_admins.sql`) **không tự động chạy**. Sau khi Backend đã khởi động thành công lần đầu (để tạo đầy đủ các bảng), bạn có thể nạp toàn bộ dữ liệu mẫu:

- **Trên Windows PowerShell (khi dùng Docker PostgreSQL):**
  Chạy tại thư mục gốc `dbms-logistic`:
  ```powershell
  Get-ChildItem backend/src/main/resources/data/*.sql | Sort-Object Name | ForEach-Object {
      Write-Host "Đang nạp $($_.Name)..."
      Get-Content $_.FullName -Raw -Encoding UTF8 | docker exec -i logistic-postgres psql -U logistic_user -d logistic_db
  }
  ```

- **Trên macOS / Linux (khi dùng Docker PostgreSQL):**
  ```bash
  for f in backend/src/main/resources/data/*.sql; do
      echo "Đang nạp $f..."
      docker exec -i logistic-postgres psql -U logistic_user -d logistic_db < "$f"
  done
  ```

- **Nếu dùng công cụ quản trị DB (DBeaver, pgAdmin, DataGrip):**
  Mở và chạy lần lượt các tệp trong `backend/src/main/resources/data/` theo đúng thứ tự số thứ tự từ `01_suppliers.sql` đến `12_admins.sql`.

### Bước 5. Chạy Frontend (React + Vite)

Mở một cửa sổ terminal mới và chạy:

```powershell
cd frontend
npm install
npm run dev
```

Mở trình duyệt tại địa chỉ Vite hiển thị (mặc định là `http://localhost:5173`).

---

## Tài khoản đăng nhập mặc định

Khi khởi chạy Backend lần đầu, hệ thống tự động khởi tạo sẵn tài khoản quản trị:

| Tên đăng nhập | Mật khẩu | Vai trò | Ghi chú |
| :--- | :--- | :--- | :--- |
| `admin` | `admin123` | `SUPER_ADMIN` | Tự động tạo khi khởi chạy backend |
| `manager` | `admin123` | `WAREHOUSE_MANAGER` | Tự động tạo khi khởi chạy backend |
| `staff01` | `admin123` | `STAFF` | Có thêm khi nạp `12_admins.sql` |

---

## Kiểm tra chất lượng & Kiểm thử

- **Kiểm tra build và lint Frontend** (chạy tại thư mục `frontend`):
  ```powershell
  npm run build
  npm run lint
  ```

- **Chạy kiểm thử Backend** (chạy tại thư mục `backend`, yêu cầu PostgreSQL đang hoạt động và đã có tệp `.env`):
  ```powershell
  .\mvnw.cmd test "-Duser.timezone=UTC"
  ```

---

## Các chức năng chính

- **Đăng nhập / Đăng xuất:** Xác thực người dùng quản trị và quản lý phiên làm việc.
- **Tổng quan (Dashboard):** Thống kê số mặt hàng, tổng số lượng tồn, cảnh báo tồn thấp và đơn chờ xử lý.
- **Danh mục hàng hóa:** Thêm, sửa hàng hóa; chỉ cho phép xóa hàng hóa chưa phát sinh tồn kho hoặc lịch sử giao dịch.
- **Tồn kho & Điều chuyển:** Tìm kiếm theo SKU/khu vực, lọc hàng khả dụng; điều chuyển giữa các vị trí kho có lưu vết lịch sử.
- **Đơn nhập kho:** Tạo phiếu ở trạng thái chờ (`PENDING`), hoàn tất để cộng tồn kho hoặc hủy phiếu.
- **Đơn xuất kho:** Sử dụng khóa dòng tồn kho (Pessimistic Write Lock) khi giữ chỗ (`reserved_quantity`) để chống xuất vượt tồn; hoàn tất để trừ tồn, hủy để giải phóng lượng giữ chỗ.
- **Kiểm kê:** Lập phiếu kiểm kê nháp (`DRAFT`), tự động tính chênh lệch với tồn hệ thống và xác nhận điều chỉnh.
- **Báo cáo & Truy vết:** Cảnh báo tồn thấp, danh sách hàng chậm luân chuyển (không có giao dịch xuất trong kỳ), báo cáo nhập - xuất - tồn và truy vết lịch sử theo từng SKU.

---

## Xử lý sự cố thường gặp

- **Lỗi `password authentication failed` khi chạy Backend:**
  Kiểm tra xem bạn đã tạo tệp `.env` từ `.env.example` ở thư mục gốc chưa. Nếu chưa có `.env`, mật khẩu kết nối DB mặc định sẽ bị trống. Ngoài ra, nếu máy bạn có cài PostgreSQL local đang chiếm cổng `5432`, hãy tắt dịch vụ PostgreSQL local của Windows (`services.msc`) hoặc đổi cổng để tránh xung đột với container Docker.
- **Lỗi `FATAL: invalid value for parameter "TimeZone"` trên Windows:**
  Đảm bảo chạy Backend/Test kèm tham số `-Duser.timezone=UTC` như hướng dẫn ở Bước 3.
- **Không kết nối được API từ Frontend:**
  Xác nhận container PostgreSQL và Backend (`http://localhost:8080`) đang chạy.
- **Bị báo hết phiên đăng nhập sau khi khởi động lại Backend:**
  Phiên đăng nhập hiện được lưu trên bộ nhớ (in-memory) của Backend. Khi restart Backend, hãy đăng xuất và đăng nhập lại trên giao diện.
- **Danh sách hàng hóa / đơn hàng trống:**
  Dữ liệu mẫu không tự nạp khi chạy ứng dụng. Hãy chạy lệnh nạp các script SQL tại Bước 4 hoặc tạo mới qua giao diện.
