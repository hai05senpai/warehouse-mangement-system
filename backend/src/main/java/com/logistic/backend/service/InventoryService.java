package com.logistic.backend.service;

import com.logistic.backend.dto.TransferRequest;
import com.logistic.backend.entity.*;
import com.logistic.backend.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class InventoryService {
    private final InventoryRepository inventory;
    private final ProductRepository products;
    private final LocationRepository locations;
    private final StockTransferRepository transfers;
    private final StockTransferItemRepository transferItems;

    public InventoryService(InventoryRepository inventory, ProductRepository products, LocationRepository locations,
                            StockTransferRepository transfers, StockTransferItemRepository transferItems) {
        this.inventory = inventory;
        this.products = products;
        this.locations = locations;
        this.transfers = transfers;
        this.transferItems = transferItems;
    }

    public List<Inventory> search(String sku, String zone, boolean availableOnly) {
        return inventory.search(blankToEmpty(sku), blankToEmpty(zone), availableOnly);
    }

    @Transactional
    public StockTransfer transfer(TransferRequest request) {
        if (request == null || request.code() == null || request.code().isBlank()
                || request.items() == null || request.items().isEmpty()) {
            throw new IllegalArgumentException("Transfer code and at least one item are required");
        }
        record Key(Long productId, Long locationId) implements Comparable<Key> {
            @Override public int compareTo(Key other) {
                int product = productId.compareTo(other.productId);
                return product != 0 ? product : locationId.compareTo(other.locationId);
            }
        }
        Set<Key> lockKeys = new TreeSet<>();
        Map<Key, Integer> requestedBySource = new HashMap<>();
        Map<Key, Integer> quantityDeltas = new TreeMap<>();
        for (TransferRequest.Item item : request.items()) {
            if (item.productId() == null || item.sourceLocationId() == null || item.destinationLocationId() == null
                    || item.sourceLocationId().equals(item.destinationLocationId())
                    || item.quantity() == null || item.quantity() <= 0) {
                throw new IllegalArgumentException("Transfers require distinct locations and a positive quantity");
            }
            Key source = new Key(item.productId(), item.sourceLocationId());
            Key destination = new Key(item.productId(), item.destinationLocationId());
            lockKeys.add(source);
            lockKeys.add(destination);
            requestedBySource.merge(source, item.quantity(), Integer::sum);
            quantityDeltas.merge(source, -item.quantity(), Integer::sum);
            quantityDeltas.merge(destination, item.quantity(), Integer::sum);
        }
        Map<Key, Inventory> locked = new HashMap<>();
        for (Key key : lockKeys) {
            inventory.findByProductIdAndLocationIdWithLock(key.productId(), key.locationId())
                    .ifPresent(value -> locked.put(key, value));
        }
        for (Map.Entry<Key, Integer> requested : requestedBySource.entrySet()) {
            Inventory source = locked.get(requested.getKey());
            if (source == null) throw new IllegalArgumentException("Source inventory not found");
            if (source.getQuantity() - source.getReservedQuantity() < requested.getValue()) {
                throw new IllegalStateException("Insufficient available quantity for product " + requested.getKey().productId());
            }
        }
        StockTransfer transfer = transfers.save(StockTransfer.builder().code(request.code().trim())
                .createdBy(request.createdBy()).status("COMPLETED").build());
        for (Map.Entry<Key, Integer> change : quantityDeltas.entrySet()) {
            Inventory current = locked.get(change.getKey());
            if (current != null) {
                int newQuantity = current.getQuantity() + change.getValue();
                if (newQuantity < current.getReservedQuantity()) {
                    throw new IllegalStateException("Transfer would reduce stock below its reserved quantity");
                }
                current.setQuantity(newQuantity);
                inventory.save(current);
            } else if (change.getValue() > 0) {
                inventory.addReceivedStock(change.getKey().productId(), change.getKey().locationId(), change.getValue());
            } else {
                throw new IllegalArgumentException("Source inventory not found");
            }
        }
        for (TransferRequest.Item item : request.items()) {
            Product product = products.findById(item.productId()).orElseThrow(() -> new IllegalArgumentException("Product not found"));
            Location sourceLocation = locations.findById(item.sourceLocationId()).orElseThrow(() -> new IllegalArgumentException("Source location not found"));
            Location destination = locations.findById(item.destinationLocationId()).orElseThrow(() -> new IllegalArgumentException("Destination location not found"));
            transferItems.save(StockTransferItem.builder().transfer(transfer).product(product)
                    .sourceLocation(sourceLocation).destinationLocation(destination).quantity(item.quantity()).build());
        }
        return transfer;
    }

    private String blankToEmpty(String value) { return value == null || value.isBlank() ? "" : value.trim(); }
}
