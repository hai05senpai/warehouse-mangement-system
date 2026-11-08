package com.logistic.backend.repository;

import com.logistic.backend.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;

public interface AuditRepository extends JpaRepository<Product, Long> {
    @Query(value = """
            SELECT event_type, code, occurred_at, location, quantity, status FROM (
                SELECT 'RECEIPT' AS event_type, ro.code AS code, ro.receipt_date AS occurred_at,
                       l.code AS location, CASE WHEN ro.status = 'COMPLETED' THEN ri.quantity ELSE 0 END AS quantity, ro.status AS status
                FROM receipt_items ri JOIN receipt_orders ro ON ro.id = ri.receipt_order_id
                JOIN locations l ON l.id = ri.location_id JOIN products p ON p.id = ri.product_id
                WHERE p.sku = :sku AND (CAST(:start AS timestamptz) IS NULL OR ro.receipt_date >= :start) AND (CAST(:end AS timestamptz) IS NULL OR ro.receipt_date < :end)
                UNION ALL
                SELECT 'ISSUE', io.code, io.issue_date, l.code, CASE WHEN io.status = 'COMPLETED' THEN -ii.quantity ELSE 0 END, io.status
                FROM issue_items ii JOIN issue_orders io ON io.id = ii.issue_order_id
                JOIN locations l ON l.id = ii.location_id JOIN products p ON p.id = ii.product_id
                WHERE p.sku = :sku AND (CAST(:start AS timestamptz) IS NULL OR io.issue_date >= :start) AND (CAST(:end AS timestamptz) IS NULL OR io.issue_date < :end)
                UNION ALL
                SELECT 'TRANSFER_OUT', st.code, st.transfer_date, source.code, CASE WHEN st.status = 'COMPLETED' THEN -ti.quantity ELSE 0 END, st.status
                FROM stock_transfer_items ti JOIN stock_transfers st ON st.id = ti.transfer_id
                JOIN locations source ON source.id = ti.source_location_id JOIN products p ON p.id = ti.product_id
                WHERE p.sku = :sku AND (CAST(:start AS timestamptz) IS NULL OR st.transfer_date >= :start) AND (CAST(:end AS timestamptz) IS NULL OR st.transfer_date < :end)
                UNION ALL
                SELECT 'TRANSFER_IN', st.code, st.transfer_date, destination.code, CASE WHEN st.status = 'COMPLETED' THEN ti.quantity ELSE 0 END, st.status
                FROM stock_transfer_items ti JOIN stock_transfers st ON st.id = ti.transfer_id
                JOIN locations destination ON destination.id = ti.destination_location_id JOIN products p ON p.id = ti.product_id
                WHERE p.sku = :sku AND (CAST(:start AS timestamptz) IS NULL OR st.transfer_date >= :start) AND (CAST(:end AS timestamptz) IS NULL OR st.transfer_date < :end)
                UNION ALL
                SELECT 'STOCK_ADJUSTMENT', st.code, st.stock_take_date, l.code,
                       CASE WHEN st.status = 'COMPLETED' THEN (si.actual_qty - si.system_qty) ELSE 0 END, st.status
                FROM stock_take_items si JOIN stock_takes st ON st.id = si.stock_take_id
                JOIN locations l ON l.id = si.location_id JOIN products p ON p.id = si.product_id
                WHERE p.sku = :sku AND (CAST(:start AS timestamptz) IS NULL OR st.stock_take_date >= :start) AND (CAST(:end AS timestamptz) IS NULL OR st.stock_take_date < :end)
            ) movements
            ORDER BY occurred_at DESC
            """, nativeQuery = true)
    List<Object[]> findTrace(@Param("sku") String sku, @Param("start") OffsetDateTime start,
                             @Param("end") OffsetDateTime end);
}
