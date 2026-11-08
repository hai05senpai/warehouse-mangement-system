package com.logistic.backend.repository;

import com.logistic.backend.entity.StockTakeItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StockTakeItemRepository extends JpaRepository<StockTakeItem, Long> {
    List<StockTakeItem> findByStockTakeId(Long stockTakeId);
    @Query("select i from StockTakeItem i where i.stockTake.id = :id order by i.product.id, i.location.id")
    List<StockTakeItem> findOrderedByStockTakeId(@Param("id") Long stockTakeId);

    interface StockTakeSummary {
        Long getItemCount();
        Long getSystemQuantity();
        Long getActualQuantity();
        Long getDifference();
    }

    @Query("SELECT i FROM StockTakeItem i JOIN FETCH i.product JOIN FETCH i.location " +
            "WHERE i.stockTake.id = :stockTakeId ORDER BY i.product.sku, i.location.code")
    List<StockTakeItem> findDetails(@Param("stockTakeId") Long stockTakeId);

    @Query("SELECT COUNT(i) AS itemCount, COALESCE(SUM(i.systemQty), 0) AS systemQuantity, " +
            "COALESCE(SUM(i.actualQty), 0) AS actualQuantity, " +
            "COALESCE(SUM(i.actualQty - i.systemQty), 0) AS difference " +
            "FROM StockTakeItem i WHERE i.stockTake.id = :stockTakeId")
    StockTakeSummary summarize(@Param("stockTakeId") Long stockTakeId);
}