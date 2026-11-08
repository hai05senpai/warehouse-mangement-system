package com.logistic.backend.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "products")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String sku; // Mã SKU hàng hóa

    @Column(nullable = false, length = 255)
    private String name;

    @Column(length = 50)
    private String category;

    @Column(length = 20)
    private String unit; // Đơn vị tính: Chiếc, Thùng, Kg...

    @Column(name = "min_quantity")
    private Integer minQuantity; // Phục vụ tính năng cảnh báo tồn kho thấp
}