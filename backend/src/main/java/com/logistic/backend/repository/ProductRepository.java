package com.logistic.backend.repository;

import com.logistic.backend.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    Optional<Product> findBySku(String sku);

    @Query("select count(p) from Product p where p.id = :id and (" +
            "exists (select i.id from Inventory i where i.product = p and (i.quantity > 0 or i.reservedQuantity > 0)) or " +
            "exists (select ii.id from IssueItem ii where ii.product = p) or " +
            "exists (select ri.id from ReceiptItem ri where ri.product = p) or " +
            "exists (select si.id from StockTakeItem si where si.product = p) or " +
            "exists (select ti.id from StockTransferItem ti where ti.product = p))")
    long countUsage(@Param("id") Long id);
}