package com.logistic.backend.controller;

import com.logistic.backend.dto.ReceiptRequest;
import com.logistic.backend.entity.ReceiptOrder;
import com.logistic.backend.service.ReceiptService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/receipt-orders")
public class ReceiptController {
    private final ReceiptService service;
    public ReceiptController(ReceiptService service) { this.service = service; }
    @GetMapping public List<ReceiptOrder> list() { return service.list(); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public ReceiptOrder create(@RequestBody ReceiptRequest request) { return service.create(request); }
    @PutMapping("/{id}/complete") public ReceiptOrder complete(@PathVariable Long id) { return service.complete(id); }
    @PutMapping("/{id}/cancel") public ReceiptOrder cancel(@PathVariable Long id) { return service.cancel(id); }
}
