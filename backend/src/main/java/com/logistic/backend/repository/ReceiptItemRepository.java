package com.logistic.backend.repository;

import com.logistic.backend.entity.ReceiptItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ReceiptItemRepository extends JpaRepository<ReceiptItem, Long> {
    List<ReceiptItem> findByReceiptOrderId(Long receiptOrderId);
}
