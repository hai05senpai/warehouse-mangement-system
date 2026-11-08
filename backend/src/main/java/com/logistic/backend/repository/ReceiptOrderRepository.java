package com.logistic.backend.repository;

import com.logistic.backend.entity.ReceiptOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ReceiptOrderRepository extends JpaRepository<ReceiptOrder, Long> {
    Optional<ReceiptOrder> findByCode(String code);

    @Query("select r from ReceiptOrder r join fetch r.supplier order by r.receiptDate desc")
    List<ReceiptOrder> findAllWithSupplier();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from ReceiptOrder r where r.id = :id")
    Optional<ReceiptOrder> findByIdWithLock(@Param("id") Long id);
}
