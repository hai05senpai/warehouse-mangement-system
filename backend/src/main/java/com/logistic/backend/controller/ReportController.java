package com.logistic.backend.controller;

import com.logistic.backend.repository.InventoryRepository;
import com.logistic.backend.repository.ReportRepository;
import com.logistic.backend.service.ReportService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ReportController {
    private final ReportService service;
    public ReportController(ReportService service) { this.service = service; }

    @GetMapping("/dashboard/summary")
    public Map<String, Object> summary() { return service.summary(); }

    @GetMapping("/reports/low-stock")
    public List<InventoryRepository.LowStockRow> lowStock() { return service.lowStock(); }

    @GetMapping("/reports/stagnant")
    public List<ReportRepository.StagnantRow> stagnant(@RequestParam(defaultValue = "90") int days) {
        return service.stagnant(days);
    }

    @GetMapping("/reports/in-out")
    public List<ReportRepository.InOutRow> inOut(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime end) {
        return service.inOut(start, end);
    }

    @GetMapping("/products/{sku}/trace")
    public List<Map<String, Object>> trace(@PathVariable String sku,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime end) {
        return service.trace(sku, start, end);
    }
}
