package com.hamachidaily.likes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;

/**
 * LikeHandler の単体テスト。
 * DynamoDB の代わりにインメモリの LikeStore を差し込んで、
 * ルーティング・入力チェック・カウントの増減だけを検証する。
 */
class LikeHandlerTest {

    /** テスト用のインメモリ実装（0 未満に減らないルールも本物と揃える） */
    private static class InMemoryStore implements LikeStore {
        final Map<String, Long> counts = new HashMap<>();

        @Override
        public long getLikes(String articleId) {
            return counts.getOrDefault(articleId, 0L);
        }

        @Override
        public long like(String articleId) {
            return counts.merge(articleId, 1L, Long::sum);
        }

        @Override
        public long unlike(String articleId) {
            long next = Math.max(0L, getLikes(articleId) - 1);
            counts.put(articleId, next);
            return next;
        }
    }

    private InMemoryStore store;
    private LikeHandler handler;

    @BeforeEach
    void setUp() {
        store = new InMemoryStore();
        handler = new LikeHandler(store);
    }

    // --- イベントの組み立てヘルパー ---

    private APIGatewayV2HTTPEvent event(String method, Map<String, String> query, String body) {
        return APIGatewayV2HTTPEvent.builder()
            .withRequestContext(APIGatewayV2HTTPEvent.RequestContext.builder()
                .withHttp(APIGatewayV2HTTPEvent.RequestContext.Http.builder()
                    .withMethod(method)
                    .build())
                .build())
            .withQueryStringParameters(query)
            .withBody(body)
            .build();
    }

    private APIGatewayV2HTTPResponse post(String body) {
        return handler.handleRequest(event("POST", null, body), null);
    }

    // --- テスト本体 ---

    @Test
    void 未登録の記事のいいね数は0を返す() {
        APIGatewayV2HTTPResponse res =
            handler.handleRequest(event("GET", Map.of("article", "20260708"), null), null);
        assertEquals(200, res.getStatusCode());
        assertTrue(res.getBody().contains("\"likes\":0"));
    }

    @Test
    void likeで1増えてunlikeで1減る() {
        assertEquals(200, post("{\"article\":\"20260708\",\"action\":\"like\"}").getStatusCode());
        assertEquals(200, post("{\"article\":\"20260708\",\"action\":\"like\"}").getStatusCode());
        assertEquals(2L, store.getLikes("20260708"));

        APIGatewayV2HTTPResponse res = post("{\"article\":\"20260708\",\"action\":\"unlike\"}");
        assertTrue(res.getBody().contains("\"likes\":1"));
    }

    @Test
    void いいね0の状態でunlikeしてもマイナスにならない() {
        APIGatewayV2HTTPResponse res = post("{\"article\":\"hello-world\",\"action\":\"unlike\"}");
        assertEquals(200, res.getStatusCode());
        assertTrue(res.getBody().contains("\"likes\":0"));
    }

    @Test
    void 不正な記事IDは400を返す() {
        APIGatewayV2HTTPResponse res = post("{\"article\":\"../etc/passwd\",\"action\":\"like\"}");
        assertEquals(400, res.getStatusCode());
    }

    @Test
    void 記事IDなしのGETは400を返す() {
        APIGatewayV2HTTPResponse res = handler.handleRequest(event("GET", null, null), null);
        assertEquals(400, res.getStatusCode());
    }

    @Test
    void 未知のactionは400を返す() {
        APIGatewayV2HTTPResponse res = post("{\"article\":\"20260708\",\"action\":\"superlike\"}");
        assertEquals(400, res.getStatusCode());
    }

    @Test
    void 対応していないメソッドは405を返す() {
        APIGatewayV2HTTPResponse res = handler.handleRequest(event("DELETE", null, null), null);
        assertEquals(405, res.getStatusCode());
    }
}
