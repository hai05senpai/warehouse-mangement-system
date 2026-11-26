package com.logistic.backend.repository;

import com.logistic.backend.entity.StockTransfer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StockTransferRepository extends JpaRepository<StockTransfer, Long> {
    /** Lịch sử điều chuyển, phiếu mới nhất trước. */
    List<StockTransfer> findAllByOrderByTransferDateDescIdDesc();
}
