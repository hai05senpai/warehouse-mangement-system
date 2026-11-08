package com.logistic.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "receipt_orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReceiptOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id", nullable = false)
    private Supplier supplier;

    @Column(nullable = false, length = 20)
    private String status; // PENDING, COMPLETED, CANCELLED

    @Column(name = "receipt_date")
    private OffsetDateTime receiptDate;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @PrePersist
    public void onCreate() {
        if (this.receiptDate == null) {
            this.receiptDate = OffsetDateTime.now();
        }
        if (this.status == null) {
            this.status = "PENDING";
        }
    }
}