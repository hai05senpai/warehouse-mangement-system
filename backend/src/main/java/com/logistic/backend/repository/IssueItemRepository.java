package com.logistic.backend.repository;

import com.logistic.backend.entity.IssueItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IssueItemRepository extends JpaRepository<IssueItem, Long> {
    List<IssueItem> findByIssueOrderId(Long issueOrderId);
    @Query("select i from IssueItem i where i.issueOrder.id = :id order by i.product.id, i.location.id")
    List<IssueItem> findOrderedByIssueOrderId(@Param("id") Long issueOrderId);
}
// N+1 Query problem: When fetching IssueItems for an IssueOrder, if we don't use JOIN FETCH, it will result in multiple queries to fetch related entities (customer, product, location) for each IssueItem. This can lead to performance issues, especially when dealing with a large number of IssueItems. By using JOIN FETCH in the query, we can retrieve all necessary data in a single query, thus avoiding the N+1 query problem.
// LazyInitializationException: If the IssueOrder entity is fetched lazily and the session is closed before accessing its related entities (like customer), it can lead to LazyInitializationException. Using JOIN FETCH ensures that all required associations are loaded while the session is still open, preventing this exception.