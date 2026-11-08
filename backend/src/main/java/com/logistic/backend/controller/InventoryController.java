package com.logistic.backend.controller;

import com.logistic.backend.dto.TransferRequest;
import com.logistic.backend.entity.Inventory;
import com.logistic.backend.entity.StockTransfer;
import com.logistic.backend.entity.Location;
import com.logistic.backend.repository.LocationRepository;
import com.logistic.backend.repository.ProductRepository;
import com.logistic.backend.service.InventoryService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class InventoryController {
    private final InventoryService service;
    private final ProductRepository products;
    private final LocationRepository locations;
    public InventoryController(InventoryService service, ProductRepository products, LocationRepository locations) {
        this.service = service; this.products = products; this.locations = locations;
    }
    @GetMapping("/inventory")
    public List<Inventory> search(@RequestParam(required = false) String sku,
                                  @RequestParam(required = false) String zone,
                                  @RequestParam(defaultValue = "false") boolean availableOnly) {
        return service.search(sku, zone, availableOnly);
    }
    @PostMapping("/transfers") @ResponseStatus(HttpStatus.CREATED)
    public StockTransfer transfer(@RequestBody TransferRequest request) { return service.transfer(request); }
    @GetMapping("/locations") public List<Location> locations() { return locations.findAll(); }
}
