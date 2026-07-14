package com.hamachidaily.likes;

import java.util.Map;

import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.ConditionalCheckFailedException;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.GetItemResponse;
import software.amazon.awssdk.services.dynamodb.model.ReturnValue;
import software.amazon.awssdk.services.dynamodb.model.UpdateItemRequest;
import software.amazon.awssdk.services.dynamodb.model.UpdateItemResponse;

/**
 * DynamoDB を使った {@link LikeStore} の実装。
 *
 * テーブル構成（1記事 = 1アイテムのシンプルなカウンター）:
 *   - パーティションキー: article_id (S) … 記事フォルダ名（例: "20260708"）
 *   - 属性:               like_count (N) … いいね数
 *
 * 加算・減算は UpdateItem の式で行うためアトミック（同時アクセスでも数がズレない）。
 */
public class DynamoDbLikeStore implements LikeStore {

    private final DynamoDbClient dynamo;
    private final String tableName;

    /** Lambda 実行環境用。リージョンは環境変数 AWS_REGION から自動で決まる */
    public DynamoDbLikeStore() {
        this(
            DynamoDbClient.builder()
                // Netty より起動が軽い HTTP クライアント（コールドスタート対策）
                .httpClientBuilder(UrlConnectionHttpClient.builder())
                .build(),
            System.getenv().getOrDefault("TABLE_NAME", "hamachi-blog-likes")
        );
    }

    DynamoDbLikeStore(DynamoDbClient dynamo, String tableName) {
        this.dynamo = dynamo;
        this.tableName = tableName;
    }

    @Override
    public long getLikes(String articleId) {
        GetItemResponse res = dynamo.getItem(GetItemRequest.builder()
            .tableName(tableName)
            .key(key(articleId))
            .projectionExpression("like_count")
            .build());
        if (!res.hasItem() || !res.item().containsKey("like_count")) {
            return 0L; // まだ誰もいいねしていない記事
        }
        return Long.parseLong(res.item().get("like_count").n());
    }

    @Override
    public long like(String articleId) {
        // if_not_exists で「初いいね」の記事もこの 1 回で作成できる
        UpdateItemResponse res = dynamo.updateItem(UpdateItemRequest.builder()
            .tableName(tableName)
            .key(key(articleId))
            .updateExpression("SET like_count = if_not_exists(like_count, :zero) + :one")
            .expressionAttributeValues(Map.of(
                ":zero", number(0),
                ":one",  number(1)))
            .returnValues(ReturnValue.UPDATED_NEW)
            .build());
        return Long.parseLong(res.attributes().get("like_count").n());
    }

    @Override
    public long unlike(String articleId) {
        try {
            UpdateItemResponse res = dynamo.updateItem(UpdateItemRequest.builder()
                .tableName(tableName)
                .key(key(articleId))
                .updateExpression("SET like_count = like_count - :one")
                // 0 未満に減らそうとしたら失敗させる（マイナスいいね防止）
                .conditionExpression("like_count >= :one")
                .expressionAttributeValues(Map.of(":one", number(1)))
                .returnValues(ReturnValue.UPDATED_NEW)
                .build());
            return Long.parseLong(res.attributes().get("like_count").n());
        } catch (ConditionalCheckFailedException e) {
            return 0L; // すでに 0（またはアイテム未作成）なら 0 のまま
        }
    }

    private Map<String, AttributeValue> key(String articleId) {
        return Map.of("article_id", AttributeValue.builder().s(articleId).build());
    }

    private AttributeValue number(long n) {
        return AttributeValue.builder().n(Long.toString(n)).build();
    }
}
