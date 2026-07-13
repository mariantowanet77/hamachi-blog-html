package com.hamachidaily.likes;

/**
 * 記事の「いいね」数の読み書き。
 * 本番は DynamoDB 実装（{@link DynamoDbLikeStore}）を使い、
 * 単体テストではインメモリ実装に差し替える。
 */
public interface LikeStore {

    /** 現在のいいね数を返す（未登録の記事は 0） */
    long getLikes(String articleId);

    /** いいねを 1 増やし、更新後の数を返す */
    long like(String articleId);

    /** いいねを 1 減らし（ただし 0 未満にはしない）、更新後の数を返す */
    long unlike(String articleId);
}
