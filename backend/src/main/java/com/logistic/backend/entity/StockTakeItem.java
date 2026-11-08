package com.logistic.backend.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "stock_take_items")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StockTakeItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stock_take_id", nullable = false)
    private StockTake stockTake;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "location_id", nullable = false)
    private Location location;

    @Column(name = "system_qty", nullable = false)
    private Integer systemQty;

    @Column(name = "actual_qty", nullable = false)
    private Integer actualQty;

    @Transient
    public Integer getDiffQty() {
        return actualQty == null || systemQty == null ? null : actualQty - systemQty;
    }
}