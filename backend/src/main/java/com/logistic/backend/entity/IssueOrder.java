package com.logistic.backend.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "issue_orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IssueOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Column(nullable = false, length = 20)
    private String status; // PENDING, COMPLETED, CANCELLED

    @Column(name = "issue_date")
    private OffsetDateTime issueDate;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @PrePersist
    public void onCreate() {
        if (this.issueDate == null) {
            this.issueDate = OffsetDateTime.now();
        }
        if (this.status == null) {
            this.status = "PENDING";
        }
    }
}