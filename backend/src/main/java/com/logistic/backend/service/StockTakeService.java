package com.logistic.backend.service;

import com.logistic.backend.dto.CreateStockTakeRequest;
import com.logistic.backend.dto.StockTakeItemRequest;
import com.logistic.backend.entity.*;
import com.logistic.backend.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class StockTakeService {

    private final StockTakeRepository stockTakeRepository;
    private final StockTakeItemRepository stockTakeItemRepository;
    private final InventoryRepository inventoryRepository;
    private final ProductRepository productRepository;
    private final LocationRepository locationRepository;

    public StockTakeService(StockTakeRepository stockTakeRepository,
                            StockTakeItemRepository stockTakeItemRepository,
                            InventoryRepository inventoryRepository,
                            ProductRepository productRepository,
                            LocationRepository locationRepository) {
        this.stockTakeRepository = stockTakeRepository;
        this.stockTakeItemRepository = stockTakeItemRepository;
        this.inventoryRepository = inventoryRepository;
        this.productRepository = productRepository;
        this.locationRepository = locationRepository;
    }

    @Transactional
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
    }

    @Transactional
    public StockTake completeStockTake(Long stockTakeId, String approvedBy) {
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
}