package com.logistic.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "stock_takes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StockTake {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Column(nullable = false, length = 20)
    private String status; // DRAFT, COMPLETED, CANCELLED

    @Column(name = "stock_take_date")
    private OffsetDateTime stockTakeDate;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @Column(name = "approved_by", length = 100)
    private String approvedBy;

    @PrePersist
    public void onCreate() {
        if (this.stockTakeDate == null) {
            this.stockTakeDate = OffsetDateTime.now();
        }
        if (this.status == null) {
            this.status = "DRAFT";
        }
    }
}