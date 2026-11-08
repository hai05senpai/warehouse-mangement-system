# Hệ thống quản lý kho hàng (WMS)

Ứng dụng quản lý danh mục hàng hóa, nhập - xuất kho, điều chuyển vị trí, kiểm kê và báo cáo tồn kho. Dự án gồm REST API dùng Spring Boot, PostgreSQL và giao diện quản trị React/Vite.

## Công nghệ

- **Backend:** Java 21, Spring Boot 4, Spring Data JPA/Hibernate, Maven
- **Cơ sở dữ liệu:** PostgreSQL 17
- **Frontend:** React 18, TypeScript, Vite, React Router, Axios, Tailwind CSS, Lucide
- **Redis:** Có cấu hình dịch vụ trong Docker Compose; các luồng hiện tại dùng PostgreSQL

## Yêu cầu

- JDK 21
- Node.js và npm
- Docker Desktop (hoặc PostgreSQL 17 được cấu hình tương đương)

## Khởi chạy trên Windows

Mở ba cửa sổ PowerShell tại thư mục dự án.

### 1. Khởi động PostgreSQL

Tại thư mục gốc `dbms-logistic`:

```powershell
docker compose up -d postgres
```

Docker Compose tạo database `logistic_db` với user `logistic_user`, mật khẩu `logistic_password`, và mở cổng `5432`.

### 2. Chạy backend

```powershell
cd dbms-logistic\backend
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.jvmArguments=-Duser.timezone=UTC"
```

Backend chạy tại `http://localhost:8080`; API có tiền tố `/api`. Tùy chọn JVM đặt múi giờ UTC để tránh lỗi múi giờ PostgreSQL trên một số môi trường Windows.

> Hibernate tự tạo/cập nhật cấu trúc bảng (`ddl-auto: update`). Các script dữ liệu mẫu trong `backend/src/main/resources/data/` **không tự chạy**. Nếu muốn dùng dữ liệu mẫu, hãy đảm bảo database mới hoặc không bị trùng dữ liệu, khởi động backend ít nhất một lần để Hibernate tạo bảng, sau đó chạy các script SQL theo thứ tự tên tệp từ `01` đến `11`.

### 3. Chạy frontend

```powershell
cd dbms-logistic\frontend
npm install
npm run dev
```

Mở URL Vite in ra trong terminal, thường là `http://localhost:5173`.

## Kiểm tra chất lượng

Chạy tại thư mục `frontend`:

```powershell
npm run build
npm run lint
```

Chạy kiểm thử backend tại thư mục `backend` (cần PostgreSQL đang chạy và múi giờ UTC):

```powershell
.\mvnw.cmd test "-Duser.timezone=UTC"
```

## Chức năng

- **Tổng quan:** số mặt hàng, tổng số lượng, cảnh báo tồn thấp và đơn chờ xử lý.
- **Danh mục hàng hóa:** thêm, sửa; chỉ xóa hàng hóa chưa có tồn kho hoặc lịch sử giao dịch.
- **Tồn kho:** tìm theo SKU/khu vực, lọc hàng khả dụng; điều chuyển giữa các vị trí có lưu lịch sử.
- **Đơn nhập kho:** tạo phiếu ở trạng thái chờ, hoàn tất để cộng tồn hoặc hủy phiếu.
- **Đơn xuất kho:** khóa dòng tồn khi giữ chỗ để chống xuất vượt tồn; hoàn tất để trừ tồn, hủy để giải phóng lượng giữ chỗ.
- **Kiểm kê:** lập phiếu, tính chênh lệch với tồn hệ thống và xác nhận điều chỉnh.
- **Báo cáo:** cảnh báo tồn thấp, hàng không có giao dịch xuất trong thời gian chọn, báo cáo nhập - xuất - tồn và truy vết lịch sử SKU.

## API chính

Các request JSON dùng `Content-Type: application/json`. CORS cho phép frontend chạy ở `localhost:5173` và `localhost:3000`.

| Phương thức      | Endpoint                                          | Mô tả                                                   |
| ------------------- | ------------------------------------------------- | --------------------------------------------------------- |
| `GET`             | `/api/dashboard/summary`                        | Số liệu tổng quan                                      |
| `GET`, `POST`   | `/api/products`                                 | Danh sách, thêm hàng hóa                              |
| `PUT`, `DELETE` | `/api/products/{id}`                            | Sửa, xóa hàng hóa chưa được sử dụng             |
| `GET`             | `/api/inventory?sku=&zone=&availableOnly=false` | Tra cứu tồn kho; mọi tham số lọc đều tùy chọn    |
| `GET`             | `/api/locations`                                | Danh sách vị trí                                       |
| `POST`            | `/api/transfers`                                | Điều chuyển hàng hóa                                 |
| `GET`, `POST`   | `/api/receipt-orders`                           | Danh sách, tạo phiếu nhập                             |
| `PUT`             | `/api/receipt-orders/{id}/complete`             | Hoàn tất phiếu nhập, cộng tồn kho                   |
| `PUT`             | `/api/receipt-orders/{id}/cancel`               | Hủy phiếu nhập đang chờ                              |
| `GET`, `POST`   | `/api/issue-orders`                             | Danh sách, tạo phiếu xuất và giữ chỗ tồn          |
| `PUT`             | `/api/issue-orders/{id}/complete`               | Hoàn tất phiếu xuất, trừ tồn                        |
| `PUT`             | `/api/issue-orders/{id}/cancel`                 | Hủy phiếu xuất và giải phóng tồn giữ chỗ         |
| `GET`, `POST`   | `/api/stock-takes`                              | Danh sách, tạo phiếu kiểm kê                         |
| `GET`             | `/api/stock-takes/{id}/items`                   | Chi tiết phiếu kiểm kê                                |
| `GET`             | `/api/stock-takes/{id}/summary`                 | Tổng hợp số lượng và chênh lệch kiểm kê         |
| `PUT`             | `/api/stock-takes/{id}/complete?approvedBy=...` | Xác nhận kiểm kê và điều chỉnh tồn               |
| `GET`             | `/api/reports/low-stock`                        | Danh sách hàng tồn thấp                               |
| `GET`             | `/api/reports/stagnant?days=90`                 | Hàng còn tồn, không xuất trong số ngày chỉ định |
| `GET`             | `/api/reports/in-out?start=...&end=...`         | Báo cáo nhập - xuất - tồn; thời gian ISO-8601       |
| `GET`             | `/api/products/{sku}/trace?start=...&end=...`   | Lịch sử giao dịch SKU; bộ lọc thời gian tùy chọn  |
| `GET`             | `/api/suppliers`, `/api/customers`            | Dữ liệu nhà cung cấp, khách hàng cho biểu mẫu     |

### Ví dụ request

Tạo mặt hàng:

```json
{
  "sku": "SP-001",
  "name": "Sản phẩm mẫu",
  "category": "Thiết bị",
  "unit": "cái",
  "minQuantity": 10
}
```

Tạo phiếu xuất:

```json
{
  "code": "PX-0001",
  "customerId": 1,
  "createdBy": "admin",
  "items": [
    { "productId": 1, "locationId": 1, "quantity": 2 }
  ]
}
```

## Xử lý sự cố

- **Không kết nối được API:** xác nhận PostgreSQL và backend đang chạy; frontend gửi request tới `http://localhost:8080/api`.
- **API trả HTTP 500:** xem stack trace trong terminal backend. Nếu lỗi liên quan timezone, chạy backend với tùy chọn `-Duser.timezone=UTC` như hướng dẫn ở trên.
- **Frontend báo favicon 404:** làm mới trang sau khi Vite tải lại; favicon hiện được cung cấp tại `frontend/public/favicon.svg`.
- **Danh sách trống:** dữ liệu mẫu không tự nạp. Tạo dữ liệu qua giao diện/API hoặc chạy bộ script SQL mẫu sau khi các bảng đã được tạo.
