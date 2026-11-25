-- =============================================================================
-- SETUP DỮ LIỆU DEMO TRANSACTION
-- Tạo schema txn_demo riêng, không ảnh hưởng dữ liệu app.
-- Cấu trúc bảng khớp 100% với entity JPA của app.
-- Chạy: pgAdmin → Query Tool hoặc psql
-- =============================================================================

DROP SCHEMA IF EXISTS txn_demo CASCADE;
CREATE SCHEMA txn_demo;
SET search_path = txn_demo;

-- Bảng nhà cung cấp (khớp Supplier.java)
CREATE TABLE suppliers (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    contact_name VARCHAR(100),
    phone        VARCHAR(20),
    email        VARCHAR(100),
    address      TEXT
);

-- Bảng khách hàng (khớp Customer.java)
CREATE TABLE customers (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    contact_name VARCHAR(100),
    phone        VARCHAR(20),
    email        VARCHAR(100),
    address      TEXT
);

-- Bảng sản phẩm (khớp Product.java)
CREATE TABLE products (
    id           SERIAL PRIMARY KEY,
    sku          VARCHAR(50) UNIQUE NOT NULL,
    name         VARCHAR(255) NOT NULL,
    category     VARCHAR(50),
    unit         VARCHAR(20) DEFAULT 'Cái',
    min_quantity INT DEFAULT 10
);

-- Bảng vị trí kho (khớp Location.java)
CREATE TABLE locations (
    id    SERIAL PRIMARY KEY,
    code  VARCHAR(50) UNIQUE NOT NULL,
    zone  VARCHAR(50) NOT NULL,
    rack  VARCHAR(50),
    shelf VARCHAR(50)
);

-- Bảng tồn kho (khớp Inventory.java)
CREATE TABLE inventory (
    id                SERIAL PRIMARY KEY,
    product_id        INT NOT NULL REFERENCES products(id),
    location_id       INT NOT NULL REFERENCES locations(id),
    quantity          INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reserved_quantity INT NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    updated_at        TIMESTAMPTZ DEFAULT now(),
    UNIQUE (product_id, location_id)
);

-- Bảng phiếu nhập kho (khớp ReceiptOrder.java)
CREATE TABLE receipt_orders (
    id           SERIAL PRIMARY KEY,
    code         VARCHAR(50) UNIQUE NOT NULL,
    supplier_id  INT NOT NULL REFERENCES suppliers(id),
    status       VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    receipt_date TIMESTAMPTZ DEFAULT now(),
    created_by   VARCHAR(100)
);

-- Chi tiết phiếu nhập (khớp ReceiptItem.java)
CREATE TABLE receipt_items (
    id               SERIAL PRIMARY KEY,
    receipt_order_id INT NOT NULL REFERENCES receipt_orders(id),
    product_id       INT NOT NULL REFERENCES products(id),
    location_id      INT NOT NULL REFERENCES locations(id),
    quantity         INT NOT NULL CHECK (quantity > 0)
);

-- Bảng phiếu xuất kho (khớp IssueOrder.java)
CREATE TABLE issue_orders (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT NOT NULL REFERENCES customers(id),
    status      VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    issue_date  TIMESTAMPTZ DEFAULT now(),
    created_by  VARCHAR(100)
);

-- Chi tiết phiếu xuất (khớp IssueItem.java)
CREATE TABLE issue_items (
    id             SERIAL PRIMARY KEY,
    issue_order_id INT NOT NULL REFERENCES issue_orders(id),
    product_id     INT NOT NULL REFERENCES products(id),
    location_id    INT NOT NULL REFERENCES locations(id),
    quantity       INT NOT NULL CHECK (quantity > 0)
);

-- ===================== DỮ LIỆU MẪU =====================

INSERT INTO suppliers (name, contact_name, phone, email, address) VALUES
    ('NCC Alpha', 'Nguyễn Văn A', '0901234567', 'alpha@ncc.vn', '123 Lý Thường Kiệt, Q.10, TP.HCM'),
    ('NCC Beta',  'Trần Thị B',  '0909876543', 'beta@ncc.vn',  '456 Nguyễn Trãi, Q.5, TP.HCM');

INSERT INTO customers (name, contact_name, phone, email, address) VALUES
    ('KH Minh', 'Lê Minh',  '0911111111', 'minh@kh.vn', '789 CMT8, Q.3, TP.HCM'),
    ('KH Hải',  'Phạm Hải', '0922222222', 'hai@kh.vn',  '321 Điện Biên Phủ, Q.1, TP.HCM');

INSERT INTO products (sku, name, category, unit, min_quantity) VALUES
    ('LAP-001', 'Laptop Dell XPS 15',       'Điện tử',  'Cái', 5),
    ('PHN-001', 'Điện thoại Samsung S24',    'Điện tử',  'Cái', 10),
    ('MOU-001', 'Chuột Logitech MX Master',  'Phụ kiện', 'Cái', 20);

INSERT INTO locations (code, zone, rack, shelf) VALUES
    ('A1-R01-S01', 'Khu A - Hàng Điện Tử', 'Kệ 01', 'Tầng 01'),
    ('A1-R01-S02', 'Khu A - Hàng Điện Tử', 'Kệ 01', 'Tầng 02'),
    ('B1-R01-S01', 'Khu B - Phụ Kiện',     'Kệ 01', 'Tầng 01');

INSERT INTO inventory (product_id, location_id, quantity, reserved_quantity) VALUES
    (1, 1, 50, 0),   -- 50 Laptop ở A1-R01-S01
    (2, 2, 100, 0),  -- 100 Điện thoại ở A1-R01-S02
    (3, 3, 200, 0);  -- 200 Chuột ở B1-R01-S01

-- Kiểm tra dữ liệu
SELECT p.sku, p.name, p.category, l.code AS vi_tri, l.zone, l.rack, l.shelf,
       i.quantity AS ton_kho, i.reserved_quantity AS da_giu
FROM inventory i
JOIN products p ON p.id = i.product_id
JOIN locations l ON l.id = i.location_id
ORDER BY p.sku;
