package com.logistic.backend.controller;

import com.logistic.backend.dto.CreateStockTakeRequest;
import com.logistic.backend.entity.StockTake;
import com.logistic.backend.entity.StockTakeItem;
import com.logistic.backend.repository.StockTakeItemRepository;
import com.logistic.backend.service.StockTakeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/stock-takes")
public class StockTakeController {

    private final StockTakeService stockTakeService;

    public StockTakeController(StockTakeService stockTakeService) {
        this.stockTakeService = stockTakeService;
    }

    @GetMapping
    public List<StockTake> list() { return stockTakeService.list(); }

    @GetMapping("/{id}/items")
    public List<StockTakeItem> items(@PathVariable Long id) { return stockTakeService.items(id); }

    @GetMapping("/{id}/summary")
    public StockTakeItemRepository.StockTakeSummary summary(@PathVariable Long id) {
        return stockTakeService.summary(id);
    }

    @PostMapping
    public ResponseEntity<StockTake> createStockTake(@RequestBody CreateStockTakeRequest request) {
        StockTake stockTake = stockTakeService.createStockTake(request);
        return ResponseEntity.ok(stockTake);
    }

    @PutMapping("/{id}/complete")
    public ResponseEntity<StockTake> completeStockTake(
            @PathVariable Long id, 
            @RequestParam String approvedBy) {
        StockTake stockTake = stockTakeService.completeStockTake(id, approvedBy);
        return ResponseEntity.ok(stockTake);
    }
}