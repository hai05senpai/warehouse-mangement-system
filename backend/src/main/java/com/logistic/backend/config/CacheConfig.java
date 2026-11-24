package com.logistic.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.CachingConfigurer;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.CacheErrorHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;

import java.time.Duration;

/**
 * Cache Redis cho báo cáo tồn kho (UC-07): truy vấn SUM/HAVING trên toàn bảng mà chỉ mục không giúp được.
 * Mọi thao tác làm đổi tồn kho hoặc ngưỡng đều xóa cache (@CacheEvict); TTL là lưới an toàn khi có ghi ngoài app.
 */
@Configuration
@EnableCaching
public class CacheConfig implements CachingConfigurer {
    public static final String STOCK_REPORT = "stockReport";
    private static final Logger log = LoggerFactory.getLogger(CacheConfig.class);

    @Bean
    public CacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(RedisCacheConfiguration.defaultCacheConfig().entryTtl(Duration.ofMinutes(5)))
                .transactionAware() // chỉ xóa cache sau khi giao dịch commit, tránh nạp lại dữ liệu cũ
                .build();
    }

    /** Redis lỗi thì bỏ qua cache và đọc thẳng PostgreSQL, giống cách khóa phân tán fallback. */
    @Override
    public CacheErrorHandler errorHandler() {
        return new CacheErrorHandler() {
            public void handleCacheGetError(RuntimeException e, Cache cache, Object key) { warn(e); }
            public void handleCachePutError(RuntimeException e, Cache cache, Object key, Object value) { warn(e); }
            public void handleCacheEvictError(RuntimeException e, Cache cache, Object key) { warn(e); }
            public void handleCacheClearError(RuntimeException e, Cache cache) { warn(e); }
            private void warn(RuntimeException e) { log.warn("Redis cache unavailable, using PostgreSQL: {}", e.getMessage()); }
        };
    }
}
