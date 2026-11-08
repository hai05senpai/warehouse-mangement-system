package com.logistic.backend.service;

import com.logistic.backend.repository.*;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.*;

@Service
public class ReportService {
    private final InventoryRepository inventory;
    private final ProductRepository products;
    private final ReportRepository reports;
    private final AuditRepository audit;

    public ReportService(InventoryRepository inventory, ProductRepository products,
                        ReportRepository reports, AuditRepository audit) {
        this.inventory = inventory;
        this.products = products;
        this.reports = reports;
        this.audit = audit;
    }

    public Map<String, Object> summary() {
        return Map.of("productCount", products.count(), "stockedProductCount", inventory.countStockedProducts(),
                "totalQuantity", inventory.sumAllQuantities(), "lowStockCount", inventory.findLowStock().size());
    }

    public List<InventoryRepository.LowStockRow> lowStock() {
        return inventory.findLowStock();
    }

    public List<ReportRepository.StagnantRow> stagnant(int days) {
        if (days < 1 || days > 3650) throw new IllegalArgumentException("days must be between 1 and 3650");
        return reports.findStagnant(OffsetDateTime.now().minusDays(days));
    }

    public List<ReportRepository.InOutRow> inOut(OffsetDateTime start, OffsetDateTime end) {
        if (start == null || end == null || !start.isBefore(end)) {
            throw new IllegalArgumentException("start and end are required and start must be before end");
        }
        return reports.findInOut(start, end);
    }

    public List<Map<String, Object>> trace(String sku, OffsetDateTime start, OffsetDateTime end) {
        if (sku == null || sku.isBlank()) throw new IllegalArgumentException("SKU is required");
        if (start != null && end != null && !start.isBefore(end)) {
            throw new IllegalArgumentException("start must be before end");
        }
        List<Map<String, Object>> results = new ArrayList<>();
        for (Object[] row : audit.findTrace(sku.trim(), start, end)) {
            Map<String, Object> movement = new LinkedHashMap<>();
            movement.put("type", row[0]);
            movement.put("code", row[1]);
            movement.put("occurredAt", row[2]);
            movement.put("location", row[3]);
            movement.put("quantity", row[4]);
            movement.put("status", row[5]);
            results.add(movement);
        }
        return results;
    }
}
