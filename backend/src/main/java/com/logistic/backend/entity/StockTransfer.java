package com.logistic.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "stock_transfers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StockTransfer {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(name = "transfer_date", nullable = false)
    private OffsetDateTime transferDate;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @PrePersist
    void onCreate() {
        if (transferDate == null) transferDate = OffsetDateTime.now();
        if (status == null) status = "COMPLETED";
    }
}
