package com.logistic.backend.service;

import com.logistic.backend.dto.CreateIssueOrderRequest;
import com.logistic.backend.dto.IssueItemRequest;
import com.logistic.backend.entity.*;
import com.logistic.backend.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.*;

@Service
public class IssueOrderService {

    private static final Duration LOCK_TTL = Duration.ofSeconds(10);
    private static final String UNLOCK_LUA =
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

    private final IssueOrderRepository issueOrderRepository;
    private final IssueItemRepository issueItemRepository;
    private final InventoryRepository inventoryRepository;
    private final CustomerRepository customerRepository;
    private final ProductRepository productRepository;
    private final LocationRepository locationRepository;
    private final StringRedisTemplate redisTemplate;

    @Autowired
    public IssueOrderService(IssueOrderRepository issueOrderRepository,
                             IssueItemRepository issueItemRepository,
                             InventoryRepository inventoryRepository,
                             CustomerRepository customerRepository,
                             ProductRepository productRepository,
                             LocationRepository locationRepository,
                             @Autowired(required = false) StringRedisTemplate redisTemplate) {
        this.issueOrderRepository = issueOrderRepository;
        this.issueItemRepository = issueItemRepository;
        this.inventoryRepository = inventoryRepository;
        this.customerRepository = customerRepository;
        this.productRepository = productRepository;
        this.locationRepository = locationRepository;
        this.redisTemplate = redisTemplate;
    }

    @Transactional
    public IssueOrder createIssueOrder(CreateIssueOrderRequest request) {
        if (request == null || request.getCode() == null || request.getCode().isBlank()
                || request.getCustomerId() == null || request.getItems() == null || request.getItems().isEmpty()) {
            throw new IllegalArgumentException("Order code and at least one item are required");
        }
        Customer customer = customerRepository.findById(request.getCustomerId())
                .orElseThrow(() -> new IllegalArgumentException("Customer not found with id: " + request.getCustomerId()));

        List<IssueItemRequest> orderedItems = new ArrayList<>(request.getItems());
        if (orderedItems.stream().anyMatch(item -> item == null || item.getProductId() == null
                || item.getLocationId() == null || item.getQuantity() == null || item.getQuantity() <= 0)) {
            throw new IllegalArgumentException("Each issue item requires product, location, and a positive quantity");
        }
        // Sắp xếp thứ tự khóa theo (productId, locationId) để chống Deadlock
        orderedItems.sort(Comparator.comparing(IssueItemRequest::getProductId, Comparator.nullsFirst(Long::compareTo))
                .thenComparing(IssueItemRequest::getLocationId, Comparator.nullsFirst(Long::compareTo)));

        List<String> lockKeys = orderedItems.stream()
                .map(item -> "lock:inventory:" + item.getProductId() + ":" + item.getLocationId())
                .distinct()
                .toList();
        String lockToken = UUID.randomUUID().toString();
        List<String> acquiredKeys = acquireRedisLocks(lockKeys, lockToken);

        try {
            IssueOrder issueOrder = IssueOrder.builder()
                    .code(request.getCode())
                    .customer(customer)
                    .status("PENDING")
                    .createdBy(request.getCreatedBy())
                    .build();

            IssueOrder savedOrder = issueOrderRepository.save(issueOrder);

            for (IssueItemRequest itemReq : orderedItems) {
                // Kết hợp Redis Distributed Lock ở tầng ứng dụng & Pessimistic Lock (SELECT ... FOR UPDATE) ở PostgreSQL
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
        } finally {
            releaseRedisLocks(acquiredKeys, lockToken);
        }
    }

    @Transactional
    public IssueOrder completeIssueOrder(Long id) {
        String lockToken = UUID.randomUUID().toString();
        List<String> acquiredKeys = acquireRedisLocks(List.of("lock:issue-order:" + id), lockToken);

        try {
            // 1. Khóa dòng Đơn hàng trong PostgreSQL (SELECT ... FOR UPDATE)
            IssueOrder order = issueOrderRepository.findByIdWithLock(id)
                    .orElseThrow(() -> new IllegalArgumentException("Issue order not found"));

            // 2. Chặn ngay nếu đơn đã được xử lý (Chống Double-click)
            if (!"PENDING".equals(order.getStatus())) {
                throw new IllegalStateException("Đơn hàng này đã hoàn tất hoặc bị hủy, không thể xử lý lại!");
            }

            // 3. Xử lý trừ kho theo thứ tự (productId, locationId)
            List<IssueItem> items = issueItemRepository.findByIssueOrderId(id);
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
        } finally {
            releaseRedisLocks(acquiredKeys, lockToken);
        }
    }

    @Transactional
    public IssueOrder cancelIssueOrder(Long id) {
        String lockToken = UUID.randomUUID().toString();
        List<String> acquiredKeys = acquireRedisLocks(List.of("lock:issue-order:" + id), lockToken);

        try {
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
        } finally {
            releaseRedisLocks(acquiredKeys, lockToken);
        }
    }

    private List<String> acquireRedisLocks(List<String> keys, String token) {
        List<String> acquired = new ArrayList<>();
        if (redisTemplate == null || keys.isEmpty()) {
            return acquired;
        }
        try {
            for (String key : keys) {
                Boolean success = redisTemplate.opsForValue().setIfAbsent(key, token, LOCK_TTL);
                if (Boolean.FALSE.equals(success)) {
                    releaseRedisLocks(acquired, token);
                    throw new IllegalStateException("Đơn hàng hoặc tồn kho đang được xử lý đồng thời bởi yêu cầu khác (Redis Distributed Lock)!");
                }
                if (Boolean.TRUE.equals(success)) {
                    acquired.add(key);
                }
            }
        } catch (IllegalStateException lockConflict) {
            throw lockConflict;
        } catch (Exception redisOffline) {
            // Nếu Redis chưa bật, tự động fallback về Pessimistic Write Lock (SELECT ... FOR UPDATE) của PostgreSQL
            acquired.clear();
        }
        return acquired;
    }

    private void releaseRedisLocks(List<String> acquiredKeys, String token) {
        if (redisTemplate == null || acquiredKeys == null || acquiredKeys.isEmpty()) {
            return;
        }
        DefaultRedisScript<Long> unlockScript = new DefaultRedisScript<>(UNLOCK_LUA, Long.class);
        for (String key : acquiredKeys) {
            try {
                redisTemplate.execute(unlockScript, Collections.singletonList(key), token);
            } catch (Exception ignored) {
            }
        }
    }
}
