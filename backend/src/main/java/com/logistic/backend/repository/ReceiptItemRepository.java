package com.logistic.backend.repository;

import com.logistic.backend.entity.ReceiptItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ReceiptItemRepository extends JpaRepository<ReceiptItem, Long> {
    List<ReceiptItem> findByReceiptOrderId(Long receiptOrderId);

    /** Chi tiết phiếu nhập: nạp sẵn phiếu, nhà cung cấp, hàng hóa, vị trí để trả JSON không bị lỗi lazy. */
    @Query("SELECT i FROM ReceiptItem i JOIN FETCH i.receiptOrder ro JOIN FETCH ro.supplier JOIN FETCH i.product " +
           "JOIN FETCH i.location WHERE ro.id = :id ORDER BY i.product.sku, i.location.code")
    List<ReceiptItem> findDetailsByReceiptOrderId(@Param("id") Long receiptOrderId);
}
