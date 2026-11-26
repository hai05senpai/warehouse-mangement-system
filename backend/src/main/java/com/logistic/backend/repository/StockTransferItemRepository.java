package com.logistic.backend.repository;

import com.logistic.backend.entity.StockTransferItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface StockTransferItemRepository extends JpaRepository<StockTransferItem, Long> {
    /** Chi tiết phiếu điều chuyển: nạp sẵn hàng hóa, vị trí nguồn và đích để trả JSON không bị lỗi lazy. */
    @Query("SELECT i FROM StockTransferItem i JOIN FETCH i.transfer t JOIN FETCH i.product " +
           "JOIN FETCH i.sourceLocation JOIN FETCH i.destinationLocation WHERE t.id = :id ORDER BY i.id")
    List<StockTransferItem> findDetailsByTransferId(@Param("id") Long transferId);
}
