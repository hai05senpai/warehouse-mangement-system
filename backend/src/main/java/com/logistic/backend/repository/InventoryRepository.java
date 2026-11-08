package com.logistic.backend.repository;

import com.logistic.backend.entity.Inventory;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

import java.util.Optional;

@Repository
public interface InventoryRepository extends JpaRepository<Inventory, Long> {

    Optional<Inventory> findByProductIdAndLocationId(Long productId, Long locationId);

    @Query("SELECT i FROM Inventory i JOIN FETCH i.product p JOIN FETCH i.location l " +
            "WHERE (:sku = '' OR lower(p.sku) LIKE lower(concat('%', :sku, '%'))) " +
            "AND (:zone = '' OR lower(l.zone) = lower(:zone)) " +
            "AND (:availableOnly = false OR i.quantity > i.reservedQuantity) " +
            "ORDER BY p.sku, l.code")
    List<Inventory> search(@Param("sku") String sku, @Param("zone") String zone,
                           @Param("availableOnly") boolean availableOnly);

    @Query("SELECT i FROM Inventory i JOIN FETCH i.product p JOIN FETCH i.location l WHERE p.id = :productId ORDER BY l.code")
    List<Inventory> findForProduct(@Param("productId") Long productId);

    interface LowStockRow {
        Long getProductId();
        String getSku();
        String getProductName();
        Integer getMinimum();
        Long getTotalQuantity();
        Long getAvailableQuantity();
    }

    @Query("SELECT p.id as productId, p.sku as sku, p.name as productName, p.minQuantity as minimum, " +
            "COALESCE(SUM(i.quantity), 0) as totalQuantity, COALESCE(SUM(i.quantity - i.reservedQuantity), 0) as availableQuantity " +
            "FROM Product p LEFT JOIN Inventory i ON i.product = p " +
            "WHERE p.minQuantity IS NOT NULL GROUP BY p.id, p.sku, p.name, p.minQuantity " +
            "HAVING COALESCE(SUM(i.quantity), 0) < p.minQuantity ORDER BY COALESCE(SUM(i.quantity), 0)")
    List<LowStockRow> findLowStock();

    @Query("SELECT COALESCE(SUM(i.quantity), 0) FROM Inventory i")
    long sumAllQuantities();

    @Query("SELECT COUNT(DISTINCT i.product.id) FROM Inventory i")
    long countStockedProducts();

    @Modifying
    @Query(value = "INSERT INTO inventory (product_id, location_id, quantity, reserved_quantity, updated_at) " +
            "VALUES (:productId, :locationId, :quantity, 0, CURRENT_TIMESTAMP) " +
            "ON CONFLICT (product_id, location_id) DO UPDATE SET quantity = inventory.quantity + EXCLUDED.quantity, updated_at = CURRENT_TIMESTAMP",
            nativeQuery = true)
    void addReceivedStock(@Param("productId") Long productId, @Param("locationId") Long locationId,
                          @Param("quantity") Integer quantity);

    // Khóa dòng trong database (SELECT ... FOR UPDATE) để xử lý Concurrency Control cho bài toán Xuất kho của Hải
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT i FROM Inventory i WHERE i.product.id = :productId AND i.location.id = :locationId")
    Optional<Inventory> findByProductIdAndLocationIdWithLock(@Param("productId") Long productId, @Param("locationId") Long locationId);
}