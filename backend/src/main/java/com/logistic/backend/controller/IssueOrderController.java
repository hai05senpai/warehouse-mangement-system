package com.logistic.backend.controller;

import com.logistic.backend.dto.CreateIssueOrderRequest;
import com.logistic.backend.entity.IssueItem;
import com.logistic.backend.entity.IssueOrder;
import com.logistic.backend.repository.IssueItemRepository;
import com.logistic.backend.repository.IssueOrderRepository;
import com.logistic.backend.service.IssueOrderService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/issue-orders")
public class IssueOrderController {

    private final IssueOrderService issueOrderService;
    private final IssueOrderRepository issueOrderRepository;
    private final IssueItemRepository issueItemRepository;

    public IssueOrderController(IssueOrderService issueOrderService,
                                IssueOrderRepository issueOrderRepository,
                                IssueItemRepository issueItemRepository) {
        this.issueOrderService = issueOrderService;
        this.issueOrderRepository = issueOrderRepository;
        this.issueItemRepository = issueItemRepository;
    }

    @GetMapping
    public List<IssueOrder> list() { return issueOrderRepository.findAllWithCustomer(); }

    @GetMapping("/{id}/items")
    public List<IssueItem> items(@PathVariable Long id) {
        if (!issueOrderRepository.existsById(id)) {
            throw new IllegalArgumentException("Issue order not found");
        }
        return issueItemRepository.findDetailsByIssueOrderId(id);
    }

    @PostMapping
    public ResponseEntity<IssueOrder> createIssueOrder(@RequestBody CreateIssueOrderRequest request) {
        IssueOrder order = issueOrderService.createIssueOrder(request);
        return ResponseEntity.ok(order);
    }

    @PutMapping("/{id}/complete")
    public ResponseEntity<IssueOrder> completeIssueOrder(@PathVariable Long id) {
        IssueOrder order = issueOrderService.completeIssueOrder(id);
        return ResponseEntity.ok(order);
    }

    @PutMapping("/{id}/cancel")
    public ResponseEntity<IssueOrder> cancelIssueOrder(@PathVariable Long id) {
        return ResponseEntity.ok(issueOrderService.cancelIssueOrder(id));
    }
}
