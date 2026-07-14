package com.hamachidaily.likes;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.regex.Pattern;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayV2HTTPResponse;
import com.google.gson.Gson;
import com.google.gson.JsonParseException;

/**
 * 記事いいねAPI — Lambda Function URL のエントリーポイント。
 *
 * <pre>
 *   GET  /?article=20260708                          → {"article":"20260708","likes":12}
 *   POST /  {"article":"20260708","action":"like"}   → いいね +1 して新しい数を返す
 *   POST /  {"article":"20260708","action":"unlike"} → いいね -1（0 未満にはならない）
 * </pre>
 *
 * CORS（許可オリジン等）は Function URL 側の設定で付与するので、ここでは扱わない。
 */
public class LikeHandler implements RequestHandler<APIGatewayV2HTTPEvent, APIGatewayV2HTTPResponse> {

    /** 記事ID＝記事フォルダ名（例: 20260708, hello-world）。それ以外の文字列は弾く */
    private static final Pattern ARTICLE_ID = Pattern.compile("[A-Za-z0-9][A-Za-z0-9_-]{0,63}");

    private static final Gson GSON = new Gson();

    private final LikeStore store;

    /** Lambda ランタイムから呼ばれるコンストラクタ（本番は DynamoDB 実装） */
    public LikeHandler() {
        this(new DynamoDbLikeStore());
    }

    /** テスト用にストアを差し替えられるようにしておく */
    LikeHandler(LikeStore store) {
        this.store = store;
    }

    /** POST ボディの形 */
    record LikeRequest(String article, String action) {}

    /** 正常レスポンスの形 */
    record LikeResponse(String article, long likes) {}

    @Override
    public APIGatewayV2HTTPResponse handleRequest(APIGatewayV2HTTPEvent event, Context context) {
        try {
            String method = event.getRequestContext().getHttp().getMethod();
            return switch (method) {
                case "GET"  -> handleGet(event);
                case "POST" -> handlePost(event);
                default     -> error(405, "method not allowed");
            };
        } catch (IllegalArgumentException | JsonParseException e) {
            return error(400, e.getMessage());
        } catch (Exception e) {
            if (context != null) {
                context.getLogger().log("ERROR: " + e);
            }
            return error(500, "internal server error");
        }
    }

    /** GET: 現在のいいね数を返す */
    private APIGatewayV2HTTPResponse handleGet(APIGatewayV2HTTPEvent event) {
        Map<String, String> query = event.getQueryStringParameters();
        String articleId = validateArticleId(query == null ? null : query.get("article"));
        return ok(new LikeResponse(articleId, store.getLikes(articleId)));
    }

    /** POST: いいねの加算・取り消しをして、新しい数を返す */
    private APIGatewayV2HTTPResponse handlePost(APIGatewayV2HTTPEvent event) {
        LikeRequest req = GSON.fromJson(decodeBody(event), LikeRequest.class);
        if (req == null) {
            throw new IllegalArgumentException("request body is required");
        }
        String articleId = validateArticleId(req.article());

        long likes = switch (req.action() == null ? "" : req.action()) {
            case "like"   -> store.like(articleId);
            case "unlike" -> store.unlike(articleId);
            default       -> throw new IllegalArgumentException("action must be 'like' or 'unlike'");
        };
        return ok(new LikeResponse(articleId, likes));
    }

    /** 記事IDの形式チェック。変な値で DynamoDB にゴミアイテムを作らせない */
    private String validateArticleId(String articleId) {
        if (articleId == null || !ARTICLE_ID.matcher(articleId).matches()) {
            throw new IllegalArgumentException("invalid article id");
        }
        return articleId;
    }

    /** Function URL はボディを Base64 で渡してくることがあるので、その場合は復号する */
    private String decodeBody(APIGatewayV2HTTPEvent event) {
        String body = event.getBody();
        if (body != null && event.getIsBase64Encoded()) {
            return new String(Base64.getDecoder().decode(body), StandardCharsets.UTF_8);
        }
        return body;
    }

    private APIGatewayV2HTTPResponse ok(LikeResponse payload) {
        return json(200, GSON.toJson(payload));
    }

    private APIGatewayV2HTTPResponse error(int status, String message) {
        return json(status, GSON.toJson(Map.of("error", message)));
    }

    private APIGatewayV2HTTPResponse json(int status, String body) {
        return APIGatewayV2HTTPResponse.builder()
            .withStatusCode(status)
            .withHeaders(Map.of("Content-Type", "application/json; charset=utf-8"))
            .withBody(body)
            .build();
    }
}
