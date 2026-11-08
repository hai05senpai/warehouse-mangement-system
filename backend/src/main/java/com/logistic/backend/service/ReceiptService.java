package com.logistic.backend.service;

import com.logistic.backend.dto.ReceiptRequest;
import com.logistic.backend.entity.*;
import com.logistic.backend.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ReceiptService {
    private final ReceiptOrderRepository orders;
    private final ReceiptItemRepository items;
    private final SupplierRepository suppliers;
    private final ProductRepository products;
    private final LocationRepository locations;
    private final InventoryRepository inventory;

    public ReceiptService(ReceiptOrderRepository orders, ReceiptItemRepository items, SupplierRepository suppliers,
                         ProductRepository products, LocationRepository locations, InventoryRepository inventory) {
        this.orders = orders;
        this.items = items;
        this.suppliers = suppliers;
        this.products = products;
        this.locations = locations;
        this.inventory = inventory;
    }

    public List<ReceiptOrder> list() { return orders.findAllWithSupplier(); }

    @Transactional
    public ReceiptOrder create(ReceiptRequest request) {
        if (request == null || request.code() == null || request.code().isBlank()
                || request.supplierId() == null || request.items() == null || request.items().isEmpty()) {
            throw new IllegalArgumentException("Receipt code, supplier, and at least one item are required");
        }
        Supplier supplier = suppliers.findById(request.supplierId())
                .orElseThrow(() -> new IllegalArgumentException("Supplier not found"));
        ReceiptOrder order = orders.save(ReceiptOrder.builder().code(request.code().trim())
                .supplier(supplier).status("PENDING").createdBy(request.createdBy()).build());
        for (ReceiptRequest.ReceiptItemRequest item : request.items()) {
            if (item.productId() == null || item.locationId() == null || item.quantity() == null || item.quantity() <= 0) {
                throw new IllegalArgumentException("Receipt quantities must be positive and include product and location");
            }
            Product product = products.findById(item.productId()).orElseThrow(() -> new IllegalArgumentException("Product not found"));
            Location location = locations.findById(item.locationId()).orElseThrow(() -> new IllegalArgumentException("Location not found"));
            items.save(ReceiptItem.builder().receiptOrder(order).product(product).location(location).quantity(item.quantity()).build());
        }
        return order;
    }

    @Transactional
    public ReceiptOrder complete(Long id) {
        ReceiptOrder order = orders.findByIdWithLock(id).orElseThrow(() -> new IllegalArgumentException("Receipt order not found"));
        if (!"PENDING".equals(order.getStatus())) throw new IllegalStateException("Only pending receipt orders can be completed");
        List<ReceiptItem> receiptItems = items.findByReceiptOrderId(id);
        if (receiptItems.isEmpty()) throw new IllegalStateException("Receipt order has no items");
        for (ReceiptItem item : receiptItems) {
            inventory.addReceivedStock(item.getProduct().getId(), item.getLocation().getId(), item.getQuantity());
        }
        order.setStatus("COMPLETED");
        return order;
    }

    @Transactional
    public ReceiptOrder cancel(Long id) {
        ReceiptOrder order = orders.findByIdWithLock(id).orElseThrow(() -> new IllegalArgumentException("Receipt order not found"));
        if (!"PENDING".equals(order.getStatus())) throw new IllegalStateException("Only pending receipt orders can be cancelled");
        order.setStatus("CANCELLED");
        return order;
    }
}
