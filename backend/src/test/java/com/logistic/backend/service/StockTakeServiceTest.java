package com.logistic.backend.service;

import com.logistic.backend.entity.*;
import com.logistic.backend.repository.*;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** FR-05: sổ sách 10, đếm được 8. */
class StockTakeServiceTest {
    private final StockTakeRepository takes = mock(StockTakeRepository.class);
    private final StockTakeItemRepository items = mock(StockTakeItemRepository.class);
    private final InventoryRepository inventory = mock(InventoryRepository.class);
    private final StockTakeService service = new StockTakeService(takes, items, inventory,
            mock(ProductRepository.class), mock(LocationRepository.class), null);

    private Inventory setUp(int currentQuantity) {
        Product product = Product.builder().id(1L).sku("SKU-1").build();
        Location location = Location.builder().id(2L).code("A1").build();
        StockTake take = StockTake.builder().id(5L).status("DRAFT").build();
        Inventory stock = Inventory.builder().product(product).location(location)
                .quantity(currentQuantity).reservedQuantity(0).build();
        when(takes.findByIdWithLock(5L)).thenReturn(Optional.of(take));
        when(takes.save(any())).thenAnswer(call -> call.getArgument(0));
        when(items.findOrderedByStockTakeId(5L)).thenReturn(List.of(StockTakeItem.builder()
                .stockTake(take).product(product).location(location).systemQty(10).actualQty(8).build()));
        when(inventory.findByProductIdAndLocationIdWithLock(1L, 2L)).thenReturn(Optional.of(stock));
        return stock;
    }

    @Test
    void unchangedStockIsAdjustedToCountedQuantity() {
        Inventory stock = setUp(10);
        assertEquals("COMPLETED", service.completeStockTake(5L, "manager").getStatus());
        assertEquals(8, stock.getQuantity());
    }

    @Test
    void stockChangedSinceCreationIsRejected() {
        Inventory stock = setUp(14); // có phiếu nhập +4 sau khi lập phiếu kiểm kê
        IllegalStateException error = assertThrows(IllegalStateException.class,
                () -> service.completeStockTake(5L, "manager"));
        assertTrue(error.getMessage().contains("recount"));
        assertEquals(14, stock.getQuantity());
        verify(inventory, never()).save(any());
    }
}
