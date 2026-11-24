package com.logistic.backend.service;

import com.logistic.backend.config.CacheConfig;
import org.springframework.cache.annotation.CacheEvict;
import com.logistic.backend.dto.CreateStockTakeRequest;
import com.logistic.backend.dto.StockTakeItemRequest;
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
public class StockTakeService {

    private static final Duration LOCK_TTL = Duration.ofSeconds(10);
    private static final String UNLOCK_LUA =
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

    private final StockTakeRepository stockTakeRepository;
    private final StockTakeItemRepository stockTakeItemRepository;
    private final InventoryRepository inventoryRepository;
    private final ProductRepository productRepository;
    private final LocationRepository locationRepository;
    private final StringRedisTemplate redisTemplate;

    @Autowired
    public StockTakeService(StockTakeRepository stockTakeRepository,
                            StockTakeItemRepository stockTakeItemRepository,
                            InventoryRepository inventoryRepository,
                            ProductRepository productRepository,
                            LocationRepository locationRepository,
                            @Autowired(required = false) StringRedisTemplate redisTemplate) {
        this.stockTakeRepository = stockTakeRepository;
        this.stockTakeItemRepository = stockTakeItemRepository;
        this.inventoryRepository = inventoryRepository;
        this.productRepository = productRepository;
        this.locationRepository = locationRepository;
        this.redisTemplate = redisTemplate;
    }

    @Transactional
    @CacheEvict(cacheNames = CacheConfig.STOCK_REPORT, allEntries = true)
    public StockTake createStockTake(CreateStockTakeRequest request) {
        if (request == null || request.getCode() == null || request.getCode().isBlank()
                || request.getItems() == null || request.getItems().isEmpty()) {
            throw new IllegalArgumentException("Stock take code and at least one item are required");
        }
        StockTake stockTake = StockTake.builder()
                .code(request.getCode())
                .status("DRAFT")
                .createdBy(request.getCreatedBy())
                .build();

        StockTake savedStockTake = stockTakeRepository.save(stockTake);

        List<StockTakeItemRequest> orderedItems = new ArrayList<>(request.getItems());
        Set<String> itemLocations = new HashSet<>();
        if (orderedItems.stream().anyMatch(item -> item == null || item.getProductId() == null
                || item.getLocationId() == null || item.getActualQty() == null || item.getActualQty() < 0)) {
            throw new IllegalArgumentException("Each stock take item requires a product, location, and non-negative quantity");
        }
        for (StockTakeItemRequest item : orderedItems) {
            if (!itemLocations.add(item.getProductId() + ":" + item.getLocationId())) {
                throw new IllegalArgumentException("A product can only be counted once per location in a stock take");
            }
        }
        orderedItems.sort(Comparator.comparing(StockTakeItemRequest::getProductId)
                .thenComparing(StockTakeItemRequest::getLocationId));

        List<String> lockKeys = orderedItems.stream()
                .map(item -> "lock:inventory:" + item.getProductId() + ":" + item.getLocationId())
                .toList();
        String lockToken = UUID.randomUUID().toString();
        List<String> acquiredKeys = acquireRedisLocks(lockKeys, lockToken);

        try {
            for (StockTakeItemRequest itemReq : orderedItems) {
                Inventory inventory = inventoryRepository.findByProductIdAndLocationIdWithLock(
                                itemReq.getProductId(), itemReq.getLocationId())
                        .orElseThrow(() -> new IllegalArgumentException("Inventory item not found for product ID: "
                                + itemReq.getProductId() + " at location ID: " + itemReq.getLocationId()));

                Product product = productRepository.findById(itemReq.getProductId())
                        .orElseThrow(() -> new IllegalArgumentException("Product not found"));
                Location location = locationRepository.findById(itemReq.getLocationId())
                        .orElseThrow(() -> new IllegalArgumentException("Location not found"));

                StockTakeItem stockTakeItem = StockTakeItem.builder()
                        .stockTake(savedStockTake)
                        .product(product)
                        .location(location)
                        .systemQty(inventory.getQuantity()) // Lấy tồn kho sổ sách thời điểm tạo phiếu
                        .actualQty(itemReq.getActualQty())   // Số thực tế kiểm kê đếm được
                        .build();

                stockTakeItemRepository.save(stockTakeItem);
            }

            return savedStockTake;
        } finally {
            releaseRedisLocks(acquiredKeys, lockToken);
        }
    }

    @Transactional
    @CacheEvict(cacheNames = CacheConfig.STOCK_REPORT, allEntries = true)
    public StockTake completeStockTake(Long stockTakeId, String approvedBy) {
        String lockToken = UUID.randomUUID().toString();
        List<String> acquiredKeys = acquireRedisLocks(List.of("lock:stock-take:" + stockTakeId), lockToken);

        try {
            StockTake stockTake = stockTakeRepository.findByIdWithLock(stockTakeId)
                    .orElseThrow(() -> new IllegalArgumentException("Stock take order not found"));

            if (!"DRAFT".equals(stockTake.getStatus())) {
                throw new IllegalStateException("Only DRAFT stock take orders can be completed");
            }

            List<StockTakeItem> items = stockTakeItemRepository.findOrderedByStockTakeId(stockTakeId);
            for (StockTakeItem item : items) {
                // Khóa dòng tồn kho (SELECT ... FOR UPDATE) trước khi điều chỉnh số lượng
                Inventory inventory = inventoryRepository.findByProductIdAndLocationIdWithLock(
                                item.getProduct().getId(), item.getLocation().getId())
                        .orElseThrow(() -> new IllegalStateException("Inventory item not found"));

                if (item.getActualQty() < inventory.getReservedQuantity()) {
                    throw new IllegalStateException("Counted quantity cannot be lower than quantity reserved for pending issues");
                }
                // Cập nhật lại tồn thực tế theo kết quả kiểm kê
                inventory.setQuantity(item.getActualQty());
                inventoryRepository.save(inventory);
            }

            stockTake.setStatus("COMPLETED");
            stockTake.setApprovedBy(approvedBy);
            return stockTakeRepository.save(stockTake);
        } finally {
            releaseRedisLocks(acquiredKeys, lockToken);
        }
    }

    @Transactional
    @CacheEvict(cacheNames = CacheConfig.STOCK_REPORT, allEntries = true)
    public StockTake cancelStockTake(Long stockTakeId) {
        String lockToken = UUID.randomUUID().toString();
        List<String> acquiredKeys = acquireRedisLocks(List.of("lock:stock-take:" + stockTakeId), lockToken);

        try {
            StockTake stockTake = stockTakeRepository.findByIdWithLock(stockTakeId)
                    .orElseThrow(() -> new IllegalArgumentException("Stock take order not found"));

            if (!"DRAFT".equals(stockTake.getStatus())) {
                throw new IllegalStateException("Only DRAFT stock take orders can be cancelled");
            }

            stockTake.setStatus("CANCELLED");
            return stockTakeRepository.save(stockTake);
        } finally {
            releaseRedisLocks(acquiredKeys, lockToken);
        }
    }

    public List<StockTake> list() {
        return stockTakeRepository.findAllByOrderByStockTakeDateDesc();
    }

    public List<StockTakeItem> items(Long stockTakeId) {
        if (!stockTakeRepository.existsById(stockTakeId)) throw new IllegalArgumentException("Stock take order not found");
        return stockTakeItemRepository.findDetails(stockTakeId);
    }

    public StockTakeItemRepository.StockTakeSummary summary(Long stockTakeId) {
        if (!stockTakeRepository.existsById(stockTakeId)) throw new IllegalArgumentException("Stock take order not found");
        return stockTakeItemRepository.summarize(stockTakeId);
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
                    throw new IllegalStateException("Phiếu kiểm kê hoặc tồn kho đang được khóa bởi giao dịch đồng thời khác (Redis Distributed Lock)!");
                }
                if (Boolean.TRUE.equals(success)) {
                    acquired.add(key);
                }
            }
        } catch (IllegalStateException lockConflict) {
            throw lockConflict;
        } catch (Exception redisOffline) {
            // Tự động fallback về Pessimistic Write Lock (SELECT ... FOR UPDATE) của PostgreSQL nếu Redis không bật
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
