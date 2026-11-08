package com.logistic.backend.repository;

import com.logistic.backend.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;

public interface ReportRepository extends JpaRepository<Product, Long> {
    interface StagnantRow {
        Long getProductId();
        String getSku();
        String getProductName();
        Long getOnHand();
        OffsetDateTime getLastIssueDate();
    }

    interface InOutRow {
        Long getProductId();
        String getSku();
        String getProductName();
        Long getOpeningQuantity();
        Long getReceivedQuantity();
        Long getIssuedQuantity();
        Long getAdjustmentQuantity();
        Long getClosingQuantity();
    }

    @Query(value = """
            SELECT p.id AS "productId", p.sku AS sku, p.name AS "productName",
                   SUM(i.quantity) AS "onHand", MAX(last_issue.issue_date) AS "lastIssueDate"
            FROM products p
            JOIN inventory i ON i.product_id = p.id
            LEFT JOIN (
                SELECT ii.product_id, MAX(io.issue_date) AS issue_date
                FROM issue_items ii JOIN issue_orders io ON io.id = ii.issue_order_id
                WHERE io.status = 'COMPLETED'
                GROUP BY ii.product_id
            ) last_issue ON last_issue.product_id = p.id
            WHERE i.quantity > 0
              AND NOT EXISTS (
                  SELECT 1 FROM issue_items ii JOIN issue_orders io ON io.id = ii.issue_order_id
                  WHERE ii.product_id = p.id AND io.status = 'COMPLETED' AND io.issue_date >= :since
              )
            GROUP BY p.id, p.sku, p.name
            ORDER BY p.sku
            """, nativeQuery = true)
    List<StagnantRow> findStagnant(@Param("since") OffsetDateTime since);

    @Query(value = """
            WITH receipt_totals AS (
                SELECT ri.product_id, SUM(ri.quantity) AS qty
                FROM receipt_items ri JOIN receipt_orders ro ON ro.id = ri.receipt_order_id
                WHERE ro.status = 'COMPLETED' AND ro.receipt_date >= :start AND ro.receipt_date < :end
                GROUP BY ri.product_id
            ), issue_totals AS (
                SELECT ii.product_id, SUM(ii.quantity) AS qty
                FROM issue_items ii JOIN issue_orders io ON io.id = ii.issue_order_id
                WHERE io.status = 'COMPLETED' AND io.issue_date >= :start AND io.issue_date < :end
                GROUP BY ii.product_id
            ), adjustments AS (
                SELECT si.product_id, SUM(si.actual_qty - si.system_qty) AS qty
                FROM stock_take_items si JOIN stock_takes st ON st.id = si.stock_take_id
                WHERE st.status = 'COMPLETED' AND st.stock_take_date >= :start AND st.stock_take_date < :end
                GROUP BY si.product_id
            ), all_receipts AS (
                SELECT ri.product_id, SUM(ri.quantity) AS qty
                FROM receipt_items ri JOIN receipt_orders ro ON ro.id = ri.receipt_order_id
                WHERE ro.status = 'COMPLETED' AND ro.receipt_date >= :start
                GROUP BY ri.product_id
            ), all_issues AS (
                SELECT ii.product_id, SUM(ii.quantity) AS qty
                FROM issue_items ii JOIN issue_orders io ON io.id = ii.issue_order_id
                WHERE io.status = 'COMPLETED' AND io.issue_date >= :start
                GROUP BY ii.product_id
            ), all_adjustments AS (
                SELECT si.product_id, SUM(si.actual_qty - si.system_qty) AS qty
                FROM stock_take_items si JOIN stock_takes st ON st.id = si.stock_take_id
                WHERE st.status = 'COMPLETED' AND st.stock_take_date >= :start
                GROUP BY si.product_id
            ), closing AS (
                SELECT product_id, SUM(quantity) AS qty FROM inventory GROUP BY product_id
            )
            SELECT p.id AS "productId", p.sku AS sku, p.name AS "productName",
                   COALESCE(c.qty, 0) - COALESCE(ar.qty, 0) + COALESCE(ai.qty, 0) - COALESCE(aa.qty, 0) AS "openingQuantity",
                   COALESCE(r.qty, 0) AS "receivedQuantity", COALESCE(i.qty, 0) AS "issuedQuantity",
                   COALESCE(a.qty, 0) AS "adjustmentQuantity",
                   COALESCE(c.qty, 0) - COALESCE(ar.qty, 0) + COALESCE(ai.qty, 0) - COALESCE(aa.qty, 0)
                   + COALESCE(r.qty, 0) - COALESCE(i.qty, 0) + COALESCE(a.qty, 0) AS "closingQuantity"
            FROM products p
            LEFT JOIN closing c ON c.product_id = p.id
            LEFT JOIN receipt_totals r ON r.product_id = p.id
            LEFT JOIN issue_totals i ON i.product_id = p.id
            LEFT JOIN adjustments a ON a.product_id = p.id
            LEFT JOIN all_receipts ar ON ar.product_id = p.id
            LEFT JOIN all_issues ai ON ai.product_id = p.id
            LEFT JOIN all_adjustments aa ON aa.product_id = p.id
            ORDER BY p.sku
            """, nativeQuery = true)
    List<InOutRow> findInOut(@Param("start") OffsetDateTime start, @Param("end") OffsetDateTime end);
}
