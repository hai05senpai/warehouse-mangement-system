package com.logistic.backend.repository;

import com.logistic.backend.entity.StockTake;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

@Repository
public interface StockTakeRepository extends JpaRepository<StockTake, Long> {
    Optional<StockTake> findByCode(String code);
    List<StockTake> findAllByOrderByStockTakeDateDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from StockTake s where s.id = :id")
    Optional<StockTake> findByIdWithLock(@Param("id") Long id);
}