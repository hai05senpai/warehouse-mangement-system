package com.logistic.backend.service;

import com.logistic.backend.dto.CreateIssueOrderRequest;
import com.logistic.backend.dto.IssueItemRequest;
import com.logistic.backend.entity.*;
import com.logistic.backend.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class IssueOrderService {

    private final IssueOrderRepository issueOrderRepository;
    private final IssueItemRepository issueItemRepository;
    private final InventoryRepository inventoryRepository;
    private final CustomerRepository customerRepository;
    private final ProductRepository productRepository;
    private final LocationRepository locationRepository;

    public IssueOrderService(IssueOrderRepository issueOrderRepository,
                             IssueItemRepository issueItemRepository,
                             InventoryRepository inventoryRepository,
                             CustomerRepository customerRepository,
                             ProductRepository productRepository,
                             LocationRepository locationRepository) {
        this.issueOrderRepository = issueOrderRepository;
        this.issueItemRepository = issueItemRepository;
        this.inventoryRepository = inventoryRepository;
        this.customerRepository = customerRepository;
        this.productRepository = productRepository;
        this.locationRepository = locationRepository;
    }

    @Transactional
    public IssueOrder createIssueOrder(CreateIssueOrderRequest request) {
        if (request == null || request.getCode() == null || request.getCode().isBlank()
                || request.getCustomerId() == null || request.getItems() == null || request.getItems().isEmpty()) {
            throw new IllegalArgumentException("Order code and at least one item are required");
        }
        Customer customer = customerRepository.findById(request.getCustomerId())
                .orElseThrow(() -> new IllegalArgumentException("Customer not found with id: " + request.getCustomerId()));

        IssueOrder issueOrder = IssueOrder.builder()
                .code(request.getCode())
                .customer(customer)
                .status("PENDING")
                .createdBy(request.getCreatedBy())
                .build();

        IssueOrder savedOrder = issueOrderRepository.save(issueOrder);

        List<IssueItemRequest> orderedItems = new ArrayList<>(request.getItems());
        if (orderedItems.stream().anyMatch(item -> item == null || item.getProductId() == null
                || item.getLocationId() == null || item.getQuantity() == null || item.getQuantity() <= 0)) {
            throw new IllegalArgumentException("Each issue item requires product, location, and a positive quantity");
        }
        orderedItems.sort(Comparator.comparing(IssueItemRequest::getProductId, Comparator.nullsFirst(Long::compareTo))
                .thenComparing(IssueItemRequest::getLocationId, Comparator.nullsFirst(Long::compareTo)));
        for (IssueItemRequest itemReq : orderedItems) {
            // Sử dụng Lock bi quan (Pessimistic Lock) khi đọc tồn kho để chống race condition
            Inventory inventory = inventoryRepository.findByProductIdAndLocationIdWithLock(
                    itemReq.getProductId(), itemReq.getLocationId())
                    .orElseThrow(() -> new IllegalArgumentException("Inventory item not found"));

            int availableQty = inventory.getQuantity() - inventory.getReservedQuantity();
            if (availableQty < itemReq.getQuantity()) {
                throw new IllegalStateException("Not enough available stock for product ID: " + itemReq.getProductId()
                        + ". Available: " + availableQty + ", Requested: " + itemReq.getQuantity());
            }

            // Tăng số lượng giữ chỗ (reserved)
            inventory.setReservedQuantity(inventory.getReservedQuantity() + itemReq.getQuantity());
            inventoryRepository.save(inventory);

            Product product = productRepository.findById(itemReq.getProductId())
                    .orElseThrow(() -> new IllegalArgumentException("Product not found"));
            Location location = locationRepository.findById(itemReq.getLocationId())
                    .orElseThrow(() -> new IllegalArgumentException("Location not found"));

            IssueItem issueItem = IssueItem.builder()
                    .issueOrder(savedOrder)
                    .product(product)
                    .location(location)
                    .quantity(itemReq.getQuantity())
                    .build();

            issueItemRepository.save(issueItem);
        }

        return savedOrder;
    }

    @Transactional
    public IssueOrder completeIssueOrder(Long id) {
        // 1. Khóa luôn dòng Đơn hàng (Request 2 sẽ bị block tại dòng này cho đến khi Request 1 chạy xong)
        IssueOrder order = issueOrderRepository.findByIdWithLock(id)
                .orElseThrow(() -> new IllegalArgumentException("Issue order not found"));

        // 2. Chặn ngay nếu đơn đã được xử lý (Chống Double-click)
        if (!"PENDING".equals(order.getStatus())) {
            throw new IllegalStateException("Đơn hàng này đã hoàn tất hoặc bị hủy, không thể xử lý lại!");
        }

        // 3. Xử lý trừ kho như cũ
        List<IssueItem> items = issueItemRepository.findByIssueOrderId(id); // Nếu có repository này
        items.sort(Comparator.comparing((IssueItem item) -> item.getProduct().getId())
                .thenComparing(item -> item.getLocation().getId()));
        for (IssueItem item : items) {
            Inventory inventory = inventoryRepository.findByProductIdAndLocationIdWithLock(
                    item.getProduct().getId(), item.getLocation().getId())
                    .orElseThrow(() -> new IllegalStateException("Inventory not found for reserved issue item"));

            // Khi thực xuất: Trừ cả tồn thực tế và tồn giữ chỗ
            if (inventory.getQuantity() < item.getQuantity() || inventory.getReservedQuantity() < item.getQuantity()) {
                throw new IllegalStateException("Inventory reservation is inconsistent for product ID: " + item.getProduct().getId());
            }
            inventory.setQuantity(inventory.getQuantity() - item.getQuantity());
            inventory.setReservedQuantity(inventory.getReservedQuantity() - item.getQuantity());
            inventoryRepository.save(inventory);
        }

        order.setStatus("COMPLETED");
        return issueOrderRepository.save(order);
    }

    @Transactional
    public IssueOrder cancelIssueOrder(Long id) {
        IssueOrder order = issueOrderRepository.findByIdWithLock(id)
                .orElseThrow(() -> new IllegalArgumentException("Issue order not found: " + id));
        if (!"PENDING".equals(order.getStatus())) {
            throw new IllegalStateException("Only pending issue orders can be cancelled");
        }
        for (IssueItem item : issueItemRepository.findOrderedByIssueOrderId(id)) {
            Inventory inventory = inventoryRepository.findByProductIdAndLocationIdWithLock(
                    item.getProduct().getId(), item.getLocation().getId())
                    .orElseThrow(() -> new IllegalStateException("Reserved inventory no longer exists"));
            int reserved = inventory.getReservedQuantity() - item.getQuantity();
            if (reserved < 0) throw new IllegalStateException("Inventory reservation is inconsistent");
            inventory.setReservedQuantity(reserved);
        }
        order.setStatus("CANCELLED");
        return issueOrderRepository.save(order);
    }
}