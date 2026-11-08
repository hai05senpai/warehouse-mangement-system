package com.logistic.backend.repository;

import com.logistic.backend.entity.StockTransferItem;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StockTransferItemRepository extends JpaRepository<StockTransferItem, Long> {
}
